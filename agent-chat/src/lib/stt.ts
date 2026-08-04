/**
 * STT (Speech-to-Text) client for Agent Chat Console.
 *
 * Strategy:
 *  1. Prefer browser Web Speech API (low latency, zero server cost)
 *  2. Fallback to server-side STT (Whisper/SenseVoice) for better accuracy
 *
 * This module handles the server fallback path.
 */

export async function transcribeServer(
  audioBlob: Blob,
  language: string = "auto"
): Promise<{ text: string; language: string; confidence: number }> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");
  formData.append("language", language);

  const resp = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    throw new Error(`STT server error: ${resp.status}`);
  }

  return resp.json();
}

/**
 * Check if Web Speech API is available in this browser.
 */
export function isWebSpeechAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

/**
 * Minimal Web Speech API surface used by this module.
 */
interface WebSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

/**
 * Create a Web Speech API recognition instance.
 */
export function createWebSpeechRecognition(
  lang: string
): WebSpeechRecognition | null {
  if (!isWebSpeechAvailable()) return null;
  const SpeechRecognition =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  const recognition = new (SpeechRecognition as new () => WebSpeechRecognition)();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

/**
 * Detect browser's preferred speech language.
 * Matches navigator.language to supported codes.
 */
export function detectSpeechLang(): string {
  if (typeof navigator === "undefined") return "zh-CN";
  const lang = navigator.language;
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  if (lang.startsWith("es")) return "es-ES";
  return "zh-CN";
}
