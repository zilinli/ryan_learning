import { normalizeIncomingAttachments, stripDataUrlPrefix } from "@/lib/attachments";
import { hasCursorApiKey, streamTutorReply } from "@/lib/cursor-agent";
import { buildFileSummaries } from "@/lib/extract-files";
import { buildTutorPrompt } from "@/lib/prompts";
import { DEFAULT_STUDENT_PROFILE } from "@/lib/student-profile";
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

  const imageAttachments = attachments.filter((a) => a.kind === "image" && a.data);
  const fileSummaries = await buildFileSummaries(attachments);

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

  const prompt = buildTutorPrompt({
    userText: message ?? "",
    imageCount: imageAttachments.length || historyImages.length,
    fileSummaries,
    history,
    historyImageCount: historyImages.length,
    recentTitles,
    studentProfile: DEFAULT_STUDENT_PROFILE,
    learningMemory,
    engagement,
    voiceId: typeof body.voiceId === "string" ? body.voiceId : undefined,
    replyLanguage:
      typeof body.replyLanguage === "string" ? body.replyLanguage : undefined,
    checkMode: body.checkMode === true,
  });

  const images: SDKImage[] | undefined =
    imageAttachments.length > 0 || historyImages.length > 0
      ? [
          ...imageAttachments.map((img) => ({
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
