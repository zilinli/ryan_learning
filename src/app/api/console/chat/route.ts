import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage, SDKUserMessage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { createConsoleHarnessTools } from "@/lib/console-harness";
import { CONSOLE_SYS } from "@/lib/console-sys";
import { readConsoleSession, writeConsoleSession } from "@/lib/console-session-store";
import {
  appendConsoleRunEvent,
  consoleRunEventsAfter,
  createConsoleRun,
  finishConsoleRun,
  getActiveConsoleRun,
  getConsoleRun,
  toConsoleRunSnapshot,
} from "@/lib/console-run-store";
import { normalizeIncomingAttachments, stripDataUrlPrefix } from "@/lib/attachments";
import { buildFileSummaries } from "@/lib/extract-files";
import type { ConsoleChatRequestBody, ConsoleMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function key() {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("No key");
  process.env.CURSOR_API_KEY = k;
  return k;
}

const SYS = CONSOLE_SYS;
const enc = new TextEncoder();

function emit(runId: string, event: string, data: unknown) {
  appendConsoleRunEvent(runId, event, data);
}

/** Drive agent off the HTTP abort path so mobile disconnect does not kill the run. */
async function driveConsoleRun(
  runId: string,
  sessionId: string,
  message: string | undefined,
  voiceLang: string | undefined,
  images: SDKImage[] | undefined,
  fileSummaries: string[],
): Promise<void> {
  const tools = createConsoleHarnessTools();
  let agent: SDKAgent | null = null;
  let full = "";

  try {
    emit(runId, "status", { status: "Creating agent…", runId });
    agent = await Agent.create({
      apiKey: key(), model: { id: "auto" }, name: "Spark Builder",
      local: { cwd: process.cwd(), settingSources: [], customTools: tools },
    });

    emit(runId, "status", { status: "Thinking…", runId });
    const promptText = [
      SYS,
      fileSummaries.length
        ? `\n[User attachments — text extracted from uploaded files]\n${fileSummaries.join("\n\n")}`
        : "",
      voiceLang ? `\n[User's voice language: ${voiceLang} — reply in this language when the request was dictated.]` : "",
      `\n[Request]\n${message?.trim() || "Please review the attached file(s)."}`,
    ].join("\n");

    const userMsg: SDKUserMessage = images?.length
      ? { text: promptText, images }
      : { text: promptText };

    const run = await agent.send(userMsg, {
      local: { customTools: tools },
      onDelta: ({ update }) => {
        if (update.type === "text-delta" && update.text) {
          full += update.text;
          emit(runId, "delta", { text: update.text });
        }
      },
    });

    for await (const ev of run.stream()) {
      if (ev.type === "assistant") {
        for (const b of ev.message.content) {
          if (b.type === "text" && b.text && b.text.length > full.length) {
            const x = b.text.slice(full.length); full = b.text;
            emit(runId, "delta", { text: x });
          }
        }
      } else if (ev.type === "tool_call") {
        const toolName = String(ev.name).replace(/^.*\//, "");
        if (ev.status === "running") {
          emit(runId, "status", { status: toolName, tool: toolName, running: true });
        } else if (ev.status === "completed" || ev.status === "error") {
          emit(runId, "tool_call", {
            tool: toolName,
            input: ev.args,
            output: ev.result,
            error: ev.status === "error",
          });
        }
      } else if (ev.type === "thinking") {
        emit(runId, "status", { status: "Thinking…" });
      }
    }

    const r = await run.wait();
    if (r.status === "error") {
      const err = "Run failed: " + (String(r.result).slice(0, 200) || "unknown");
      emit(runId, "error", { error: err });
      finishConsoleRun(runId, "error", { fullText: full, error: err });
    } else {
      if (r.result && r.result.length > full.length) full = r.result;
      emit(runId, "done", { text: full || "Done." });
      finishConsoleRun(runId, "done", { fullText: full || "Done." });
    }
  } catch (e) {
    const msg = e instanceof CursorAgentError ? e.message
      : e instanceof Error ? e.message : "Unknown error";
    emit(runId, "error", { error: msg });
    finishConsoleRun(runId, "error", { fullText: full, error: msg });
  } finally {
    if (full) {
      try {
        const sess = await readConsoleSession(sessionId) ?? {
          sessionId, messages: [] as ConsoleMessage[],
          fileChangeCount: 0, hasUncommittedChanges: false,
        };
        const last = sess.messages[sess.messages.length - 1];
        if (!(last && last.role === "assistant" && last.content === full)) {
          sess.messages.push({
            id: `cm_${Date.now()}`, role: "assistant",
            content: full, createdAt: Date.now(),
          });
          await writeConsoleSession(sess);
        }
      } catch { /* persist best-effort */ }
    }
    try { agent?.close(); } catch {}
  }
}

function sseTail(runId: string, signal: AbortSignal, afterId = 0): ReadableStream {
  return new ReadableStream({
    async start(ctrl) {
      let closed = false;
      let cursor = afterId;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const cls = () => {
        if (closed) return; closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try { ctrl.close(); } catch {}
      };

      // Client abort closes SSE only — never touches the detached agent run.
      const onAbort = () => { cls(); };
      signal.addEventListener("abort", onAbort);

      heartbeatTimer = setInterval(() => {
        if (closed || signal.aborted) { if (heartbeatTimer) clearInterval(heartbeatTimer); return; }
        try { ctrl.enqueue(enc.encode("event: hb\ndata: {}\n\n")); } catch { if (heartbeatTimer) clearInterval(heartbeatTimer); }
      }, 8_000);

      const snd = (ev: string, d: unknown, id?: number) => {
        if (closed || signal.aborted) return;
        try {
          const idLine = id != null ? `id: ${id}\n` : "";
          ctrl.enqueue(enc.encode(`${idLine}event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`));
        } catch { closed = true; }
      };

      try {
        while (!closed && !signal.aborted) {
          const run = getConsoleRun(runId);
          if (!run) {
            snd("error", { error: "Run not found" });
            break;
          }
          const batch = consoleRunEventsAfter(runId, cursor);
          for (const ev of batch) {
            cursor = ev.id;
            snd(ev.event, ev.data, ev.id);
          }
          if (run.status !== "running" && consoleRunEventsAfter(runId, cursor).length === 0) {
            break;
          }
          await new Promise((r) => setTimeout(r, 120));
        }
      } finally {
        signal.removeEventListener("abort", onAbort);
        cls();
      }
    },
  });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  "Connection": "keep-alive",
  "Keep-Alive": "timeout=300",
  "Transfer-Encoding": "chunked",
  "Content-Encoding": "identity",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();
  if (!sessionId) return Response.json({ error: "Missing sessionId" }, { status: 400 });

  const runId = url.searchParams.get("runId")?.trim();
  const after = Number(url.searchParams.get("after") || "0") || 0;

  if (runId) {
    const run = getConsoleRun(runId);
    if (!run || run.sessionId !== sessionId) {
      return Response.json({ error: "Run not found" }, { status: 404 });
    }
    // Reattach SSE from after event id
    return new Response(sseTail(runId, req.signal, after), { headers: SSE_HEADERS });
  }

  const sess = await readConsoleSession(sessionId);
  const active = getActiveConsoleRun(sessionId);
  return Response.json({
    messages: sess?.messages ?? [],
    activeRun: active ? toConsoleRunSnapshot(active) : null,
  });
}

export async function POST(req: Request) {
  let body: ConsoleChatRequestBody;
  try { body = await req.json() as ConsoleChatRequestBody; } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const { sessionId, message, voiceLang } = body;
  const attachments = normalizeIncomingAttachments(body);
  if (!sessionId || (!message?.trim() && attachments.length === 0)) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
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
  const images: SDKImage[] | undefined =
    imageAttachments.length > 0
      ? imageAttachments.map((img) => ({
          data: stripDataUrlPrefix(img.data || ""),
          mimeType: img.mimeType.startsWith("image/")
            ? img.mimeType
            : "image/jpeg",
        }))
      : undefined;

  const sess = await readConsoleSession(sessionId) ?? {
    sessionId, messages: [] as ConsoleMessage[],
    fileChangeCount: 0, hasUncommittedChanges: false,
  };
  sess.messages.push({
    id: `cm_${Date.now()}`, role: "user",
    content: (message?.trim() || "See attachments."),
    attachments: attachments.map((a) => ({ name: a.name, kind: a.kind })),
    createdAt: Date.now(),
  });
  try { await writeConsoleSession(sess); } catch {}

  const run = createConsoleRun(sessionId);
  // Fire-and-forget: must not be tied to req.signal
  void driveConsoleRun(run.runId, sessionId, message, voiceLang, images, fileSummaries);

  return new Response(sseTail(run.runId, req.signal, 0), {
    headers: {
      ...SSE_HEADERS,
      "X-Console-Run-Id": run.runId,
    },
  });
}
