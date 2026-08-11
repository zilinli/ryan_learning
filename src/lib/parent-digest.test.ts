import { describe, expect, it } from "vitest";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import {
  buildParentDailyDigest,
  buildParentWeeklyDigest,
} from "./parent-digest";

function mem(): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.3,
        mastery: 30,
        attempts: 5,
        correct: 1,
        incorrect: 4,
        lastSeen: now,
        sm2State: { ef: 2.2, interval: 3, reps: 1, prevReview: now - 86_400_000 },
        eloState: { rating: 1200, n: 5, lastUpdate: now },
        misconceptionHits: [
          { id: "frac-add-denom", count: 4, lastSeen: now },
        ],
      },
      {
        id: "place-value",
        label: "Place value",
        topicId: "place-value",
        pKnown: 0.45,
        mastery: 45,
        attempts: 3,
        correct: 1,
        incorrect: 2,
        lastSeen: now - 1000,
        sm2State: { ef: 2.5, interval: 2, reps: 1, prevReview: now },
        eloState: { rating: 1300, n: 3, lastUpdate: now },
      },
    ],
    updatedAt: now,
  });
}

describe("parent-digest (D2)", () => {
  it("PD1: empty memory → idle one-liner", () => {
    expect(buildParentDailyDigest(null)).toMatch(/no skill activity/i);
  });

  it("PD2: weak skill appears in digest", () => {
    const line = buildParentDailyDigest(mem());
    expect(line).toMatch(/Fraction concepts|Place value/);
    expect(line.length).toBeLessThanOrEqual(280);
  });

  it("R6: weekly digest includes practiced, misconceptions, focus", () => {
    const w = buildParentWeeklyDigest(mem());
    expect(w.practiced.some((p) => p.id === "fractions-concepts")).toBe(true);
    expect(w.topMisconceptions[0]?.id).toBe("frac-add-denom");
    expect(w.nextWeekFocus.length).toBeGreaterThan(0);
    expect(w.text).toMatch(/Week of/);
    expect(w.text).toMatch(/Frequent patterns|Adding across/i);
    expect(w.text).toMatch(/Next week focus/);
  });

  it("AUD.6a: idle ≥3d appears in daily + weekly digests", () => {
    const now = Date.now();
    const idleMem = normalizeMemory({
      skills: [
        {
          id: "fractions-concepts",
          label: "Fraction concepts",
          topicId: "fractions",
          pKnown: 0.3,
          mastery: 30,
          attempts: 5,
          correct: 1,
          incorrect: 4,
          lastSeen: now - 4 * 86_400_000,
          sm2State: {
            ef: 2.2,
            interval: 3,
            reps: 1,
            prevReview: now - 10 * 86_400_000,
          },
          eloState: { rating: 1200, n: 5, lastUpdate: now },
        },
      ],
      updatedAt: now,
    });
    const daily = buildParentDailyDigest(idleMem, now);
    expect(daily).toMatch(/Past 4 days unused/);
    const weekly = buildParentWeeklyDigest(idleMem, now);
    expect(weekly.idleDays).toBe(4);
    expect(weekly.text).toMatch(/Past 4 days unused/);
  });
});
