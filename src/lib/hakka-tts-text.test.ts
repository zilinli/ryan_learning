import { describe, expect, it } from "vitest";
import { normalizeHakkaForTts } from "./hakka-tts-text";

describe("normalizeHakkaForTts", () => {
  it("converts simplified tutoring text to traditional Hakka-friendly form", () => {
    const out = normalizeHakkaForTts("我会用客家话同你倾。");
    expect(out).toContain("會");
    expect(out).toContain("客家話");
    expect(out).toContain("傾");
    expect(out).toMatch(/^涯/);
  });

  it("keeps already-good Hakka traditional text", () => {
    const s = "這題涯毋會做。";
    expect(normalizeHakkaForTts(s)).toBe(s);
  });

  it("normalizes ascii punctuation", () => {
    expect(normalizeHakkaForTts("做得好!")).toBe("做得好！");
  });
});
