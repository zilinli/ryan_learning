import { chunkForNeuralTts, pullSpeakableFromBuffer } from "./tts-text";

export type SpeakHandlers = {
  voice?: string;
  onStatus?: (status: string) => void;
  onError?: (message: string) => void;
  shouldContinue?: () => boolean;
};

/** Minimal valid silent WAV — unlocks HTMLAudioElement inside a user gesture (iOS/iPad). */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/**
 * iPad/Safari-friendly TTS player.
 * Uses HTMLAudioElement + blob URLs (Web Audio decodeAudioData of MP3 is unreliable on iOS).
 */
export class NeuralSpeechEngine {
  private audio: HTMLAudioElement | null = null;
  private unlocked = false;
  private queue: string[] = [];
  private pumping = false;
  private generation = 0;
  private objectUrl: string | null = null;
  private streamBuf = "";
  private activeHandlers: SpeakHandlers = {};

  isUnlocked() {
    return this.unlocked && !!this.audio;
  }

  private ensureAudio(): HTMLAudioElement {
    if (typeof window === "undefined") {
      throw new Error("Audio only available in the browser");
    }
    if (!this.audio) {
      const a = new Audio();
      a.setAttribute("playsinline", "true");
      a.setAttribute("webkit-playsinline", "true");
      a.preload = "auto";
      // iOS Safari — keep the same element after unlock() for later autoplay
      (a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      // Attaching to DOM improves unlock persistence on iPad Safari/Chrome
      a.style.position = "fixed";
      a.style.width = "0";
      a.style.height = "0";
      a.style.opacity = "0";
      a.style.pointerEvents = "none";
      a.setAttribute("aria-hidden", "true");
      if (typeof document !== "undefined") {
        document.body.appendChild(a);
      }
      this.audio = a;
    }
    return this.audio;
  }

  private revokeUrl() {
    if (this.objectUrl) {
      try {
        URL.revokeObjectURL(this.objectUrl);
      } catch {
        // ignore
      }
      this.objectUrl = null;
    }
  }

  /** Must be called from a click/tap (Speak on). */
  async unlock(): Promise<void> {
    const a = this.ensureAudio();
    a.muted = false;
    a.volume = 1;
    this.revokeUrl();
    a.src = SILENT_WAV;
    try {
      await a.play();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Audio unlock failed");
    }
    // Stop silent clip quickly; keep element "warm"
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      // ignore
    }
    this.unlocked = true;
  }

  stop() {
    this.generation += 1;
    this.queue = [];
    this.pumping = false;
    this.streamBuf = "";
    const a = this.audio;
    if (a) {
      try {
        a.onended = null;
        a.onerror = null;
        a.pause();
        a.removeAttribute("src");
        a.load();
      } catch {
        // ignore
      }
    }
    this.revokeUrl();
  }

  /** Start a new streamed reply (clears prior speech). */
  beginStream(handlers: SpeakHandlers = {}) {
    this.stop();
    this.activeHandlers = handlers;
    this.streamBuf = "";
  }

  /** Feed live model deltas — speaks completed sentences ASAP. */
  streamPush(delta: string, handlers?: SpeakHandlers) {
    if (handlers) this.activeHandlers = handlers;
    if (!delta) return;
    this.streamBuf += delta;
    const { ready, rest } = pullSpeakableFromBuffer(this.streamBuf);
    this.streamBuf = rest;
    for (const chunk of ready) {
      this.enqueueChunk(chunk);
    }
  }

  /** Speak any leftover buffer when the model finishes. */
  streamFlush(handlers?: SpeakHandlers) {
    if (handlers) this.activeHandlers = handlers;
    const { ready, rest } = pullSpeakableFromBuffer(this.streamBuf, {
      force: true,
    });
    this.streamBuf = rest;
    for (const chunk of ready) {
      this.enqueueChunk(chunk);
    }
  }

  private enqueueChunk(text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;
    this.queue.push(cleaned);
    void this.pump();
  }

