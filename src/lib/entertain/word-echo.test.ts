import { describe, expect, it } from "vitest";
import {
  WORD_BANK,
  difficultyFromPKnown,
  normalizeSpelling,
  pickRound,
  spellingHint,
  specForDifficulty,
  validateSpelling,
  wordEchoSkillSeed,
} from "./word-echo";

function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i % seq.length]!;
    i += 1;
    return v;
  };
}

describe("difficultyFromPKnown", () => {
  it("maps band boundaries", () => {
    expect(difficultyFromPKnown(0)).toBe(1);
    expect(difficultyFromPKnown(0.29)).toBe(1);
    expect(difficultyFromPKnown(0.3)).toBe(2);
    expect(difficultyFromPKnown(0.49)).toBe(2);
    expect(difficultyFromPKnown(0.5)).toBe(3);
    expect(difficultyFromPKnown(0.69)).toBe(3);
    expect(difficultyFromPKnown(0.7)).toBe(4);
    expect(difficultyFromPKnown(0.84)).toBe(4);
    expect(difficultyFromPKnown(0.85)).toBe(5);
    expect(difficultyFromPKnown(1)).toBe(5);
  });
});

describe("specForDifficulty", () => {
  it("scales targets, study time, and hint mode", () => {
    expect(specForDifficulty(1)).toEqual({
      targetCount: 2,
      studyMs: 6000,
      hintMode: "blanks",
    });
    expect(specForDifficulty(3)).toEqual({
      targetCount: 3,
      studyMs: 5000,
      hintMode: "length",
    });
    expect(specForDifficulty(5)).toEqual({
      targetCount: 5,
      studyMs: 4000,
      hintMode: "none",
    });
  });
});

describe("WORD_BANK", () => {
  it("is unique lowercase letter words length >= 3", () => {
    const set = new Set(WORD_BANK);
    expect(set.size).toBe(WORD_BANK.length);
    for (const w of WORD_BANK) {
      expect(w).toMatch(/^[a-z]{3,}$/);
    }
  });
});

describe("pickRound", () => {
  it("builds unique targets and hintMode for each difficulty", () => {
    for (let d = 1; d <= 5; d++) {
      const round = pickRound(d, seqRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]));
      const spec = specForDifficulty(d);
      expect(round.targets).toHaveLength(spec.targetCount);
      expect(new Set(round.targets).size).toBe(round.targets.length);
      expect(round.hintMode).toBe(spec.hintMode);
      expect(round.studyMs).toBe(spec.studyMs);
    }
  });
});

describe("normalizeSpelling", () => {
  it("trims, lowers, and strips non-letters", () => {
    expect(normalizeSpelling("  ApPle! ")).toBe("apple");
    expect(normalizeSpelling("a-p-p-l-e")).toBe("apple");
  });
});

describe("spellingHint", () => {
  it("renders blanks, length, or empty", () => {
    expect(spellingHint("echo", "blanks")).toBe("_ _ _ _");
    expect(spellingHint("echo", "length")).toBe("4 letters");
    expect(spellingHint("echo", "none")).toBe("");
  });
});

describe("validateSpelling", () => {
  it("accepts exact spelling ignoring case and junk", () => {
    const res = validateSpelling("apple", " Apple ");
    expect(res.correct).toBe(true);
    expect(res.outcome).toBe("correct");
  });

  it("flags empty, wrong length, and wrong letters", () => {
    expect(validateSpelling("apple", "").correct).toBe(false);
    expect(validateSpelling("apple", "app").message).toMatch(/short/i);
    expect(validateSpelling("apple", "apples").message).toMatch(/long/i);
    expect(validateSpelling("apple", "applx").message).toMatch(/letters/i);
  });
});

describe("wordEchoSkillSeed", () => {
  it("includes skill and targets", () => {
    const round = pickRound(1, () => 0.2);
    const seed = wordEchoSkillSeed(round);
    expect(seed).toMatch(/spelling/);
    expect(seed).toContain(round.targets[0]!);
  });
});
