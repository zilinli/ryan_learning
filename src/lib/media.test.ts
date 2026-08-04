import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chunkSpeechText,
  isCoarsePointer,
  preferEnglishVoice,
} from "./media";

describe("chunkSpeechText", () => {
  it("returns empty for blank", () => {
    expect(chunkSpeechText("   ")).toEqual([]);
  });

  it("keeps short text intact", () => {
    expect(chunkSpeechText("Hello world.")).toEqual(["Hello world."]);
  });

  it("splits on sentence boundaries under maxLen", () => {
    const text =
      "First sentence here. Second sentence follows. Third one is also present.";
    const parts = chunkSpeechText(text, 40);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 40)).toBe(true);
  });

  it("hard-slices oversized single sentences", () => {
    const text = "A".repeat(250);
    const parts = chunkSpeechText(text, 100);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(100);
  });
});

describe("preferEnglishVoice", () => {
  it("returns null for empty list", () => {
    expect(preferEnglishVoice([])).toBeNull();
  });

  it("prefers English female neural voices", () => {
    const voices = [
      {
        name: "Microsoft David",
        lang: "en-US",
        localService: true,
        default: false,
        voiceURI: "david",
      },
      {
        name: "Microsoft Aria Online (Natural)",
        lang: "en-US",
        localService: false,
        default: false,
        voiceURI: "aria",
      },
      {
        name: "Google Español",
        lang: "es-ES",
        localService: true,
        default: false,
        voiceURI: "es",
      },
    ] as SpeechSynthesisVoice[];

    const picked = preferEnglishVoice(voices);
    expect(picked?.name).toMatch(/Aria/i);
  });
});

describe("isCoarsePointer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false on Mac-like desktop (fine pointer + hover, even with multi-touch trackpad)", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q.includes("pointer: coarse")
          ? false
          : q.includes("hover: none")
            ? false
            : false,
      }),
    });
    vi.stubGlobal("navigator", { maxTouchPoints: 5 });
    expect(isCoarsePointer()).toBe(false);
  });

  it("is true for coarse pointer phones", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q.includes("pointer: coarse"),
      }),
    });
    vi.stubGlobal("navigator", { maxTouchPoints: 0 });
    expect(isCoarsePointer()).toBe(true);
  });

  it("is true when pointer:fine lies but device has no hover and multi-touch", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q.includes("hover: none"),
      }),
    });
    vi.stubGlobal("navigator", { maxTouchPoints: 5 });
    expect(isCoarsePointer()).toBe(true);
  });
});
