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

  it("strips CJK quotes that formog2p rejects", () => {
    expect(normalizeHakkaForTts("「無錯」")).toBe("無錯");
    expect(normalizeHakkaForTts("【提示】慢慢想")).toBe("提示慢慢想");
    expect(normalizeHakkaForTts("好！講「咚咚」个故事。")).toContain("咚咚");
    expect(normalizeHakkaForTts("好！講「咚咚」个故事。")).not.toMatch(/[「」]/);
  });

  it("converts digits and drops latex", () => {
    expect(normalizeHakkaForTts("第1题")).toMatch(/第一/);
    const out = normalizeHakkaForTts("你講分涯知：$a^2+b^2=c^2$");
    expect(out).not.toContain("$");
    expect(out).toContain("講分涯知");
  });

  it("keeps already-good Hakka traditional text", () => {
    const s = "這題涯毋會做。";
    expect(normalizeHakkaForTts(s)).toBe(s);
  });

  it("normalizes ascii punctuation", () => {
    expect(normalizeHakkaForTts("做得好!")).toBe("做得好！");
  });

  it("speaks multiple-choice markers in Chinese", () => {
    const out = normalizeHakkaForTts("A) 放低水桶 B) 先汲水 C) 趕狗仔走");
    expect(out).toContain("甲");
    expect(out).toContain("乙");
    expect(out).toContain("丙");
    expect(out).not.toMatch(/\bA\b/);
  });
});
