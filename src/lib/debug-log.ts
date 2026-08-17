/**
 * Temporary client-side debug logger (DEBUG MODE session 753d74).
 * POSTs to the same-origin /api/debug-relay, which forwards to the ingest
 * endpoint. No-op outside the browser. Safe to call liberally; all failures
 * are swallowed. Remove after the debug session closes.
 */
export function dbgLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  runId = "repro-1",
): void {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/debug-relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, message, data, runId, timestamp: Date.now() }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}
