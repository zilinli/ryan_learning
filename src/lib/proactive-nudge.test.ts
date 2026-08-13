import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import { addWrongAnswer, type WrongAnswer } from "./wrong-answer-store";
import {
  buildProactiveInvite,
  dismissProactiveToday,
  dismissedProactiveToday,
  isWrongReviewKickoff,
  loadPendingWrongAt,
  markProactiveShown,
  noteReviewStarted,
  noteWrongAnswerAt,
  pendingReviewSet,
  proactiveShownRecently,
  PROACTIVE_TURNS,
  shouldProactiveInvite,
  turnsSinceLastWrong,
} from "./proactive-nudge";

const ACCT = "acct_proactive";

afterEach(() => {
  kvClearMemory();
});

function seedWrongAnswers(n: number, baseAt = 1000): WrongAnswer[] {
  const items: WrongAnswer[] = [];
  for (let i = 0; i < n; i += 1) {
    items.push(
      addWrongAnswer(ACCT, {
        skillId: `skill-${i}`,
        skillLabel: `Skill ${i}`,
        question: `Question ${i}?`,
        studentAnswer: "my answer",
        assistantText: "hint",
        createdAt: baseAt + i,
      }),
    );
  }
  return items;
}

describe("proactive-nudge: pending wrong-answer tracking", () => {
  it("tracks a wrong answer as pending until a review starts", () => {
    expect(loadPendingWrongAt(ACCT)).toBeNull();
    noteWrongAnswerAt(ACCT, 1000);
    expect(loadPendingWrongAt(ACCT)).toBe(1000);
    noteReviewStarted(ACCT);
    expect(loadPendingWrongAt(ACCT)).toBeNull();
  });

  it("counts turns after the pending wrong answer", () => {
    noteWrongAnswerAt(ACCT, 1000);
    const msgs = [
      { createdAt: 500 },
      { createdAt: 1100 },
      { createdAt: 1200 },
    ];
    expect(turnsSinceLastWrong(msgs, loadPendingWrongAt(ACCT))).toBe(2);
    expect(turnsSinceLastWrong(msgs, null)).toBe(Infinity);
  });

  it("builds a review set from the wrong-answer store (newest first)", () => {
    seedWrongAnswers(3);
    const set = pendingReviewSet(ACCT, 3);
    expect(set).toHaveLength(3);
    expect(set[0].createdAt).toBeGreaterThan(set[1].createdAt);
  });
});

describe("proactive-nudge: eligibility guards", () => {
  it("requires the turns threshold for the recent-wrong path", () => {
    noteWrongAnswerAt(ACCT, 1000);
    const eligible = shouldProactiveInvite(ACCT, {
      reason: "recent-wrong",
      pendingAt: 1000,
      turnsSince: PROACTIVE_TURNS,
    });
    expect(eligible).toBe(true);
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "recent-wrong",
        pendingAt: 1000,
        turnsSince: PROACTIVE_TURNS - 1,
      }),
    ).toBe(false);
  });

  it("P0-3: high-prior learners get only one wrong-answer retry, no idle push", () => {
    noteWrongAnswerAt(ACCT, 1000);
    // recent-wrong allowed (the single "Retry this problem" opportunity)
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "recent-wrong",
        pendingAt: 1000,
        turnsSince: PROACTIVE_TURNS,
        priorTier: "high",
      }),
    ).toBe(true);
    // but no idle pushes for high-prior
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "idle-return",
        priorTier: "high",
      }),
    ).toBe(false);
    // standard tier keeps both behaviors
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "recent-wrong",
        pendingAt: 1000,
        turnsSince: PROACTIVE_TURNS,
        priorTier: "standard",
      }),
    ).toBe(true);
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "idle-return",
        priorTier: "standard",
      }),
    ).toBe(true);
  });

  it("rejects the recent-wrong path when no wrong answer is pending", () => {
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "recent-wrong",
        pendingAt: null,
        turnsSince: PROACTIVE_TURNS,
      }),
    ).toBe(false);
  });

  it("cooldown blocks a second nudge", () => {
    markProactiveShown(ACCT, Date.now());
    expect(proactiveShownRecently(ACCT)).toBe(true);
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "idle-return",
      }),
    ).toBe(false);
  });

  it("dismiss stops nudges for the rest of today", () => {
    dismissProactiveToday(ACCT);
    expect(dismissedProactiveToday(ACCT)).toBe(true);
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "idle-return",
      }),
    ).toBe(false);
  });

  it("dismiss is per-account", () => {
    dismissProactiveToday(ACCT);
    expect(dismissedProactiveToday("acct_other")).toBe(false);
  });

  it("idle-return is allowed when no guards are active", () => {
    expect(
      shouldProactiveInvite(ACCT, {
        reason: "idle-return",
      }),
    ).toBe(true);
  });
});

describe("proactive-nudge: copy & kickoff detection", () => {
  it("builds invite copy that mentions the tricky skill", () => {
    const items = seedWrongAnswers(1);
    const invite = buildProactiveInvite(items, "recent-wrong");
    expect(invite.line).toContain("Skill 0");
    expect(invite.kickoff).toContain("Let's redo the ones I got wrong");
  });

  it("idle-return copy welcomes the child back", () => {
    const items = seedWrongAnswers(1);
    const invite = buildProactiveInvite(items, "idle-return");
    expect(invite.line).toContain("Welcome back");
  });

  it("recognizes wrong-review and variant kickoff texts", () => {
    expect(isWrongReviewKickoff("Let's redo the ones I got wrong. Q1")).toBe(true);
    expect(
      isWrongReviewKickoff("I got this one wrong before — now try a VARIANT"),
    ).toBe(true);
    expect(isWrongReviewKickoff("What is 7 x 8?")).toBe(false);
  });
});
