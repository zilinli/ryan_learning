import { describe, expect, it } from "vitest";
import { normalizeMemory } from "./learning-memory";
import {
  pickRecurringGapSkill,
  pruneGapHistory,
  recordGapsFromMemory,
  recurringGapSkills,
} from "./knowledge-gaps";

function weakMem() {
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
        sm2State: { ef: 2.2, interval: 1, reps: 1, prevReview: now },
        eloState: { rating: 1200, n: 5, lastUpdate: now },
      },
    ],
    updatedAt: now,
  });
}

describe("knowledge-gaps (A3)", () => {
  it("records and finds recurring gaps across days", () => {
    const mem = weakMem();
    const d1 = new Date("2026-08-08T12:00:00");
    const d2 = new Date("2026-08-09T12:00:00");
    let gaps = recordGapsFromMemory([], mem, d1);
    gaps = recordGapsFromMemory(gaps, mem, d2);
    const rec = recurringGapSkills(gaps, 2, d2.getTime());
    expect(rec[0]?.skillId).toBe("fractions-concepts");
    expect(pickRecurringGapSkill(gaps, mem)?.id).toBe("fractions-concepts");
  });

  it("prunes expired gaps", () => {
    const now = Date.now();
    const pruned = pruneGapHistory(
      [
        {
          skillId: "x",
          label: "X",
          days: ["2026-01-01"],
          expiresAt: now - 1000,
        },
      ],
      now,
    );
    expect(pruned).toEqual([]);
  });
});
