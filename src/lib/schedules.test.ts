import { afterEach, describe, expect, it } from "vitest";
import type { WrongAnswer } from "./wrong-answer-store";
import {
  dueReviews,
  effectiveReviewStage,
  isReviewScheduleComplete,
  MASTERED_PKNOWN,
  retentionStages,
  reviewStageAfterOutcome,
  scheduleReview,
} from "./schedules";

const DAY = 86_400_000;

function wa(
  partial: Partial<WrongAnswer> & Pick<WrongAnswer, "id" | "skillId">,
): WrongAnswer {
  return {
    id: partial.id,
    accountId: "a",
    skillId: partial.skillId,
    skillLabel: partial.skillLabel ?? "Fractions",
    question: partial.question ?? "What is 1/2 + 1/4?",
    studentAnswer: partial.studentAnswer ?? "wrong",
    assistantText: partial.assistantText ?? "hint",
    createdAt: partial.createdAt ?? 1_000,
    reviewStage: partial.reviewStage,
    nextReviewAt: partial.nextReviewAt,
  };
}

describe("schedules — P0-1 错题间隔复测", () => {
  const now = 10 * DAY;

  it("T1 到期计算：stage 0 为 1 天后；答对晋级，答错重置", () => {
    const from = 5 * DAY;
    expect(scheduleReview("fractions", 0, { fromMs: from })).toBe(
      from + retentionStages[0]! * DAY,
    );
    expect(scheduleReview("fractions", 1, { fromMs: from })).toBe(
      from + retentionStages[1]! * DAY,
    );
    expect(reviewStageAfterOutcome(0, true)).toBe(1);
    expect(reviewStageAfterOutcome(1, true)).toBe(2);
    expect(reviewStageAfterOutcome(2, false)).toBe(0);
  });

  it("T2 掌握降频：pKnown≥0.8 不再 schedule / due", () => {
    expect(
      scheduleReview("fractions", 0, { pKnown: MASTERED_PKNOWN }),
    ).toBeNull();
    expect(isReviewScheduleComplete(0, MASTERED_PKNOWN)).toBe(true);
    const book = [
      wa({
        id: "1",
        skillId: "fractions",
        nextReviewAt: now - DAY,
        reviewStage: 0,
      }),
    ];
    const due = dueReviews(book, now, () => MASTERED_PKNOWN);
    expect(due).toHaveLength(0);
  });

  it("T3 兼容：旧条目无 reviewStage 视为 stage 0", () => {
    const legacy = wa({
      id: "old",
      skillId: "algebra",
      createdAt: now - 2 * DAY,
    });
    expect(effectiveReviewStage(legacy)).toBe(0);
    const due = dueReviews([legacy], now);
    expect(due).toHaveLength(1);
    expect(due[0]?.item.id).toBe("old");
  });

  it("T4 排序：overdue 更久者在前", () => {
    const book = [
      wa({
        id: "recent",
        skillId: "a",
        nextReviewAt: now - DAY,
        reviewStage: 0,
      }),
      wa({
        id: "stale",
        skillId: "b",
        nextReviewAt: now - 5 * DAY,
        reviewStage: 1,
      }),
    ];
    const due = dueReviews(book, now);
    expect(due.map((d) => d.item.id)).toEqual(["stale", "recent"]);
    expect(due[0]!.overdueMs).toBeGreaterThan(due[1]!.overdueMs);
  });

  it("未到期的条目不出现在 due 列表", () => {
    const future = wa({
      id: "f",
      skillId: "c",
      nextReviewAt: now + DAY,
      reviewStage: 0,
    });
    expect(dueReviews([future], now)).toHaveLength(0);
  });
});
