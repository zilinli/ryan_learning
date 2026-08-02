import { chunkForNeuralTts } from "./tts-text";

export type SpeakHandlers = {
  voice?: string;
  onStatus?: (status: string) => void;
  onError?: (message: string) => void;
  shouldContinue?: () => boolean;
};

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ||
    null
  );
}

/**
 * Web Audio based player — after unlock() from a user tap, later replies
 * can autoplay without another "Hear reply" tap on most mobile browsers.
 */
export class NeuralSpeechEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private unlocked = false;

  isUnlocked() {
    return this.unlocked && !!this.ctx && this.ctx.state === "running";
  }

  /** Call from a click/tap handler before the first network fetch. */
  async unlock(): Promise<void> {
    const Ctor = getAudioContextCtor();
    if (!Ctor) throw new Error("Web Audio not supported");
    if (!this.ctx) this.ctx = new Ctor();
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    // Tiny silent buffer keeps the context "hot" after user gesture
    const silent = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const node = this.ctx.createBufferSource();
    node.buffer = silent;
    node.connect(this.ctx.destination);
    node.start(0);
    this.unlocked = true;
  }

  stop() {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        // ignore
      }
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }
  }

  private async playBuffer(buffer: AudioBuffer): Promise<void> {
    if (!this.ctx) await this.unlock();
    const ctx = this.ctx!;
    if (ctx.state === "suspended") await ctx.resume();

    this.stop();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    this.source = source;

    await new Promise<void>((resolve, reject) => {
      source.onended = () => {
        if (this.source === source) this.source = null;
        resolve();
      };
      try {
        source.start(0);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("start failed"));
      }
    });
  }

  async speak(
    text: string,
    handlers: SpeakHandlers = {},
  ): Promise<"played" | "cancelled" | "empty" | "error"> {
    const chunks = chunkForNeuralTts(text);
    if (!chunks.length) return "empty";

    this.stop();

    try {
      if (!this.ctx || this.ctx.state !== "running") {
        await this.unlock();
      }
    } catch (err) {
      handlers.onError?.(
        err instanceof Error ? err.message : "Audio unlock failed",
      );
      return "error";
    }

    for (let i = 0; i < chunks.length; i += 1) {
      if (handlers.shouldContinue && !handlers.shouldContinue()) {
        this.stop();
        return "cancelled";
      }
      const chunk = chunks[i]!;
      handlers.onStatus?.(
        chunks.length > 1 ? `Speaking… ${i + 1}/${chunks.length}` : "Speaking…",
      );

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: chunk,
            voice: handlers.voice,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error || `TTS HTTP ${res.status}`);
        }
        const ab = await res.arrayBuffer();
        if (ab.byteLength < 100) throw new Error("TTS returned empty audio");

        if (handlers.shouldContinue && !handlers.shouldContinue()) {
          this.stop();
          return "cancelled";
        }

        const ctx = this.ctx!;
        // decodeAudioData may detach the buffer — copy first
        const audioBuffer = await ctx.decodeAudioData(ab.slice(0));
        await this.playBuffer(audioBuffer);
      } catch (err) {
        // One resume+retry helps after long idle on mobile
        try {
          await this.unlock();
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunk,
              voice: handlers.voice,
            }),
          });
          if (!res.ok) throw new Error("TTS retry failed");
          const ab = await res.arrayBuffer();
          const audioBuffer = await this.ctx!.decodeAudioData(ab.slice(0));
          await this.playBuffer(audioBuffer);
        } catch (err2) {
          const msg =
            err2 instanceof Error
              ? err2.message
              : err instanceof Error
                ? err.message
                : "play failed";
          handlers.onError?.(msg);
          return "error";
        }
      }
    }

    handlers.onStatus?.("");
    return "played";
  }
}

/** @deprecated kept for tests — prefer NeuralSpeechEngine */
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
