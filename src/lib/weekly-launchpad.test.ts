import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import { markDeepDiveDone } from "./deep-dive-week";
import { markConnectionShown } from "./connection-card";
import { markFeynmanDone, buildFeynmanTask } from "./feynman-task";
import { reconcileWeeklyGoal } from "./weekly-goal";
import {
  buildWeeklyLaunchpad,
  launchpadKickoff,
  type LaunchpadAction,
} from "./weekly-launchpad";
import type { LearningMemory } from "./learning-memory";

const ACCT = "acct_launchpad";

function memWithSkills(): LearningMemory {
  return {
    topics: [],
    skills: [
      {
        id: "fractions-concepts",
        label: "Fractions",
        pKnown: 0.9,
        mastery: 90,
        attempts: 5,
        lastPracticed: Date.now(),
      },
    ],
    recentStruggles: [],
    recentWins: [],
    sessionDigests: [],
    updatedAt: Date.now(),
  };
}

afterEach(() => {
  kvClearMemory();
});

describe("weekly-launchpad", () => {
  it("starts with everything open for a fresh account", () => {
    const v = buildWeeklyLaunchpad(ACCT, memWithSkills());
    expect(v.totalCount).toBe(4);
    expect(v.doneCount).toBe(0);
    expect(v.items.every((i) => !i.done)).toBe(true);
  });

  it("deep dive counts as done once marked", () => {
    markDeepDiveDone(ACCT);
    const v = buildWeeklyLaunchpad(ACCT, memWithSkills());
    expect(v.items.find((i) => i.key === "deepDive")?.done).toBe(true);
    expect(v.doneCount).toBe(1);
  });

  it("connection counts as done once shown", () => {
    const v0 = buildWeeklyLaunchpad(ACCT, memWithSkills());
    const offer = v0.items.find((i) => i.key === "connection");
    markConnectionShown(ACCT, offer!.action.weekOf);
    const v = buildWeeklyLaunchpad(ACCT, memWithSkills());
    expect(v.items.find((i) => i.key === "connection")?.done).toBe(true);
  });

  it("feynman counts as done once marked", () => {
    const task = buildFeynmanTask(memWithSkills());
    expect(task).not.toBeNull();
    markFeynmanDone(ACCT, task!);
    const v = buildWeeklyLaunchpad(ACCT, memWithSkills());
    expect(v.items.find((i) => i.key === "feynman")?.done).toBe(true);
    expect(v.doneCount).toBe(1);
  });

  it("weekly goal reflects reconcile progress", () => {
    reconcileWeeklyGoal(ACCT, memWithSkills());
    const v = buildWeeklyLaunchpad(ACCT, memWithSkills());
    const goal = v.items.find((i) => i.key === "goal")!;
    expect(goal.done).toBe(false);
    expect(goal.line).toContain("0/3");
  });

  it("all four done yields a full status", () => {
    markDeepDiveDone(ACCT);
    const v0 = buildWeeklyLaunchpad(ACCT, memWithSkills());
    markConnectionShown(ACCT, v0.weekOf);
    const task = buildFeynmanTask(memWithSkills());
    markFeynmanDone(ACCT, task!);
    const v = buildWeeklyLaunchpad(ACCT, memWithSkills());
    expect(v.doneCount).toBe(3); // goal needs 3 newly-mastered skills
    expect(v.items.filter((i) => i.done)).toHaveLength(3);
  });

  it("launchpad kickoffs cover feynman and goal actions", () => {
    const feynman: LaunchpadAction = {
      type: "feynman",
      weekOf: "2026-01-05",
      skillLabel: "Fractions",
    };
    expect(launchpadKickoff(feynman)).toContain("Fractions");
    expect(launchpadKickoff({ type: "goal", weekOf: "2026-01-05" })).toContain(
      "Weekly goal sprint",
    );
    expect(launchpadKickoff({ type: "deepDive", weekOf: "2026-01-05" })).toBe("");
  });
});
