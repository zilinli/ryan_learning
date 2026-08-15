import { promises as fs } from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Debug relay (session 753d74): browsers cannot reach the ingest server on
 * localhost, so client-side instrumentation POSTs here same-origin and this
 * route forwards to the ingest endpoint (which appends NDJSON to the session
 * log). Also appends directly as a fallback. Best-effort only.
 */
const INGEST = "http://localhost:7381/ingest/21db5bcf-6623-4161-87dd-3095ab447d79";
const LOG_PATH = "/root/.cursor/debug-753d74.log";

export async function POST(req: Request) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 204 });
  }
  const line = JSON.stringify({
    sessionId: "753d74",
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
    location: String(payload.location || "client"),
    message: String(payload.message || ""),
    data: (payload.data as Record<string, unknown>) || {},
    runId: typeof payload.runId === "string" ? payload.runId : "run1",
    hypothesisId: typeof payload.hypothesisId === "string" ? payload.hypothesisId : "",
  });

  try {
    await fs.appendFile(LOG_PATH, `${line}\n`, "utf8");
  } catch {
    /* ignore */
  }
  try {
    await fetch(INGEST, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "753d74" },
      body: line,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  return new Response(null, { status: 204 });
}
