import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NeuralSpeechEngine } from "./speech-player";

function mockAudioElement() {
  const el = {
    muted: false,
    volume: 1,
    src: "",
    controls: false,
    preload: "auto",
    style: { cssText: "" },
    onended: null as (() => void) | null,
    onerror: null as (() => void) | null,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(function (this: { src: string }, name: string) {
      if (name === "src") this.src = "";
    }),
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return el;
}

describe("NeuralSpeechEngine.stop (LVS)", () => {
  let audio: ReturnType<typeof mockAudioElement>;

  beforeEach(() => {
    audio = mockAudioElement();
    vi.stubGlobal("document", {
      createElement: () => audio,
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    });
    vi.stubGlobal(
      "URL",
      {
        createObjectURL: () => "blob:mock",
        revokeObjectURL: vi.fn(),
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stop clears queue, pauses, and removes audio src", () => {
    const engine = new NeuralSpeechEngine();
    // Force audio element creation via unlock path would need silent wav;
    // call stop after beginStream which creates via ensureAudio only on unlock.
    // Use speak's beginStream → stop chain:
    engine.beginStream({});
    // Manually attach audio the same way ensureAudio would:
    (engine as unknown as { audio: typeof audio }).audio = audio;
    (engine as unknown as { queue: string[] }).queue = ["chunk-a", "chunk-b"];
    (engine as unknown as { pumping: boolean }).pumping = true;

    engine.stop();

    expect((engine as unknown as { queue: string[] }).queue).toEqual([]);
    expect((engine as unknown as { pumping: boolean }).pumping).toBe(false);
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(audio.load).toHaveBeenCalled();
  });

  it("stop aborts in-flight fetch controller", () => {
    const engine = new NeuralSpeechEngine();
    const abort = vi.fn();
    (engine as unknown as { fetchAbort: { abort: () => void } | null }).fetchAbort =
      { abort };
    engine.stop();
    expect(abort).toHaveBeenCalled();
    expect(
      (engine as unknown as { fetchAbort: unknown }).fetchAbort,
    ).toBeNull();
  });

  it("TR1: explicit voice ShortName wins over lang detect (Ryan hard-lock)", () => {
    const engine = new NeuralSpeechEngine();
    const resolveVoice = (
      engine as unknown as {
        resolveVoice: (
          text: string,
          h: { voiceId?: string; voice?: string },
        ) => string;
      }
    ).resolveVoice.bind(engine);
    // Chinese in text would normally switch ryan → Cantonese via resolveEdgeVoice
    expect(
      resolveVoice("What is the main idea? 你好世界 hint.", {
        voiceId: "ryan",
        voice: "en-GB-RyanNeural",
      }),
    ).toBe("en-GB-RyanNeural");
    // Without hard-lock, CJK triggers non-English edge voice
    expect(
      resolveVoice("What is the main idea? 你好世界 hint.", {
        voiceId: "ryan",
      }),
    ).not.toBe("en-GB-RyanNeural");
  });

  it("fetchTts dialect failure does not ReferenceError on retry gate", async () => {
    const engine = new NeuralSpeechEngine();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "dialect TTS unavailable" }),
      }),
    );
    const fetchTts = (
      engine as unknown as {
        fetchTts: (
          text: string,
          h: { voiceId: string },
        ) => Promise<ArrayBuffer>;
      }
    ).fetchTts.bind(engine);
    await expect(fetchTts("你好", { voiceId: "teochew" })).rejects.toThrow(
      /dialect TTS unavailable|TTS HTTP|TTS failed/,
    );
    // Non-dialect still retries once (2 fetch calls)
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "edge down" }),
    });
    await expect(fetchTts("hello", { voiceId: "ava" })).rejects.toThrow(/edge down|TTS/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
