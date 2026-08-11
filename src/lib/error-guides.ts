/**
 * Soft error / empty-fail templates (UX-RPT.10) — never harsh “you're wrong”.
 */

export function softSendErrorLine(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("api key") || t.includes("cursor_api_key")) {
    return "Spark can't reach the tutor brain right now (API key). Ask a parent to check settings.";
  }
  if (t.includes("network") || t.includes("fetch") || t.includes("failed to fetch")) {
    return "The connection hiccuped. Check Wi‑Fi, then try again — we can pick up together.";
  }
  if (t.includes("timeout") || t.includes("aborted")) {
    return "That took too long. Let's try a shorter question, or snap the homework again.";
  }
  if (t.includes("busy") || t.includes("active run")) {
    return "I'm still finishing the last thought. Wait a second, then send again.";
  }
  return "Something got stuck on my side. Let's try again — we'll figure it out together.";
}

export function softMicErrorLine(kind: "short" | "blocked" | "failed"): string {
  if (kind === "short") return "Too short — tap Mic, speak clearly, then tap again.";
  if (kind === "blocked") {
    return "Microphone is blocked — allow mic in the browser address bar, then try again.";
  }
  return "Recording failed — try once more when you're ready.";
}
