import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Debug-only relay: the browser (user's MacBook) cannot reach the ingest
 * server on localhost, so it POSTs here same-origin and this route forwards
 * to the debug ingest endpoint, which appends NDJSON to the session log file.
 * Removed after the debug session.
 */
const INGEST = "http://localhost:7381/ingest/21db5bcf-6623-4161-87dd-3095ab447d79";
const LOG_PATH = "/root/.cursor/debug-3a9f57.log";

export async function POST(req: Request) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 204 });
  }
  const line = JSON.stringify({
    sessionId: "3a9f57",
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
    location: String(payload.location || "camera"),
    message: String(payload.message || ""),
    data: (payload.data as Record<string, unknown>) || {},
    runId: typeof payload.runId === "string" ? payload.runId : "run1",
    hypothesisId: typeof payload.hypothesisId === "string" ? payload.hypothesisId : "",
  });

  // Write directly (matches ingest NDJSON format) AND forward to the ingest
  // server so the provisioning pipeline also sees it. Best-effort both.
  try {
    await fs.appendFile(LOG_PATH, `${line}\n`, "utf8");
  } catch {
    /* ignore */
  }
  try {
    await fetch(INGEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "3a9f57",
      },
      body: line,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  return new Response(null, { status: 204 });
}
