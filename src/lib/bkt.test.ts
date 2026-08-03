import { describe, expect, it } from "vitest";
import {
  applySm2Decay,
  bktUpdate,
  DEFAULT_BKT,
  DEFAULT_SM2,
  difficultyAdjustedBktParams,
  eloUpdate,
  masteryFromPKnown,
  outcomeToSm2Quality,
  pKnownFromMastery,
  pSolve,
  sm2Update,
  softBktUpdate,
  zpdScore,
  type Sm2State,
} from "./bkt";

describe("bktUpdate", () => {
  it("correct answer raises P(known)", () => {
    const before = 0.25;
    const after = bktUpdate(before, true);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThan(1);
  });

  it("incorrect answer lowers P(known)", () => {
    const before = 0.8;
    const after = bktUpdate(before, false);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it("stays within [0.001, 0.999]", () => {
    expect(bktUpdate(0.999, true)).toBeLessThanOrEqual(0.999);
    expect(bktUpdate(0.001, false)).toBeGreaterThanOrEqual(0.001);
  });

  it("multiple corrects approach ceiling", () => {
    let p = 0.25;
    for (let i = 0; i < 10; i++) p = bktUpdate(p, true);
    expect(p).toBeGreaterThan(0.85);
  });

  it("multiple incorrects drop toward floor", () => {
    let p = 0.8;
    for (let i = 0; i < 8; i++) p = bktUpdate(p, false);
    expect(p).toBeLessThan(0.3);
  });

  it("slip does not crash when fully mastered", () => {
    const p = bktUpdate(0.95, false);
    expect(p).toBeGreaterThan(0.7);   // slip + learn steps together
    expect(p).toBeLessThan(0.95);
  });
});

describe("softBktUpdate", () => {
  it("treats correct like bktUpdate correct", () => {
    expect(softBktUpdate(0.25, "correct")).toBe(bktUpdate(0.25, true));
  });

  it("treats incorrect like bktUpdate incorrect", () => {
    expect(softBktUpdate(0.8, "incorrect")).toBe(bktUpdate(0.8, false));
  });

  it("practice nudges slightly upward", () => {
    const before = 0.25;
    const after = softBktUpdate(before, "practice");
    expect(after).toBeGreaterThan(before);
  });

  it("practice is weaker than correct", () => {
    const pPractice = softBktUpdate(0.25, "practice");
    const pCorrect = softBktUpdate(0.25, "correct");
    expect(pCorrect).toBeGreaterThan(pPractice);
  });
});

describe("mastery helpers", () => {
  it("round-trips pKnown ↔ mastery", () => {
    expect(masteryFromPKnown(0.25)).toBe(25);
    expect(masteryFromPKnown(0.0)).toBe(0);
    expect(masteryFromPKnown(1)).toBe(100);
    expect(pKnownFromMastery(40)).toBeCloseTo(0.4, 1);
  });
});

// ── SM-2 Spaced Repetition ────────────────────────────────────────

describe("applySm2Decay", () => {
  it("returns unchanged pKnown for fresh skill (prevReview = 0)", () => {
    const sm2: Sm2State = { ...DEFAULT_SM2, prevReview: 0 };
    const result = applySm2Decay(0.8, sm2, Date.now());
    expect(result).toBe(0.8);
  });

  it("returns unchanged pKnown when reviewed very recently (< 0.5 days)", () => {
    const now = Date.now();
    const sm2: Sm2State = { ...DEFAULT_SM2, prevReview: now - 1000, interval: 7 };
    const result = applySm2Decay(0.8, sm2, now);
    expect(result).toBe(0.8);
  });

  it("decays pKnown after several days without review", () => {
    const now = Date.now();
    const longAgo = now - 10 * 86_400_000; // 10 days ago
    const sm2: Sm2State = { ef: 2.5, interval: 1, reps: 2, prevReview: longAgo };
    const result = applySm2Decay(0.8, sm2, now);
    expect(result).toBeLessThan(0.8);
    expect(result).toBeGreaterThan(0);
  });

  it("decay is stronger when skill is overdue by more days", () => {
    const now = Date.now();
    const week = now - 7 * 86_400_000;
    const month = now - 30 * 86_400_000;
    const sm2: Sm2State = { ef: 2.5, interval: 3, reps: 2, prevReview: 0 };
    const decayedWeek = applySm2Decay(0.9, { ...sm2, prevReview: week }, now);
    const decayedMonth = applySm2Decay(0.9, { ...sm2, prevReview: month }, now);
    expect(decayedMonth).toBeLessThan(decayedWeek);
  });

  it("longer SM2 interval means slower decay", () => {
    const now = Date.now();
    const ago = now - 7 * 86_400_000;
    const shortInt: Sm2State = { ef: 2.5, interval: 1, reps: 1, prevReview: ago };
    const longInt: Sm2State = { ef: 2.5, interval: 14, reps: 5, prevReview: ago };
    const decayedShort = applySm2Decay(0.9, shortInt, now);
    const decayedLong = applySm2Decay(0.9, longInt, now);
    expect(decayedLong).toBeGreaterThan(decayedShort);
  });
});

describe("sm2Update", () => {
  it("returns default SM2 for quality < 3 (fail)", () => {
    const sm2: Sm2State = { ef: 2.5, interval: 7, reps: 3, prevReview: 1000 };
    const result = sm2Update(sm2, 1, 2000);
    expect(result.reps).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.prevReview).toBe(2000);
  });

  it("updates interval for first correct repetition", () => {
    const sm2: Sm2State = { ...DEFAULT_SM2, prevReview: 1000 };
    const result = sm2Update(sm2, 4, 2000);
    expect(result.reps).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("updates interval for second correct repetition", () => {
    const sm2: Sm2State = { ef: 2.5, interval: 1, reps: 1, prevReview: 1000 };
    const result = sm2Update(sm2, 4, 2000);
    expect(result.reps).toBe(2);
    expect(result.interval).toBe(6);
  });

  it("grows interval exponentially for repeated corrects", () => {
    const sm2: Sm2State = { ef: 2.5, interval: 6, reps: 2, prevReview: 1000 };
    const result = sm2Update(sm2, 4, 2000);
    expect(result.reps).toBe(3);
    expect(result.interval).toBe(15); // interval * ef = 6 * 2.5 = 15
  });

  it("clamps easiness factor at minimum 1.3", () => {
    const sm2: Sm2State = { ef: 1.3, interval: 7, reps: 3, prevReview: 1000 };
    // Quality 0 → worst possible, EF should stay at 1.3
    const result = sm2Update(sm2, 0, 2000);
    expect(result.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("quality 5 perfect answer raises easiness", () => {
    const sm2: Sm2State = { ef: 2.0, interval: 1, reps: 0, prevReview: 1000 };
    const result = sm2Update(sm2, 5, 2000);
    expect(result.ef).toBeGreaterThan(2.0);
  });
});

describe("outcomeToSm2Quality", () => {
  it("maps correct to 4 (good)", () => {
    expect(outcomeToSm2Quality("correct")).toBe(4);
  });

  it("maps incorrect to 2 (just barely wrong)", () => {
    expect(outcomeToSm2Quality("incorrect")).toBe(2);
  });

  it("maps practice to 3 (passable)", () => {
    expect(outcomeToSm2Quality("practice")).toBe(3);
  });

  it("high-confidence correct → 5 (perfect)", () => {
    expect(outcomeToSm2Quality("correct", 3)).toBe(5);
  });

  it("high-confidence wrong → 0 (total blackout)", () => {
    expect(outcomeToSm2Quality("incorrect", 3)).toBe(0);
  });

  it("medium-confidence wrong → 1", () => {
    expect(outcomeToSm2Quality("incorrect", 2)).toBe(1);
  });
});

// ── ZPD Scoring ───────────────────────────────────────────────────

describe("zpdScore", () => {
  it("peaks at P(known) = 0.7", () => {
    const atTarget = zpdScore(0.7);
    const offTarget = zpdScore(0.4);
    expect(atTarget).toBeGreaterThan(offTarget);
  });

  it("returns 1.0 for perfect ZPD match", () => {
    const score = zpdScore(0.7);
    // With dist=0, exp(0) = 1
    expect(score).toBeCloseTo(1.0, 3);
  });

  it("scores very low for fully mastered skills (P > 0.95)", () => {
    const mastered = zpdScore(0.95);
    const target = zpdScore(0.7);
    // ZPD: 0.95 is far from target 0.7, so score should be meaningfully lower
    expect(mastered).toBeLessThan(target);
    expect(mastered).toBeLessThan(0.75);
  });

  it("scores low for completely unknown skills (P < 0.15)", () => {
    const unknown = zpdScore(0.1);
    const target = zpdScore(0.7);
    expect(unknown).toBeLessThan(target * 0.3);
  });

  it("monotonically increasing then decreasing around peak", () => {
    // Scores should rise from 0.3 → 0.7 and fall from 0.7 → 1.0
    expect(zpdScore(0.7)).toBeGreaterThan(zpdScore(0.6));
    expect(zpdScore(0.7)).toBeGreaterThan(zpdScore(0.8));
    expect(zpdScore(0.5)).toBeGreaterThan(zpdScore(0.2));
    expect(zpdScore(0.9)).toBeGreaterThan(zpdScore(0.99));
  });
});

describe("pSolve", () => {
  it("approximates P(solve) from pKnown", () => {
    const ps = pSolve(0.8);
    expect(ps).toBeGreaterThan(0.7);
    expect(ps).toBeLessThan(0.95);
  });

  it("low pKnown gives low pSolve", () => {
    expect(pSolve(0.1)).toBeLessThan(0.3);
  });

  it("accounts for slip and guess", () => {
    const withoutGuess = pSolve(0.0, 0.1, 0.0);
    expect(withoutGuess).toBe(0);
    const withGuess = pSolve(0.0, 0.1, 0.2);
    expect(withGuess).toBeCloseTo(0.2, 1);
  });
});

// ── Elo-hybrid Difficulty Tracking (Phase 1.6) ──────────────

describe("eloUpdate", () => {
  const now = 1700000000000;
  const base = { rating: 1500, n: 0, lastUpdate: 0 };

  it("decreases Elo on incorrect (student fell short of expectation)", () => {
    const next = eloUpdate(base, "incorrect", now);
    expect(next.rating).toBeLessThan(1500);
    expect(next.n).toBe(1);
    expect(next.lastUpdate).toBe(now);
  });

  it("increases Elo on correct (student beat expectation)", () => {
    const next = eloUpdate(base, "correct", now);
    expect(next.rating).toBeGreaterThan(1500);
  });

  it("small adjustment on practice outcome", () => {
    const next = eloUpdate(base, "practice", now);
    expect(next.rating).toBeGreaterThan(1490);
    expect(next.rating).toBeLessThan(1520);
  });

  it("dynamic K-value decreases with more attempts", () => {
    const first = eloUpdate(base, "incorrect", now);
    const mid = eloUpdate({ ...base, rating: first.rating, n: 5, lastUpdate: now }, "incorrect", now);
    const many = eloUpdate({ ...base, rating: mid.rating, n: 10, lastUpdate: now }, "incorrect", now);
    const deltaFirst = Math.abs(first.rating - base.rating);
    const deltaMid = Math.abs(mid.rating - first.rating);
    const deltaMany = Math.abs(many.rating - mid.rating);
    expect(deltaMid).toBeLessThanOrEqual(deltaFirst);
    expect(deltaMany).toBeLessThanOrEqual(deltaMid);
  });

  it("clamps rating between 800 and 2600", () => {
    let elo = base;
    for (let i = 0; i < 100; i++) elo = eloUpdate(elo, "correct", now + i);
    expect(elo.rating).toBeGreaterThanOrEqual(800);

    elo = base;
    for (let i = 0; i < 100; i++) elo = eloUpdate(elo, "incorrect", now + i);
    expect(elo.rating).toBeLessThanOrEqual(2600);
  });
});

describe("difficultyAdjustedBktParams", () => {
  it("returns higher slip for harder items", () => {
    const easy = difficultyAdjustedBktParams({ rating: 1000, n: 10, lastUpdate: 0 });
    const hard = difficultyAdjustedBktParams({ rating: 2000, n: 10, lastUpdate: 0 });
    expect(hard.pSlip).toBeGreaterThan(easy.pSlip);
  });

  it("returns lower guess for harder items", () => {
    const easy = difficultyAdjustedBktParams({ rating: 1000, n: 10, lastUpdate: 0 });
    const hard = difficultyAdjustedBktParams({ rating: 2000, n: 10, lastUpdate: 0 });
    expect(hard.pGuess).toBeLessThan(easy.pGuess);
  });

  it("all values stay in [0,1] for any rating", () => {
    for (const rating of [800, 1200, 1500, 1800, 2200, 2600]) {
      const params = difficultyAdjustedBktParams({ rating, n: 1, lastUpdate: 0 });
      expect(params.pSlip).toBeGreaterThan(0);
      expect(params.pSlip).toBeLessThan(1);
      expect(params.pGuess).toBeGreaterThan(0);
      expect(params.pGuess).toBeLessThan(1);
    }
  });
});
