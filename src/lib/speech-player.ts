import { chunkForNeuralTts, pullSpeakableFromBuffer } from "./tts-text";
import { resolveEdgeVoice, type TutorVoiceId } from "./voices";

export type SpeakHandlers = {
  /** Preference id (auto / xiaoxiao / elvira …) — resolved per chunk */
  voiceId?: TutorVoiceId | string;
  /** Optional fixed edge voice override */
  voice?: string;
  onStatus?: (status: string) => void;
  onError?: (message: string) => void;
  shouldContinue?: () => boolean;
};

/**
 * ~0.2s silent WAV (44100Hz mono). Longer than 1-sample clips so iOS
 * treats unlock() as a real media play inside the user gesture.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function makeSilentWavDataUri(seconds = 0.25): string {
  // Generate a slightly longer silent PCM WAV at runtime for better iOS unlock
  if (typeof window === "undefined") return SILENT_WAV;
  const sampleRate = 22050;
  const numSamples = Math.max(1, Math.floor(sampleRate * seconds));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  // samples already 0
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/**
 * Mobile-first TTS player (iPhone / iPad Safari & Chrome = WebKit).
 * HTMLAudioElement + blob URLs — Web Audio MP3 decode is unreliable on iOS.
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
  private playedInStream = false;
  private silentUri: string | null = null;

  isUnlocked() {
    return this.unlocked && !!this.audio;
  }

  didPlayInCurrentStream() {
    return this.playedInStream;
  }

  private ensureAudio(): HTMLAudioElement {
    if (typeof window === "undefined") {
      throw new Error("Audio only available in the browser");
    }
    if (!this.audio) {
      const a = document.createElement("audio");
      a.setAttribute("playsinline", "true");
      a.setAttribute("webkit-playsinline", "true");
      a.setAttribute("aria-hidden", "true");
      a.preload = "auto";
      (a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      a.controls = false;
      a.style.cssText =
        "position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-9999px;";
      document.body.appendChild(a);
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

  /**
   * Must run inside a tap/click (Speak on, Send, Mic).
   * Safe to call repeatedly.
   */
  async unlock(): Promise<void> {
    const a = this.ensureAudio();
    a.muted = false;
    a.volume = 1;
    if (!this.silentUri) this.silentUri = makeSilentWavDataUri(0.3);

    // Do NOT revoke an in-flight MP3 blob here — only swap to silent for unlock
    const prevObjectUrl = this.objectUrl;
    a.src = this.silentUri;
    try {
      await a.play();
      // Let a few ms of audio actually start (iOS gesture credit)
      await new Promise((r) => setTimeout(r, 40));
    } catch (err) {
      throw err instanceof Error ? err : new Error("Audio unlock failed");
    } finally {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        // ignore
      }
      // restore previous blob url pointer bookkeeping (src already cleared of silent)
      this.objectUrl = prevObjectUrl;
    }
    this.unlocked = true;
  }

  stop() {
    this.generation += 1;
    this.queue = [];
    this.pumping = false;
    this.streamBuf = "";
    this.playedInStream = false;
    const a = this.audio;
    if (a) {
      try {
        a.onended = null;
        a.onerror = null;
        a.pause();
      } catch {
        // ignore
      }
    }
    this.revokeUrl();
  }

  beginStream(handlers: SpeakHandlers = {}) {
    this.stop();
    this.activeHandlers = handlers;
    this.streamBuf = "";
    this.playedInStream = false;
  }

  streamPush(delta: string, handlers?: SpeakHandlers) {
    if (handlers) this.activeHandlers = handlers;
    if (!delta) return;
    this.streamBuf += delta;
    const { ready, rest } = pullSpeakableFromBuffer(this.streamBuf);
    this.streamBuf = rest;
    for (const chunk of ready) this.enqueueChunk(chunk);
  }

  streamFlush(handlers?: SpeakHandlers) {
    if (handlers) this.activeHandlers = handlers;
    const { ready, rest } = pullSpeakableFromBuffer(this.streamBuf, {
      force: true,
    });
    this.streamBuf = rest;
    for (const chunk of ready) this.enqueueChunk(chunk);
  }

  /**
   * End of assistant reply: flush stream buffer, and if nothing was queued/played
   * (e.g. odd markdown), speak the full cleaned text as a safety net.
   */
  finishReply(fullText: string, handlers?: SpeakHandlers) {
    if (handlers) this.activeHandlers = handlers;
    this.streamFlush(handlers);
    if (!this.playedInStream && this.queue.length === 0) {
      const chunks = chunkForNeuralTts(fullText);
      for (const c of chunks) this.enqueueChunk(c);
    }
  }

  private enqueueChunk(text: string) {
    const cleaned = text.trim();
    if (cleaned.length < 2) return;
    this.queue.push(cleaned);
    void this.pump();
  }

  private waitEnded(a: HTMLAudioElement, gen: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        a.removeEventListener("ended", onEnd);
        a.removeEventListener("error", onErr);
        window.clearInterval(watch);
        if (err) reject(err);
        else resolve();
      };
      const onEnd = () => done();
      const onErr = () => done(new Error("Audio play failed"));
      a.addEventListener("ended", onEnd);
      a.addEventListener("error", onErr);
      const watch = window.setInterval(() => {
        if (gen !== this.generation) done();
      }, 150);
    });
  }

  private async playMp3(ab: ArrayBuffer, gen: number): Promise<void> {
    const a = this.ensureAudio();
    this.revokeUrl();
    const url = URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
    this.objectUrl = url;
    a.src = url;
    a.muted = false;
    a.volume = 1;

    try {
      await a.play();
    } catch {
      // Gesture may have expired — caller should have unlocked on Send; try once more
      // without revokeUrl of current blob
      a.src = url;
      this.objectUrl = url;
      await a.play();
    }

    if (gen !== this.generation) {
      try {
        a.pause();
      } catch {
        // ignore
      }
      return;
    }
    this.playedInStream = true;
    await this.waitEnded(a, gen);
  }

  private resolveVoice(text: string, h: SpeakHandlers): string {
    if (h.voiceId) return resolveEdgeVoice(h.voiceId, text);
    if (h.voice) return resolveEdgeVoice(mapEdgeToId(h.voice), text);
    return resolveEdgeVoice("auto", text);
  }

  private async fetchTts(
    text: string,
    h: SpeakHandlers,
  ): Promise<ArrayBuffer> {
    const voice = this.resolveVoice(text, h);
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error || `TTS HTTP ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 100) throw new Error("TTS returned empty audio");
    return ab;
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    const gen = this.generation;

    try {
      while (this.queue.length > 0) {
        if (gen !== this.generation) return;
        const h = this.activeHandlers;
        if (h.shouldContinue && !h.shouldContinue()) {
          this.stop();
          return;
        }
        const chunk = this.queue.shift()!;
        const left = this.queue.length;
        h.onStatus?.(left > 0 ? `Speaking… (${left + 1} left)` : "Speaking…");

        try {
          if (!this.unlocked) {
            // May fail without gesture — surface error
            await this.unlock();
          }
          const ab = await this.fetchTts(chunk, h);
          if (gen !== this.generation) return;
          if (h.shouldContinue && !h.shouldContinue()) {
            this.stop();
            return;
          }
          await this.playMp3(ab, gen);
        } catch (err) {
          try {
            // Retry once
            await this.unlock();
            if (gen !== this.generation) return;
            const ab = await this.fetchTts(chunk, h);
            await this.playMp3(ab, gen);
          } catch (err2) {
            const msg =
              err2 instanceof Error
                ? err2.message
                : err instanceof Error
                  ? err.message
                  : "play failed";
            this.activeHandlers.onError?.(msg);
            this.queue = [];
            return;
          }
        }
      }
      if (gen === this.generation) this.activeHandlers.onStatus?.("");
    } finally {
      if (gen === this.generation) this.pumping = false;
      if (gen === this.generation && this.queue.length > 0) void this.pump();
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

    while (gen === this.generation && (this.pumping || this.queue.length > 0)) {
      if (handlers.shouldContinue && !handlers.shouldContinue()) {
        this.stop();
        return "cancelled";
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    if (gen !== this.generation) return "cancelled";
    handlers.onStatus?.("");
    return this.playedInStream ? "played" : "error";
  }
}

function mapEdgeToId(edge: string): TutorVoiceId {
  if (edge.startsWith("zh-HK")) return "hiuMaan";
  if (edge.startsWith("zh-")) return "xiaoxiao";
  if (edge.startsWith("es-MX")) return "dalia";
  if (edge.startsWith("es-")) return "elvira";
  if (edge.includes("Ryan") || edge.includes("en-GB")) return "ryan";
  return "ava";
}

let shared: NeuralSpeechEngine | null = null;

export function getSharedSpeechEngine(): NeuralSpeechEngine {
  if (!shared) shared = new NeuralSpeechEngine();
  return shared;
}

/** @deprecated */
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
