import { beforeEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  clearActiveFocusSession,
  endFocusSession,
  focusProgress,
  focusRemainingMs,
  focusSessionsThisWeek,
  isFocusExpired,
  loadActiveFocusSession,
  recentFocusRecords,
  startFocusSession,
} from "./focus-session";

const ACCOUNT = "acct_focus_test";

beforeEach(() => {
  kvClearMemory();
  clearActiveFocusSession();
});

describe("focus-session", () => {
  it("starts and loads an active session", () => {
    const now = 1_700_000_000_000;
    const active = startFocusSession(ACCOUNT, { minutes: 20, now, label: "Math" });
    expect(active.durationMs).toBe(20 * 60_000);
    expect(loadActiveFocusSession()?.accountId).toBe(ACCOUNT);
    expect(focusRemainingMs(active, now + 5 * 60_000)).toBe(15 * 60_000);
    expect(focusProgress(active, now + 10 * 60_000)).toBeCloseTo(0.5);
    expect(isFocusExpired(active, now + 21 * 60_000)).toBe(true);
  });

  it("ends with a completed record near full duration", () => {
    const now = 1_700_000_000_000;
    startFocusSession(ACCOUNT, { minutes: 20, now });
    const result = endFocusSession(ACCOUNT, {
      now: now + 18 * 60_000,
      turns: 4,
    });
    expect(result).not.toBeNull();
    expect(result!.record.completed).toBe(true);
    expect(result!.summaryLine).toMatch(/Focus complete/);
    expect(loadActiveFocusSession()).toBeNull();
    expect(recentFocusRecords(ACCOUNT)[0]?.turns).toBe(4);
  });

  it("early end still records but not completed", () => {
    const now = 1_700_000_000_000;
    startFocusSession(ACCOUNT, { minutes: 20, now });
    const result = endFocusSession(ACCOUNT, { now: now + 3 * 60_000 });
    expect(result!.record.completed).toBe(false);
    expect(result!.summaryLine).toMatch(/early/);
  });

  it("counts completed sessions this week", () => {
    const now = 1_700_000_000_000;
    startFocusSession(ACCOUNT, { minutes: 10, now: now - 60_000 });
    endFocusSession(ACCOUNT, { now, forceComplete: true });
    expect(focusSessionsThisWeek(ACCOUNT, now)).toBe(1);
  });
});
