import { describe, expect, it } from "vitest";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import { buildParentDailyDigest } from "./parent-digest";

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
});
