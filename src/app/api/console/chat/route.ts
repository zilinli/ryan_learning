import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { createConsoleHarnessTools } from "@/lib/console-harness";
import { readConsoleSession, writeConsoleSession } from "@/lib/console-session-store";
import type { ConsoleChatRequestBody, ConsoleMessage } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
function key() { const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim(); if (!k) throw new Error("No key"); process.env.CURSOR_API_KEY = k; return k; }
const SYS = `You are Spark Builder. Project: Next.js 16 + React 19 + TypeScript.
Tools: read_file, search_code, edit_file, run_tests, git_diff, apply_changes, revert_changes, list_files.
Safety rules: Never edit .git/, node_modules/, .env*, data/. Never delete files. Run tests after each edit. Max 5 edits per session.
Workflow: search_code -> read_file -> edit_file -> run_tests -> git_diff -> ask user approval -> apply_changes.`;
export async function POST(req: Request) {
  let body: ConsoleChatRequestBody;
  try { body = await req.json() as ConsoleChatRequestBody; } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
  const { sessionId, message } = body;
  if (!sessionId || !message?.trim()) return Response.json({ error: "Missing fields" }, { status: 400 });
  const tools = createConsoleHarnessTools();
  const enc = new TextEncoder();
  const sse = (ev: string, d: unknown) => `event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`;
  let sess = await readConsoleSession(sessionId) ?? { sessionId, messages: [] as ConsoleMessage[], fileChangeCount: 0, hasUncommittedChanges: false };
  sess.messages.push({ id: `cm_${Date.now()}`, role: "user", content: message.trim(), createdAt: Date.now() });
  const stream = new ReadableStream({
    async start(ctrl) {
      let closed = false;
      const cls = () => { if (closed) return; closed = true; try { ctrl.close(); } catch {} };
      const snd = (ev: string, d: unknown) => { if (closed||req.signal.aborted) return; try { ctrl.enqueue(enc.encode(sse(ev, d))); } catch { closed = true; } };
      let agent: SDKAgent | null = null; let full = "";
      const abort = () => { try { agent?.close(); } catch {} cls(); };
      req.signal.addEventListener("abort", abort);
      try {
        snd("status", { status: "Starting..." });
        agent = await Agent.create({ apiKey: key(), model: { id: "auto" }, name: "Spark Builder", local: { cwd: process.cwd(), settingSources: [], customTools: tools } });
        const run = await agent.send(`${SYS}\n\n[Request]\n${message.trim()}`, { local: { customTools: tools }, onDelta: ({ update }) => { if (update.type==="text-delta"&&update.text) { full+=update.text; snd("delta",{text:update.text}); } } });
        for await (const ev of run.stream()) {
          if (req.signal.aborted) break;
          if (ev.type==="assistant") for (const b of ev.message.content) { if (b.type==="text"&&b.text&&b.text.length>full.length) { const x=b.text.slice(full.length); full=b.text; snd("delta",{text:x}); } }
          else if (ev.type==="tool_call"&&ev.status==="running") snd("status", { status: "Tool: "+String(ev.name).replace(/^.*\//,"") });
        }
        if (!req.signal.aborted) { const r = await run.wait(); if (r.status==="error") snd("error",{error:"Run failed"}); else { if (r.result&&r.result.length>full.length) full=r.result; snd("done",{text:full||"Done."}); } }
      } catch(e) { if (!req.signal.aborted) snd("error", { error: e instanceof CursorAgentError ? e.message : e instanceof Error ? e.message : "Unknown" }); }
      finally { if (full&&sess) { sess.messages.push({ id: `cm_${Date.now()}`, role:"assistant", content:full, createdAt:Date.now() }); try { await writeConsoleSession(sess); } catch {} } req.signal.removeEventListener("abort",abort); try{agent?.close();}catch{} cls(); }
    }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}
