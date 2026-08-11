import { describe, expect, it } from "vitest";
import { DEFAULT_ELO, DEFAULT_SM2 } from "./bkt";
import type { LearningMemory, SkillMastery } from "./learning-memory";
import {
  buildDailyReviewQueue,
  difficultyFromMastery,
  retrievability,
  reviewQueueSummaryLine,
} from "./review-queue";

function skill(
  partial: Partial<SkillMastery> & { id: string; label: string },
): SkillMastery {
  return {
    topicId: "general",
    pKnown: 0.5,
    mastery: 50,
    attempts: 3,
    correct: 1,
    incorrect: 2,
    lastSeen: Date.now(),
    sm2State: { ...DEFAULT_SM2 },
    eloState: { ...DEFAULT_ELO },
    ...partial,
  };
}

describe("retrievability", () => {
  it("is ~0.9 when t == S", () => {
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 5);
  });

  it("drops as time grows", () => {
    expect(retrievability(10, 5)).toBeLessThan(retrievability(2, 5));
  });
});

describe("difficultyFromMastery", () => {
  it("maps low pKnown to high difficulty", () => {
    expect(difficultyFromMastery(0)).toBe(10);
    expect(difficultyFromMastery(1)).toBe(1);
    expect(difficultyFromMastery(0.5)).toBe(5);
  });
});

describe("buildDailyReviewQueue", () => {
  const now = Date.now();
  const mem: LearningMemory = {
    topics: [],
    skills: [
      skill({
        id: "angles",
        label: "Angles",
        pKnown: 0.4,
        attempts: 4,
        sm2State: {
          ef: 2.5,
          interval: 2,
          reps: 2,
          prevReview: now - 5 * 86_400_000,
        },
      }),
      skill({
        id: "fractions",
        label: "Fractions",
        pKnown: 0.85,
        attempts: 5,
        sm2State: {
          ef: 2.5,
          interval: 7,
          reps: 3,
          prevReview: now - 1 * 86_400_000,
        },
      }),
      skill({
        id: "fresh",
        label: "Fresh",
        attempts: 0,
        sm2State: { ...DEFAULT_SM2 },
      }),
    ],
    recentStruggles: [],
    recentWins: [],
    sessionDigests: [],
    updatedAt: now,
  };

  it("prefers overdue low-R skills and skips zero-attempt", () => {
    const q = buildDailyReviewQueue(mem, { now, limit: 5 });
    expect(q.map((x) => x.skill.id)).toContain("angles");
    expect(q.map((x) => x.skill.id)).not.toContain("fresh");
    expect(q[0]!.skill.id).toBe("angles");
  });

  it("respects reviewedToday skip + limit", () => {
    const q = buildDailyReviewQueue(mem, {
      now,
      limit: 1,
      reviewedTodayIds: ["angles"],
    });
    expect(q.every((x) => x.skill.id !== "angles")).toBe(true);
    expect(q.length).toBeLessThanOrEqual(1);
  });

  it("summary line uses kid-facing Chinese", () => {
    const q = buildDailyReviewQueue(mem, { now, limit: 2 });
    const line = reviewQueueSummaryLine(q);
    expect(line).toMatch(/^今日复习：/);
  });
});
