import { describe, expect, it } from "vitest";
import {
  normalizeHakkaForTts,
  numberToZhSpoken,
} from "./hakka-tts-text";

describe("normalizeHakkaForTts", () => {
  it("converts simplified tutoring text toward Hakka written form", () => {
    const out = normalizeHakkaForTts("我会用客家话同你倾。");
    expect(out).toContain("會");
    expect(out).toContain("客家話");
    expect(out).toMatch(/^涯/);
    expect(out).toContain("摎你");
    expect(out).toContain("講");
  });

  it("strips CJK quotes that formog2p rejects", () => {
    expect(normalizeHakkaForTts("「無錯」")).toBe("無錯");
    expect(normalizeHakkaForTts("【提示】慢慢想")).toBe("提示慢慢想");
    expect(normalizeHakkaForTts("好！講「咚咚」个故事。")).toContain("咚咚");
    expect(normalizeHakkaForTts("好！講「咚咚」个故事。")).not.toMatch(/[「」]/);
  });

  it("converts digits properly and drops latex", () => {
    expect(normalizeHakkaForTts("第12题")).toContain("十二");
    expect(normalizeHakkaForTts("第1题")).toMatch(/第一/);
    const out = normalizeHakkaForTts("你講分涯知：$a^2+b^2=c^2$");
    expect(out).not.toContain("$");
    expect(out).toContain("講分涯知");
  });

  it("rewrites common Mandarin particles into Hakka", () => {
    const out = normalizeHakkaForTts("这题我不会做。你怎么想？");
    expect(out).toContain("涯毋會做");
    expect(out).toContain("仰般想");
    expect(out).not.toMatch(/[。？]/); // pauses become commas / trimmed
  });

  it("rewrites 是不是 / 的 / 给 into Hakka forms", () => {
    const out = normalizeHakkaForTts("你是不是想学数学？好！讲一个咚咚的故事给你听。");
    expect(out).toContain("係唔係");
    expect(out).toContain("一隻");
    expect(out).toContain("个故事");
    expect(out).toContain("分你聽");
  });

  it("keeps already-good Hakka traditional text readable", () => {
    const s = "這題涯毋會做";
    expect(normalizeHakkaForTts(s)).toContain("涯毋會做");
  });

  it("normalizes ascii punctuation into speakable pauses", () => {
    expect(normalizeHakkaForTts("做得好!")).toBe("做得好");
  });

  it("speaks multiple-choice markers in Chinese", () => {
    const out = normalizeHakkaForTts("A) 放低水桶 B) 先汲水 C) 趕狗仔走");
    expect(out).toContain("甲");
    expect(out).toContain("乙");
    expect(out).toContain("丙");
    expect(out).not.toMatch(/\bA\b/);
  });
});

describe("numberToZhSpoken", () => {
  it("reads teens and tens naturally", () => {
    expect(numberToZhSpoken(10)).toBe("十");
    expect(numberToZhSpoken(12)).toBe("十二");
    expect(numberToZhSpoken(20)).toBe("二十");
    expect(numberToZhSpoken(105)).toBe("一百零五");
  });
});
