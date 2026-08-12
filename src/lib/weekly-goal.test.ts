import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import { normalizeMemory } from "./learning-memory";
import {
  loadWeeklyGoal,
  masteredSkillIds,
  reconcileWeeklyGoal,
  WEEKLY_GOAL_TARGET,
  weeklyGoalLine,
  weeklyGoalStorageKey,
  weeklyGoalWeekKey,
} from "./weekly-goal";

const ACCT = "acct_weekly";
const MON = Date.parse("2026-08-10T10:00:00");

function memWith(ids: Array<{ id: string; pKnown: number }>) {
  return normalizeMemory({
    skills: ids.map((s, i) => ({
      id: s.id,
      label: s.id.replace(/-/g, " "),
      topicId: "algebra",
      pKnown: s.pKnown,
      mastery: Math.round(s.pKnown * 100),
      attempts: 5,
      correct: 3,
      incorrect: 2,
      lastSeen: MON,
      sm2State: { ef: 2.5, interval: 3, reps: 2, prevReview: MON - 86_400_000 },
      eloState: { rating: 1300 + i * 100, n: 5, lastUpdate: MON },
    })),
    updatedAt: MON,
  });
}

afterEach(() => {
  kvClearMemory();
  kvRemove(weeklyGoalStorageKey(ACCT));
});

describe("weekly-goal", () => {
  it("week key lands on Monday", () => {
    expect(weeklyGoalWeekKey(Date.parse("2026-08-12T10:00:00"))).toBe("2026-08-10");
    expect(weeklyGoalWeekKey(Date.parse("2026-08-16T10:00:00"))).toBe("2026-08-10");
  });

  it("masteredSkillIds only counts practiced, mastered skills", () => {
    const ids = masteredSkillIds(
      memWith([
        { id: "a", pKnown: 0.9 },
        { id: "b", pKnown: 0.5 },
      ]),
    );
    expect(ids).toEqual(["a"]);
  });

  it("fresh week seeds baseline so nothing new counts yet", () => {
    const goal = reconcileWeeklyGoal(
      ACCT,
      memWith([{ id: "a", pKnown: 0.9 }]),
      MON,
    );
    expect(goal.mastered).toBe(0);
    expect(goal.done).toBe(false);
  });

  it("newly mastered skill within the week is counted", () => {
    reconcileWeeklyGoal(ACCT, memWith([{ id: "a", pKnown: 0.9 }]), MON);
    const goal = reconcileWeeklyGoal(
      ACCT,
      memWith([
        { id: "a", pKnown: 0.9 },
        { id: "b", pKnown: 0.85 },
      ]),
      MON,
    );
    expect(goal.mastered).toBe(1);
    expect(goal.newSkills).toEqual(["b"]);
  });

  it("skills mastered before the week do not count again", () => {
    reconcileWeeklyGoal(ACCT, memWith([{ id: "a", pKnown: 0.9 }]), MON);
    const goal = reconcileWeeklyGoal(
      ACCT,
      memWith([
        { id: "a", pKnown: 0.9 },
        { id: "b", pKnown: 0.85 },
        { id: "c", pKnown: 0.82 },
      ]),
      MON,
    );
    expect(goal.mastered).toBe(2);
  });

  it("new week resets progress", () => {
    reconcileWeeklyGoal(ACCT, memWith([{ id: "a", pKnown: 0.9 }]), MON);
    reconcileWeeklyGoal(
      ACCT,
      memWith([
        { id: "a", pKnown: 0.9 },
        { id: "b", pKnown: 0.85 },
      ]),
      MON,
    );
    const nextWeek = reconcileWeeklyGoal(
      ACCT,
      memWith([
        { id: "a", pKnown: 0.9 },
        { id: "b", pKnown: 0.85 },
      ]),
      Date.parse("2026-08-17T10:00:00"),
    );
    expect(nextWeek.weekOf).toBe("2026-08-17");
    expect(nextWeek.mastered).toBe(0);
  });

  it("goal hit when reaching target", () => {
    const baseline = [
      { id: "s0", pKnown: 0.9 },
      { id: "s1", pKnown: 0.85 },
    ];
    reconcileWeeklyGoal(ACCT, memWith(baseline), MON);
    const skills = [
      ...baseline,
      { id: "s2", pKnown: 0.88 },
      { id: "s3", pKnown: 0.83 },
      { id: "s4", pKnown: 0.8 },
    ];
    const goal = reconcileWeeklyGoal(ACCT, memWith(skills), MON);
    expect(goal.mastered).toBe(3);
    expect(goal.done).toBe(true);
    expect(weeklyGoalLine(goal)).toMatch(/goal hit/);
  });

  it("loadWeeklyGoal is read-only", () => {
    reconcileWeeklyGoal(ACCT, memWith([{ id: "a", pKnown: 0.9 }]), MON);
    reconcileWeeklyGoal(
      ACCT,
      memWith([
        { id: "a", pKnown: 0.9 },
        { id: "b", pKnown: 0.85 },
      ]),
      MON,
    );
    expect(loadWeeklyGoal(ACCT, MON).mastered).toBe(1);
    expect(loadWeeklyGoal("acct_other", MON).mastered).toBe(0);
  });
});
