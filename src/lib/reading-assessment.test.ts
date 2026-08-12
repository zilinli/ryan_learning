import { describe, expect, it } from "vitest";
import {
  normalizeWord,
  readingFeedback,
  scoreReading,
} from "./reading-assessment";

describe("reading-assessment", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeWord("Hello,")).toBe("hello");
    expect(normalizeWord("don't")).toBe("dont");
    expect(normalizeWord("CAT")).toBe("cat");
  });

  it("perfect read scores 100", () => {
    const s = scoreReading("The cat sat on the mat.", "The cat sat on the mat.");
    expect(s.accuracy).toBe(100);
    expect(s.correctWords).toBe(s.totalWords);
    expect(s.missed).toEqual([]);
  });

  it("positional misses lower the score and list missed words", () => {
    const s = scoreReading(
      "The dog sat on the mat.",
      "The cat sat on the mat.",
    );
    expect(s.totalWords).toBe(6);
    expect(s.correctWords).toBe(5);
    expect(s.accuracy).toBe(83);
    expect(s.missed).toEqual(["cat"]);
  });

  it("extra heard words do not inflate the score", () => {
    const s = scoreReading(
      "The cat sat and slept on the mat",
      "The cat sat on the mat",
    );
    expect(s.totalWords).toBe(6);
    expect(s.correctWords).toBe(3); // "and"/"slept" shift everything after "sat"
    expect(s.missed.includes("on")).toBe(false);
  });

  it("CJK passages tokenize by character", () => {
    const s = scoreReading("小猫坐在垫子上", "小猫坐在垫子上");
    expect(s.totalWords).toBe(7);
    expect(s.accuracy).toBe(100);
  });

  it("empty target is safe", () => {
    expect(scoreReading("anything", "").accuracy).toBe(100);
    expect(scoreReading("", "").missed).toEqual([]);
  });

  it("feedback adapts to accuracy", () => {
    expect(readingFeedback({ totalWords: 6, correctWords: 6, accuracy: 100, missed: [] })).toMatch(/Fluent/);
    expect(readingFeedback({ totalWords: 6, correctWords: 5, accuracy: 83, missed: ["cat"] })).toMatch(/Listen for: cat/);
    expect(readingFeedback({ totalWords: 6, correctWords: 2, accuracy: 33, missed: ["cat"] })).toMatch(/stumble/);
  });
});
