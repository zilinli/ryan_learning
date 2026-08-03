import { describe, expect, it } from "vitest";
import {
  chunkForNeuralTts,
  cleanTutorSpeechText,
  pullSpeakableFromBuffer,
} from "./tts-text";

describe("cleanTutorSpeechText", () => {
  it("strips markdown chrome and collapses whitespace", () => {
    const out = cleanTutorSpeechText(
      "# Title\n\n> quote\n\n- item one\n\n**bold** and _italic_",
    );
    expect(out).toContain("Title");
    expect(out).toContain("quote");
    expect(out).toContain("item one");
    expect(out).toContain("bold");
    expect(out).not.toMatch(/[*_#>-]/);
  });

  it("unwraps links and inline code", () => {
    expect(cleanTutorSpeechText("See [docs](https://x.test) and `code`")).toBe(
      "See docs and code",
    );
  });

  it("converts simple LaTeX fractions for speech", () => {
    const out = cleanTutorSpeechText("Compute $\\frac{1}{2}$ please.");
    expect(out.toLowerCase()).toContain("1 over 2");
  });

  it("returns empty for blank input", () => {
    expect(cleanTutorSpeechText("   \n  ")).toBe("");
  });

  it("removes spaces between Chinese characters", () => {
    expect(cleanTutorSpeechText("你 好 ， 请 看 这 一 题")).toBe(
      "你好，请看这一题",
    );
  });

  it("joins Chinese lines without inserting Latin spaces", () => {
    const out = cleanTutorSpeechText("先看这一句。\n你觉得什么意思？");
    expect(out).toBe("先看这一句。你觉得什么意思？");
    expect(out).not.toMatch(/。\s/);
  });
});

describe("chunkForNeuralTts", () => {
  it("returns empty for blank text", () => {
    expect(chunkForNeuralTts("")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    expect(chunkForNeuralTts("Hello there.")).toEqual(["Hello there."]);
  });

  it("splits long text under maxLen", () => {
    const sentences = Array.from(
      { length: 20 },
      (_, i) => `Sentence number ${i} is here.`,
    ).join(" ");
    const parts = chunkForNeuralTts(sentences, 80);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 80)).toBe(true);
    expect(parts.join(" ")).toContain("Sentence number 0");
  });
});

describe("pullSpeakableFromBuffer", () => {
  it("extracts completed sentences", () => {
    const { ready, rest } = pullSpeakableFromBuffer(
      "This is a complete sentence. And more",
    );
    expect(ready.length).toBeGreaterThanOrEqual(1);
    expect(ready[0]).toContain("complete sentence");
    expect(rest).toContain("And more");
  });

  it("force-flushes remaining buffer", () => {
    const { ready, rest } = pullSpeakableFromBuffer("Almost done", {
      force: true,
    });
    expect(ready).toEqual(["Almost done"]);
    expect(rest).toBe("");
  });

  it("soft-breaks long clauses without sentence end", () => {
    const long =
      "This is a fairly long clause without ending punctuation yet, " +
      "and it keeps going with more words to exceed the wait threshold " +
      "so speech can start earlier than the full reply would allow.";
    const { ready, rest } = pullSpeakableFromBuffer(long, {
      minChars: 20,
      maxWaitChars: 60,
    });
    expect(ready.length).toBeGreaterThanOrEqual(1);
    expect(rest.length).toBeLessThan(long.length);
  });

  it("waits longer by default so streaming is less choppy", () => {
    const clause =
      "Let's look carefully at the first sentence of the passage and notice";
    // Under default maxWait (160) — should NOT soft-break yet
    expect(clause.length).toBeLessThan(160);
    const { ready, rest } = pullSpeakableFromBuffer(clause);
    expect(ready).toEqual([]);
    expect(rest).toBe(clause);
  });

  it("soft-breaks near the wait window, not at the first space", () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const { ready } = pullSpeakableFromBuffer(words, {
      minChars: 28,
      maxWaitChars: 80,
    });
    expect(ready.length).toBe(1);
    expect(ready[0]!.length).toBeGreaterThan(28);
    expect(ready[0]!.startsWith("word0")).toBe(true);
  });
});
