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
});
