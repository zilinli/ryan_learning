import { describe, expect, it } from "vitest";
import {
  WORD_BANK,
  difficultyFromPKnown,
  pickRound,
  shuffle,
  specForDifficulty,
  validateEcho,
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
  it("scales targets and study time", () => {
    expect(specForDifficulty(1)).toEqual({
      targetCount: 3,
      distractorCount: 3,
      studyMs: 5000,
      requireOrder: false,
    });
    expect(specForDifficulty(5)).toEqual({
      targetCount: 7,
      distractorCount: 7,
      studyMs: 3000,
      requireOrder: true,
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
  it("builds a valid pool for each difficulty", () => {
    for (let d = 1; d <= 5; d++) {
      const round = pickRound(d, seqRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]));
      const spec = specForDifficulty(d);
      expect(round.targets).toHaveLength(spec.targetCount);
      expect(round.pool).toHaveLength(spec.targetCount + spec.distractorCount);
      expect(new Set(round.pool).size).toBe(round.pool.length);
      for (const t of round.targets) {
        expect(round.pool).toContain(t);
      }
      expect(round.requireOrder).toBe(spec.requireOrder);
      expect(round.studyMs).toBe(spec.studyMs);
    }
  });
});

describe("validateEcho", () => {
  const base = pickRound(2, () => 0.42);

  it("accepts the exact target set (any order)", () => {
    const selected = shuffle(base.targets, () => 0.7);
    const res = validateEcho(base, selected);
    expect(res.correct).toBe(true);
    expect(res.outcome).toBe("correct");
    expect(res.missing).toEqual([]);
    expect(res.extra).toEqual([]);
  });

  it("flags missing and extra", () => {
    const missingOne = base.targets.slice(1);
    const distractor = base.pool.find((w) => !base.targets.includes(w))!;
    const res = validateEcho(base, [...missingOne, distractor]);
    expect(res.correct).toBe(false);
    expect(res.missing).toContain(base.targets[0]!);
    expect(res.extra).toContain(distractor);
  });

  it("requires order on high difficulty", () => {
    const ordered = pickRound(4, seqRng([0.15, 0.25, 0.35, 0.45, 0.55, 0.65]));
    expect(ordered.requireOrder).toBe(true);
    const wrongOrder = [...ordered.targets].reverse();
    const bad = validateEcho(ordered, wrongOrder);
    expect(bad.correct).toBe(false);
    const good = validateEcho(ordered, ordered.targets.slice());
    expect(good.correct).toBe(true);
  });
});

describe("wordEchoSkillSeed", () => {
  it("includes skill and targets", () => {
    const round = pickRound(1, () => 0.2);
    const seed = wordEchoSkillSeed(round);
    expect(seed).toMatch(/sight word/);
    expect(seed).toContain(round.targets[0]!);
  });
});