  private async playMp3(ab: ArrayBuffer, gen: number): Promise<void> {
    const a = this.ensureAudio();
    this.revokeUrl();
    const url = URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
    this.objectUrl = url;
    a.src = url;
    a.muted = false;
    a.volume = 1;

    await new Promise<void>((resolve, reject) => {
      const onEnd = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error("Audio play failed"));
      };
      const cleanup = () => {
        a.removeEventListener("ended", onEnd);
        a.removeEventListener("error", onErr);
      };
      a.addEventListener("ended", onEnd);
      a.addEventListener("error", onErr);
      const playPromise = a.play();
      if (playPromise) {
        playPromise.catch(async (err) => {
          // iOS often needs a second unlock after background / long idle
          try {
            await this.unlock();
            if (gen !== this.generation) {
              cleanup();
              resolve();
              return;
            }
            a.src = url;
            await a.play();
          } catch {
            cleanup();
            reject(err instanceof Error ? err : new Error("play blocked"));
          }
        });
      }
      // Guard: if generation cancelled mid-play
      const watch = window.setInterval(() => {
        if (gen !== this.generation) {
          window.clearInterval(watch);
          try {
            a.pause();
          } catch {
            // ignore
          }
          cleanup();
          resolve();
        }
      }, 200);
      a.addEventListener(
        "ended",
        () => {
          window.clearInterval(watch);
        },
        { once: true },
      );
    });
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    const gen = this.generation;
    const handlers = () => this.activeHandlers;

    try {
      while (this.queue.length > 0) {
        if (gen !== this.generation) return;
        const h = handlers();
        if (h.shouldContinue && !h.shouldContinue()) {
          this.stop();
          return;
        }
        const chunk = this.queue.shift()!;
        const remaining = this.queue.length;
        h.onStatus?.(
          remaining > 0 ? `Speaking… (${remaining + 1} left)` : "Speaking…",
        );

        try {
          if (!this.unlocked) await this.unlock();
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk, voice: h.voice }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(data?.error || `TTS HTTP ${res.status}`);
          }
          const ab = await res.arrayBuffer();
          if (ab.byteLength < 100) throw new Error("TTS returned empty audio");
          if (gen !== this.generation) return;
          if (h.shouldContinue && !h.shouldContinue()) {
            this.stop();
            return;
          }
          await this.playMp3(ab, gen);
        } catch (err) {
          // One retry with fresh unlock (common on iPad after idle)
          try {
            await this.unlock();
            if (gen !== this.generation) return;
            const res = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: chunk, voice: h.voice }),
            });
            if (!res.ok) throw new Error("TTS retry failed");
            const ab = await res.arrayBuffer();
            await this.playMp3(ab, gen);
          } catch (err2) {
            const msg =
              err2 instanceof Error
                ? err2.message
                : err instanceof Error
                  ? err.message
                  : "play failed";
            handlers().onError?.(msg);
            this.queue = [];
            return;
          }
        }
      }
      if (gen === this.generation) handlers().onStatus?.("");
    } finally {
      if (gen === this.generation) this.pumping = false;
      // If more chunks arrived while finishing last play
      if (gen === this.generation && this.queue.length > 0) {
        void this.pump();
      }
    }
  }

  async speak(
    text: string,
    handlers: SpeakHandlers = {},
  ): Promise<"played" | "cancelled" | "empty" | "error"> {
    const chunks = chunkForNeuralTts(text);
    if (!chunks.length) return "empty";

    this.beginStream(handlers);
    const gen = this.generation;

    try {
      if (!this.unlocked) await this.unlock();
    } catch (err) {
      handlers.onError?.(
        err instanceof Error ? err.message : "Audio unlock failed",
      );
      return "error";
    }

    for (const chunk of chunks) {
      if (gen !== this.generation) return "cancelled";
      if (handlers.shouldContinue && !handlers.shouldContinue()) {
        this.stop();
        return "cancelled";
      }
      this.enqueueChunk(chunk);
    }

    // Wait until queue drained for this generation
    while (
      gen === this.generation &&
      (this.pumping || this.queue.length > 0)
    ) {
      if (handlers.shouldContinue && !handlers.shouldContinue()) {
        this.stop();
        return "cancelled";
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    if (gen !== this.generation) return "cancelled";
    handlers.onStatus?.("");
    return "played";
  }
}

let shared: NeuralSpeechEngine | null = null;

export function getSharedSpeechEngine(): NeuralSpeechEngine {
  if (!shared) shared = new NeuralSpeechEngine();
  return shared;
}

/** @deprecated kept for tests */
export async function speakWithNeuralVoice(
  text: string,
  _audio: HTMLAudioElement,
  handlers: SpeakHandlers & {
    onBlocked?: (text: string) => void;
  } = {},
): Promise<"played" | "blocked" | "cancelled" | "empty"> {
  const engine = new NeuralSpeechEngine();
  try {
    await engine.unlock();
  } catch {
    handlers.onBlocked?.(text);
    return "blocked";
  }
  const result = await engine.speak(text, handlers);
  if (result === "error") {
    handlers.onBlocked?.(text);
    return "blocked";
  }
  if (result === "cancelled" || result === "empty") return result;
  return "played";
}
