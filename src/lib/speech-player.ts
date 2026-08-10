import {
  chunkForNeuralTts,
  cleanTutorSpeechText,
  joinSpeechParts,
  pullSpeakableFromBuffer,
} from "./tts-text";
import { getTutorVoice, resolveEdgeVoice, type TutorVoiceId } from "./voices";

export type SpeakHandlers = {
  /** Preference id (auto / yunxi / alvaro …) — resolved per chunk */
  voiceId?: TutorVoiceId | string;
  /** Optional fixed edge voice override */
  voice?: string;
  onStatus?: (status: string) => void;
  onError?: (message: string) => void;
  shouldContinue?: () => boolean;
};

/** teo/hak/sha 走百炼或 FormoSpeech，并发预取会把机器拖死。 */
function isDialectHandlers(h: SpeakHandlers): boolean {
  if (h.voiceId == null) return false;
  const lang = getTutorVoice(h.voiceId).lang;
  return lang === "teo" || lang === "hak" || lang === "sha";
}

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
  /** Prefetch next chunk(s) while the current one plays — kills inter-paragraph gaps */
  private prefetch = new Map<string, Promise<ArrayBuffer>>();
  /** Abort in-flight /api/tts when Stop bumps generation */
  private fetchAbort: AbortController | null = null;

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
    this.prefetch.clear();
    try {
      this.fetchAbort?.abort();
    } catch {
      // ignore
    }
    this.fetchAbort = null;
    const a = this.audio;
    if (a) {
      try {
        a.onended = null;
        a.onerror = null;
        a.pause();
        // Clear src so buffered MP3 cannot keep playing after revoke
        a.removeAttribute("src");
        a.load();
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
    const dialect = isDialectHandlers(this.activeHandlers);
    const { ready, rest } = pullSpeakableFromBuffer(this.streamBuf, {
      // 方言：多攒一点再送合成，但单片仍控制在百炼可承受范围内
      minChars: dialect ? 40 : 28,
      maxWaitChars: dialect ? 120 : 160,
    });
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

  /** True while audio is playing or chunks are waiting / synthesizing. */
  isBusy() {
    return this.pumping || this.queue.length > 0;
  }

  /**
   * End of assistant reply: flush stream buffer, and if nothing was queued/played
   * (e.g. odd markdown), speak the full cleaned text as a safety net.
   */
  finishReply(fullText: string, handlers?: SpeakHandlers) {
    if (handlers) this.activeHandlers = handlers;
    this.streamFlush(handlers);
    if (!this.playedInStream && this.queue.length === 0) {
      const dialect = isDialectHandlers(this.activeHandlers);
      const chunks = chunkForNeuralTts(fullText, dialect ? 120 : 280);
      for (const c of chunks) this.enqueueChunk(c);
    }
  }

  private enqueueChunk(text: string) {
    // Defense in depth: never queue raw SVG/CSS even if upstream missed a strip
    const cleaned = cleanTutorSpeechText(text);
    if (cleaned.length < 2) return;
    const last = this.queue[this.queue.length - 1];
    const dialect = isDialectHandlers(this.activeHandlers);
    // 方言：片段不宜太长（百炼长文易超时），也不宜太碎（往返开销）
    const gluePrev = dialect ? 72 : 48;
    const glueNext = dialect ? 48 : 28;
    const glueMax = dialect ? 140 : 240;
    if (
      last &&
      (last.length < gluePrev || cleaned.length < glueNext) &&
      joinSpeechParts(last, cleaned).length <= glueMax
    ) {
      this.queue[this.queue.length - 1] = joinSpeechParts(last, cleaned);
    } else {
      this.queue.push(cleaned);
    }
    this.warmPrefetch(this.activeHandlers);
    void this.pump();
  }

  private cacheKey(text: string, h: SpeakHandlers): string {
    return `${this.resolveVoice(text, h)}\0${text}`;
  }

  /** Kick off TTS for upcoming phrases while audio plays. Dialect: only +1. */
  private warmPrefetch(h: SpeakHandlers, ahead?: number) {
    const n = ahead ?? (isDialectHandlers(h) ? 1 : 3);
    for (let i = 0; i < Math.min(n, this.queue.length); i += 1) {
      const text = this.queue[i]!;
      const key = this.cacheKey(text, h);
      if (this.prefetch.has(key)) continue;
      const gen = this.generation;
      const req = this.fetchTts(text, h)
        .then((ab) => {
          if (gen !== this.generation) {
            this.prefetch.delete(key);
          }
          return ab;
        })
        .catch((err) => {
          this.prefetch.delete(key);
          throw err;
        });
      this.prefetch.set(key, req);
    }
  }

  private async takeAudio(text: string, h: SpeakHandlers): Promise<ArrayBuffer> {
    const key = this.cacheKey(text, h);
    const pending = this.prefetch.get(key);
    if (pending) {
      this.prefetch.delete(key);
      return pending;
    }
    return this.fetchTts(text, h);
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
      // Poll frequently so Stop feels instant
      const watch = window.setInterval(() => {
        if (gen !== this.generation) done();
      }, 50);
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
    // Helps Safari pick up the new blob before play()
    try {
      a.load();
    } catch {
      // ignore
    }

    try {
      await a.play();
    } catch {
      // Gesture may have expired — re-unlock silently then retry once
      try {
        await this.unlock();
      } catch {
        // continue to retry play anyway
      }
      if (gen !== this.generation) return;
      a.src = url;
      this.objectUrl = url;
      a.muted = false;
      a.volume = 1;
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
    // Dialect + Shanghainese: send lang param for TTS route normalization
    const dialectLang =
      h.voiceId != null
        ? getTutorVoice(h.voiceId).lang
        : undefined;
    const dialectTts =
      dialectLang === "teo" || dialectLang === "hak" || dialectLang === "sha"
        ? dialectLang
        : undefined;
    const voice = this.resolveVoice(text, h);
    // 方言百炼 / FormoSpeech 合成可达数十秒（与闽南/客家同超时）
    const timeoutMs = dialectTts ? 90_000 : 45_000;
    const attempt = async (): Promise<ArrayBuffer> => {
      const gen = this.generation;
      const ac = new AbortController();
      this.fetchAbort = ac;
      const timer = window.setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, lang: dialectTts }),
          signal: ac.signal,
        });
        if (gen !== this.generation) {
          throw new Error("TTS cancelled");
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error || `TTS HTTP ${res.status}`);
        }
        const ab = await res.arrayBuffer();
        if (gen !== this.generation) {
          throw new Error("TTS cancelled");
        }
        if (ab.byteLength < 100) throw new Error("TTS returned empty audio");
        return ab;
      } finally {
        window.clearTimeout(timer);
        if (this.fetchAbort === ac) this.fetchAbort = null;
      }
    };
    try {
      return await attempt();
    } catch (err) {
      // Dialect：失败不重试第二次长等待（否则像卡死）；非方言仍快速重试一次
      if (dialect) {
        throw err instanceof Error ? err : new Error("TTS failed");
      }
      if (err instanceof Error && /cancel/i.test(err.message)) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 280));
      try {
        return await attempt();
      } catch {
        throw err instanceof Error ? err : new Error("TTS failed");
      }
    }
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
        // Overlap: synthesize upcoming chunks while this one plays
        this.warmPrefetch(h);
        const left = this.queue.length;
        h.onStatus?.(left > 0 ? `Speaking… (${left + 1} left)` : "Speaking…");

        try {
          if (!this.unlocked) {
            // May fail without gesture — surface error
            await this.unlock();
          }
          const ab = await this.takeAudio(chunk, h);
          if (gen !== this.generation) return;
          if (h.shouldContinue && !h.shouldContinue()) {
            this.stop();
            return;
          }
          // Keep warming while playback runs
          this.warmPrefetch(h);
          await this.playMp3(ab, gen);
        } catch (err) {
          const dialect = isDialectHandlers(h);
          if (dialect) {
            // 跳过坏句/超时句，继续后面故事，避免整段朗读卡死
            const msg =
              err instanceof Error ? err.message : "dialect TTS failed";
            h.onStatus?.(
              this.queue.length > 0
                ? `跳过一句，继续… (${this.queue.length} left)`
                : "跳过一句",
            );
            console.warn("[tts] dialect chunk skipped:", msg);
            this.prefetch.clear();
            continue;
          }
          try {
            // Retry once
            await this.unlock();
            if (gen !== this.generation) return;
            const ab = await this.fetchTts(chunk, h);
            this.warmPrefetch(h);
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
            this.prefetch.clear();
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
    // Dialect Bailian/FormoSpeech: shorter chunks avoid 15–30s+ single-shot timeouts
    const dialectMax =
      handlers.voiceId != null &&
      (getTutorVoice(handlers.voiceId).lang === "teo" ||
        getTutorVoice(handlers.voiceId).lang === "hak")
        ? 120
        : 280;
    const chunks = chunkForNeuralTts(text, dialectMax);
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
  if (edge.startsWith("zh-HK")) return "wanLung";
  if (edge.startsWith("zh-")) return "yunxi";
  if (edge.startsWith("es-MX")) return "jorge";
  if (edge.startsWith("es-")) return "alvaro";
  if (edge.startsWith("fr-")) return "henri";
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
