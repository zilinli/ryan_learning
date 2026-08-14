import {
  MAX_ATTACHMENTS,
  normalizeIncomingAttachments,
  stripDataUrlPrefix,
  hydrateUserMessageMedia,
} from "@/lib/attachments";
import { hasCursorApiKey, streamTutorReply } from "@/lib/cursor-agent";
import { buildFileSummaries } from "@/lib/extract-files";
import {
  buildImageOcrSummaries,
  worksheetGradingBlockFromSummaries,
} from "@/lib/image-ocr";
import { buildTutorPrompt } from "@/lib/prompts";
import { normalizeProfile } from "@/lib/student-profile";
import { filterTutorDelta, preferCompleteTutorText, scrubTutorVisibleText } from "@/lib/tutor-text-filter";
import { statusLabelForTool } from "@/lib/tutor-harness";
import {
  mergeLearningMemory,
  normalizeMemory,
  type LearningMemory,
} from "@/lib/learning-memory";
import { readServerLearningMemory } from "@/lib/learning-memory-store";
import type { ChatRequestBody } from "@/lib/types";
import type { EngagementState } from "@/lib/engagement";
import type { SDKImage } from "@cursor/sdk";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { getServerConversation, upsertServerConversation } from "@/lib/history-store";
import { titleFromMessages } from "@/lib/storage";
import type { ConversationRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function friendlyStatus(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const toolKey = s.replace(/^.*\//, "").replace(/^custom-user-tools[_:]?/i, "");
  const toolLabel = statusLabelForTool(toolKey);
  if (toolLabel && !toolLabel.startsWith("Using ")) return toolLabel;
  if (
    /tool|web_search|fetch_page|run_python|run_js|draw_geometry|harness|mcp|diagram tools/i.test(
      s,
    )
  ) {
    return "Working…";
  }
  if (/think/i.test(s)) return "Thinking…";
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "chat", RATE_PRESETS.agent);
  if (limited) return limited;

  if (!hasCursorApiKey()) {
    return Response.json(
      { error: "Cursor API Key is not configured." },
      { status: 503 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, message, reset } = body;
  if (!sessionId || typeof sessionId !== "string") {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const accountId =
    typeof body.accountId === "string" && body.accountId.trim()
      ? body.accountId.trim()
      : "default";

  const attachments = normalizeIncomingAttachments(body);
  if ((!message || !message.trim()) && attachments.length === 0) {
    return Response.json(
      { error: "Type a message or add photos / files." },
      { status: 400 },
    );
  }

  for (const a of attachments) {
    if (a.kind === "image" && a.data != null && String(a.data).trim().length < 8) {
      return Response.json(
        { error: `Photo "${a.name}" looks empty — try Camera / Photos again.` },
        { status: 400 },
      );
    }
  }

  // Best-effort server-side persist of the user turn BEFORE streaming the reply.
  // Chat history normally relies on the client pushStoreToServer (PUT /api/history),
  // which is silently dropped when the server is in a crash-loop window — that is
  // exactly how a video message vanished from acct_ching's de717193 session. Writing
  // the user message here (persistConversationMedia writes video/images to disk and
  // replaces dataUrl with mediaId) gives the server an authoritative copy that can
  // never be lost by a client push failure.
  const userMsg = body.userMessage;
  if (userMsg && typeof userMsg.id === "string" && userMsg.role === "user") {
    try {
      // Videos/files arrive as raw base64 `data` (no dataUrl — halves client
      // memory and prevents phone crashes). Rebuild the dataUrl server-side so
      // persistConversationMedia writes the clip to disk and history stores a
      // mediaId instead of a dangling reference.
      const userMsgToSave = hydrateUserMessageMedia(userMsg, attachments);
      const existing = await getServerConversation(sessionId, accountId);
      const existingMsgs = existing?.messages ?? [];
      const alreadySaved = existingMsgs.some((m) => m.id === userMsg.id);
      if (!alreadySaved) {
        const now = Date.now();
        const record: ConversationRecord = {
          sessionId,
          title: existing?.title || titleFromMessages([userMsgToSave, ...existingMsgs]),
          messages: [...existingMsgs, userMsgToSave],
          createdAt: existing?.createdAt ?? userMsg.createdAt ?? now,
          // Monotonic: keep the server copy's updatedAt unless this turn is newer,
          // so the cross-device guard never drops a message-append on slow clocks.
          updatedAt: Math.max(
            existing?.updatedAt ?? 0,
            userMsg.createdAt ?? now,
            now,
          ),
        };
        await upsertServerConversation(record, accountId);
      }
    } catch {
      // Non-fatal: client push remains the normal path.
    }
  }

  const imageAttachments = attachments.filter((a) => a.kind === "image" && a.data);
  const fileSummaries = await buildFileSummaries(attachments);
  // OCR photographed pages (word lists / worksheets) so the tutor gets exact
  // spellings instead of relying on fuzzy multimodal reading. Never blocks the
  // request: on failure / no key it returns [] and raw vision is the fallback.
  const imageOcrSummaries = await buildImageOcrSummaries(attachments);
  // P1-2 — when the photo is a numbered worksheet, ask the tutor to grade the
  // whole page per-item (✓/✗ verdicts + which ones to redo).
  const worksheetGrading = worksheetGradingBlockFromSummaries(imageOcrSummaries);

  // Quoted earlier message — re-send its text + media so the model anchors on it.
  const quote = body.quote && (body.quote.excerpt || body.quote.content)
    ? body.quote
    : undefined;
  const quoteAttachments = Array.isArray(quote?.attachments)
    ? quote.attachments
        .slice(0, MAX_ATTACHMENTS)
        .map((a) => ({
          ...a,
          kind: a.kind || (a.mimeType?.startsWith("image/") ? "image" : "file"),
        }))
    : [];
  const quoteImageAttachments = quoteAttachments.filter(
    (a) => a.kind === "image" && a.data,
  );
  const quoteFileSummaries = await buildFileSummaries(quoteAttachments);

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (t) =>
            t &&
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string" &&
            t.content.trim(),
        )
        .slice(-8)
        .map((t) => ({
          role: t.role as "user" | "assistant",
          content: t.content.slice(0, 500),
          images: t.images,
        }))
    : undefined;

  // Carry forward images from the last 2 user turns so the model can still read
  // homework photos when the student sends text-only follow-ups (no camera re-snap).
  const historyImages: Array<{ name: string; mimeType: string; data: string }> = [];
  if (history) {
    for (let i = history.length - 1; i >= 0 && historyImages.length < 9; i--) {
      const h = history[i];
      if (h.role === "user" && h.images?.length) {
        historyImages.unshift(...h.images);
      }
    }
  }

  const recentTitles = Array.isArray(body.recentTitles)
    ? body.recentTitles
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.slice(0, 80))
        .slice(0, 5)
    : undefined;

  const clientMemory = body.learningMemory
    ? normalizeMemory(body.learningMemory as Partial<LearningMemory>)
    : null;
  let learningMemory: LearningMemory | null = clientMemory;
  try {
    const serverMem = await readServerLearningMemory();
    if (clientMemory) {
      learningMemory = mergeLearningMemory(serverMem, clientMemory);
    } else if (serverMem.topics.length) {
      learningMemory = serverMem;
    }
  } catch {
    // keep client snapshot
  }

  const engagement: EngagementState | null =
    body.engagement && typeof body.engagement === "object"
      ? {
          streak: Math.max(0, Number(body.engagement.streak) || 0),
          lastActiveDay: "",
          solvesToday: Math.max(0, Number(body.engagement.solvesToday) || 0),
          totalSolves: Math.max(0, Number(body.engagement.totalSolves) || 0),
          badges: Array.isArray(body.engagement.badges)
            ? body.engagement.badges.filter((b): b is string => typeof b === "string").slice(-3)
            : [],
        }
      : null;

  // Always normalize: missing body → DEFAULT_STUDENT_PROFILE; named accounts keep their name.
  const studentProfile = normalizeProfile(body.studentProfile);

  const prompt = buildTutorPrompt({
    userText: message ?? "",
    imageCount: imageAttachments.length || historyImages.length,
    fileSummaries,
    imageOcrSummaries,
    worksheetGrading: worksheetGrading ?? undefined,
    history,
    historyImageCount: historyImages.length,
    recentTitles,
    studentProfile,
    learningMemory,
    engagement,
    voiceId: typeof body.voiceId === "string" ? body.voiceId : undefined,
    replyLanguage:
      typeof body.replyLanguage === "string" ? body.replyLanguage : undefined,
    checkMode: body.checkMode === true,
    coachNote:
      typeof body.coachNote === "string" && body.coachNote.trim()
        ? body.coachNote.trim().slice(0, 600)
        : undefined,
    quote: quote
      ? {
          author: quote.author === "user" ? "user" : "assistant",
          excerpt: quote.excerpt || "",
          content:
            typeof quote.content === "string" ? quote.content.slice(0, 2000) : undefined,
          fileSummaries: quoteFileSummaries.length
            ? quoteFileSummaries
            : undefined,
          imageCount: quoteImageAttachments.length,
        }
      : undefined,
  });

  const images: SDKImage[] | undefined =
    imageAttachments.length > 0 ||
    historyImages.length > 0 ||
    quoteImageAttachments.length > 0
      ? [
          ...imageAttachments.map((img) => ({
            data: stripDataUrlPrefix(img.data || ""),
            mimeType: img.mimeType.startsWith("image/")
              ? img.mimeType
              : "image/jpeg",
          })),
          ...quoteImageAttachments.map((img) => ({
            data: stripDataUrlPrefix(img.data || ""),
            mimeType: img.mimeType.startsWith("image/")
              ? img.mimeType
              : "image/jpeg",
          })),
          ...historyImages.map((img) => ({
            data: img.data,
            mimeType: img.mimeType.startsWith("image/")
              ? img.mimeType
              : "image/jpeg",
          })),
        ]
      : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let eventId = 0;
      let lastActivity = Date.now();

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Heartbeat: keep proxy connections alive during LLM thinking pauses
      const heartbeatTimer = setInterval(() => {
        if (closed || req.signal.aborted) {
          clearInterval(heartbeatTimer);
          return;
        }
        if (Date.now() - lastActivity > 25_000) {
          try {
            controller.enqueue(encoder.encode(":hb\n\n"));
          } catch {
            clearInterval(heartbeatTimer);
          }
        }
      }, 15_000);

      const send = (event: string, data: unknown) => {
        if (closed || req.signal.aborted) return;
        eventId += 1;
        lastActivity = Date.now();
        try {
          controller.enqueue(encoder.encode(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
          clearInterval(heartbeatTimer);
        }
      };

      const onAbort = () => { clearInterval(heartbeatTimer); close(); };
      req.signal.addEventListener("abort", onAbort);

      try {
        send("status", { status: "Thinking…" });
        if (req.signal.aborted) return;

        let visible = "";
        const { agentId, fullText } = await streamTutorReply({
          sessionId,
          text: prompt,
          images,
          reset,
          signal: req.signal,
          handlers: {
            onText: (delta) => {
              const cleaned = filterTutorDelta(delta);
              if (!cleaned) return;
              visible += cleaned;
              send("delta", { text: cleaned });
            },
            onStatus: (status) => {
              const friendly = friendlyStatus(status);
              if (friendly) send("status", { status: friendly });
            },
          },
        });
        // Prefer SDK final text when stream filter / deltas lost spaces or figures.
        const merged = preferCompleteTutorText(visible, fullText);
        const finalText = scrubTutorVisibleText(merged);
        send("done", { agentId, text: finalText });
      } catch (err) {
        if (req.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        send("error", { error: msg });
      } finally {
        clearInterval(heartbeatTimer);
        req.signal.removeEventListener("abort", onAbort);
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
      "Connection": "keep-alive",
      "Keep-Alive": "timeout=300",
    },
  });
}
