import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage, SDKUserMessage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { createConsoleHarnessTools } from "@/lib/console-harness";
import { readConsoleSession, writeConsoleSession } from "@/lib/console-session-store";
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

const SYS = `You are Spark Builder. Project: Next.js 16 + React 19 + TypeScript.
Tools: read_file, search_code, edit_file, run_tests, git_diff, apply_changes, revert_changes, list_files.
Safety rules: Never edit .git/, node_modules/, .env*, data/. Never delete files. Run tests after each edit. Max 5 edits per session.
Workflow: search_code -> read_file -> edit_file -> run_tests -> git_diff -> ask user approval -> apply_changes.`;

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

  const tools = createConsoleHarnessTools();
  const enc = new TextEncoder();

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

  const stream = new ReadableStream({
    async start(ctrl) {
      let closed = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const cls = () => {
        if (closed) return; closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try { ctrl.close(); } catch {}
      };

      heartbeatTimer = setInterval(() => {
        if (closed || req.signal.aborted) { if (heartbeatTimer) clearInterval(heartbeatTimer); return; }
        try { ctrl.enqueue(enc.encode("event: hb\ndata: {}\n\n")); } catch { if (heartbeatTimer) clearInterval(heartbeatTimer); }
      }, 8_000);

      const snd = (ev: string, d: unknown) => {
        if (closed || req.signal.aborted) return;
        try { ctrl.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`)); } catch { closed = true; }
      };

      let agent: SDKAgent | null = null; let full = "";
      const abort = () => { try { agent?.close(); } catch {} cls(); };
      req.signal.addEventListener("abort", abort);

      try {
        snd("status", { status: "Creating agent…" });
        agent = await Agent.create({
          apiKey: key(), model: { id: "auto" }, name: "Spark Builder",
          local: { cwd: process.cwd(), settingSources: [], customTools: tools },
        });

        snd("status", { status: "Thinking…" });
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
              full += update.text; snd("delta", { text: update.text });
            }
          },
        });

        for await (const ev of run.stream()) {
          if (req.signal.aborted) break;

          if (ev.type === "assistant") {
            for (const b of ev.message.content) {
              if (b.type === "text" && b.text && b.text.length > full.length) {
                const x = b.text.slice(full.length); full = b.text;
                snd("delta", { text: x });
              }
            }
          } else if (ev.type === "tool_call") {
            const toolName = String(ev.name).replace(/^.*\//, "");
            if (ev.status === "running") {
              snd("status", { status: toolName, tool: toolName, running: true });
            } else if (ev.status === "completed" || ev.status === "error") {
              snd("tool_call", {
                tool: toolName,
                input: ev.args,
                output: ev.result,
                error: ev.status === "error",
              });
            }
          } else if (ev.type === "thinking") {
            snd("status", { status: "Thinking…" });
          }
        }

        if (!req.signal.aborted) {
          const r = await run.wait();
          if (r.status === "error") {
            snd("error", { error: "Run failed: " + (String(r.result).slice(0, 200) || "unknown") });
          } else {
            if (r.result && r.result.length > full.length) full = r.result;
            snd("done", { text: full || "Done." });
          }
        }
      } catch (e) {
        if (!req.signal.aborted) {
          const msg = e instanceof CursorAgentError ? e.message
            : e instanceof Error ? e.message : "Unknown error";
          snd("error", { error: msg });
        }
      } finally {
        if (full && sess) {
          sess.messages.push({
            id: `cm_${Date.now()}`, role: "assistant",
            content: full, createdAt: Date.now(),
          });
          try { await writeConsoleSession(sess); } catch {}
        }
        req.signal.removeEventListener("abort", abort);
        try { agent?.close(); } catch {} cls();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
      "Keep-Alive": "timeout=300",
      "Transfer-Encoding": "chunked",
      "Content-Encoding": "identity",
    },
  });
}
