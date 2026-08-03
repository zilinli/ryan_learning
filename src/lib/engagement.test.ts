import { describe, expect, it } from "vitest";
import { emptyEngagement, engagementForPrompt, engagementSummary, loadEngagement, recordLearningTurn, saveEngagement } from "./engagement";

describe("engagement state", () => {
  it("emptyEngagement returns zero state", () => {
    const e = emptyEngagement();
    expect(e.streak).toBe(0);
    expect(e.solvesToday).toBe(0);
    expect(e.totalSolves).toBe(0);
    expect(e.badges).toEqual([]);
    expect(e.lastActiveDay).toBe("");
  });

  it("recordLearningTurn starts streak on first turn", () => {
    const next = recordLearningTurn(emptyEngagement());
    expect(next.streak).toBe(1);
    expect(next.solvesToday).toBe(1);
    expect(next.totalSolves).toBe(1);
    expect(next.lastActiveDay).not.toBe("");
  });

  it("recordLearningTurn increments within same day", () => {
    const first = recordLearningTurn(emptyEngagement());
    const second = recordLearningTurn(first);
    expect(second.streak).toBe(first.streak);
    expect(second.solvesToday).toBe(2);
    expect(second.totalSolves).toBe(2);
  });

  it("recordLearningTurn continues streak on consecutive days", () => {
    const today = new Date();
    const yday = new Date(today);
    yday.setDate(yday.getDate() - 1);
    const ydayKey = `${yday.getFullYear()}-${String(yday.getMonth() + 1).padStart(2, "0")}-${String(yday.getDate()).padStart(2, "0")}`;

    const prev = {
      ...emptyEngagement(),
      streak: 3,
      lastActiveDay: ydayKey,
      solvesToday: 5,
      totalSolves: 15,
    };
    const next = recordLearningTurn(prev);
    expect(next.streak).toBe(4);
    expect(next.solvesToday).toBe(1);
  });

  it("recordLearningTurn resets streak on missed day", () => {
    const prev = {
      ...emptyEngagement(),
      streak: 5,
      lastActiveDay: "2020-01-01",
      solvesToday: 3,
      totalSolves: 30,
    };
    const next = recordLearningTurn(prev);
    expect(next.streak).toBe(1);
    expect(next.solvesToday).toBe(1);
  });

  it("unlocks 3-day streak badge", () => {
    const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const prev = {
      ...emptyEngagement(),
      streak: 3,
      lastActiveDay: yday,
      totalSolves: 9,
    };
    const next = recordLearningTurn(prev);
    expect(next.streak).toBeGreaterThanOrEqual(3);
    expect(next.badges).toContain("3-day streak");
  });

  it("unlocks curious mind badge at 10 solves", () => {
    const prev = {
      ...emptyEngagement(),
      streak: 1,
      lastActiveDay: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      totalSolves: 9,
    };
    const next = recordLearningTurn(prev);
    expect(next.badges).toContain("Curious mind");
  });

  it("unlocks daily goal badge at 3 solves today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const prev = {
      ...emptyEngagement(),
      lastActiveDay: today,
      streak: 1,
      solvesToday: 2,
      totalSolves: 4,
    };
    const next = recordLearningTurn(prev);
    expect(next.solvesToday).toBe(3);
    expect(next.badges).toContain("Daily goal ✓");
  });
});

describe("engagementSummary", () => {
  it("renders streak and day count", () => {
    const state = {
      ...emptyEngagement(),
      streak: 5,
      lastActiveDay: "2026-08-03",
      solvesToday: 2,
      totalSolves: 20,
      badges: ["3-day streak"],
    };
    const summary = engagementSummary(state);
    expect(summary).toContain("🔥 5d");
    expect(summary).toContain("今日 2/3");
    expect(summary).toContain("3-day streak");
  });
});

describe("engagementForPrompt", () => {
  it("slices badges array to last 3 items", () => {
    const state = {
      ...emptyEngagement(),
      badges: ["a", "b", "c", "d", "e"],
    };
    const prompt = engagementForPrompt(state);
    expect(prompt.badges).toHaveLength(3);
    expect(prompt.badges).toEqual(["c", "d", "e"]);
  });

  it("preserves essential fields", () => {
    const state = {
      ...emptyEngagement(),
      streak: 4,
      lastActiveDay: "2026-08-03",
      solvesToday: 2,
      totalSolves: 12,
    };
    const prompt = engagementForPrompt(state);
    expect(prompt.streak).toBe(4);
    expect(prompt.solvesToday).toBe(2);
    expect(prompt.totalSolves).toBe(12);
  });
});
