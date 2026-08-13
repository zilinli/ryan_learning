import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import {
  buildFocusGuardrail,
  dismissFocusGuardrail,
  dismissedFocusGuardrailToday,
  focusGuardrailDismissKey,
  resolveGuardrailAccountId,
} from "./focus-guardrail";
import type { ConversationRecord, ConversationWorksheetPlan } from "./types";

const ACCT = "acct_guard";

function plan(total: number, current: number): ConversationWorksheetPlan {
  return {
    total,
    current,
    items: Array.from({ length: total }, (_, i) => ({
      id: i,
      label: `Q${i + 1}`,
      status: i < current ? "done" : "pending",
    })),
    source: "agent",
    updatedAt: Date.now(),
  };
}

function conv(
  sessionId: string,
  worksheetPlan?: ConversationWorksheetPlan,
): ConversationRecord {
  return {
    sessionId,
    title: sessionId,
    messages: [],
    createdAt: 1,
    updatedAt: 2,
    worksheetPlan,
  };
}

const DONE_PLAN = plan(3, 3).items.map((it) => ({
  ...it,
  status: "done" as const,
}));

afterEach(() => {
  kvClearMemory();
  kvRemove(focusGuardrailDismissKey(ACCT));
});

describe("focus-guardrail", () => {
  it("returns remaining questions for an in-progress worksheet", () => {
    const g = buildFocusGuardrail(
      ACCT,
      [conv("s1", plan(5, 2))],
      "s1",
    );
    expect(g).not.toBeNull();
    expect(g!.remaining).toBe(3);
    expect(g!.total).toBe(5);
    expect(g!.line).toContain("3 questions");
  });

  it("returns null when the worksheet is complete", () => {
    const g = buildFocusGuardrail(
      ACCT,
      [{ ...conv("s1", plan(3, 3)), worksheetPlan: { ...plan(3, 3), items: DONE_PLAN } }],
      "s1",
    );
    expect(g).toBeNull();
  });

  it("returns null when there is no worksheet plan", () => {
    expect(buildFocusGuardrail(ACCT, [conv("s1")], "s1")).toBeNull();
  });

  it("returns null when the active conversation has no worksheet", () => {
    const g = buildFocusGuardrail(ACCT, [conv("s1", plan(4, 1)), conv("s2")], "s2");
    expect(g).toBeNull();
  });

  it("single question copy is singular", () => {
    const g = buildFocusGuardrail(ACCT, [conv("s1", plan(2, 1))], "s1");
    expect(g!.remaining).toBe(1);
    expect(g!.line).toContain("1 question");
  });

  it("dismiss gates the nudge for the rest of today", () => {
    const accountId = resolveGuardrailAccountId(ACCT);
    expect(accountId).toBe(ACCT);
    expect(dismissedFocusGuardrailToday(ACCT)).toBe(false);
    dismissFocusGuardrail(ACCT);
    expect(dismissedFocusGuardrailToday(ACCT)).toBe(true);
  });

  it("dismiss is per-account", () => {
    dismissFocusGuardrail(ACCT);
    expect(dismissedFocusGuardrailToday(ACCT)).toBe(true);
    expect(dismissedFocusGuardrailToday("acct_other")).toBe(false);
  });
});
