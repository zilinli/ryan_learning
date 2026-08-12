/**
 * P2 (report §8.8) — short-cycle weekly goal: "master 3 new skills this week".
 * Tracks skills whose BKT mastery crosses the 0.8 threshold within the current
 * week (baseline = skills already mastered when the week first opens).
 */

import { kvGet, kvSet } from "./browser-kv";
import type { LearningMemory } from "./learning-memory";

export const WEEKLY_GOAL_TARGET = 3;
const MASTERED_THRESHOLD = 0.8;

export type WeeklyGoal = {
  /** Monday (YYYY-MM-DD) of the goal's week */
  weekOf: string;
  target: number;
  /** Number of skills first mastered during this week */
  mastered: number;
  /** Ids of those newly-mastered skills */
  newSkills: string[];
  /** True when mastered >= target */
  done: boolean;
};

type Stored = { weekOf: string; baseline: string[]; seen: string[] };

/** Monday (YYYY-MM-DD) of the week containing `now`. */
export function weeklyGoalWeekKey(now = Date.now()): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset),
  )
    .toISOString()
    .slice(0, 10);
}

export function weeklyGoalStorageKey(accountId: string): string {
  return `spark.weeklyGoal.${accountId || "default"}`;
}

/** Ids of skills currently at or above the mastery threshold. */
export function masteredSkillIds(mem: LearningMemory | null | undefined): string[] {
  if (!mem?.skills?.length) return [];
  return mem.skills
    .filter((s) => s.attempts > 0 && s.pKnown >= MASTERED_THRESHOLD)
    .map((s) => s.id);
}

function readStored(accountId: string): Stored | null {
  try {
    const raw = kvGet(weeklyGoalStorageKey(accountId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Stored>;
    if (!p || typeof p.weekOf !== "string") return null;
    return {
      weekOf: p.weekOf,
      baseline: Array.isArray(p.baseline) ? p.baseline : [],
      seen: Array.isArray(p.seen) ? p.seen : [],
    };
  } catch {
    return null;
  }
}

function writeStored(accountId: string, st: Stored): void {
  kvSet(weeklyGoalStorageKey(accountId), JSON.stringify(st));
}

/** Reconcile against current memory; call after any learning turn. */
export function reconcileWeeklyGoal(
  accountId: string,
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): WeeklyGoal {
  const weekOf = weeklyGoalWeekKey(now);
  const mastered = new Set(masteredSkillIds(mem));
  const prev = readStored(accountId);

  let baseline: string[];
  let seen: string[];
  if (!prev || prev.weekOf !== weekOf) {
    // Fresh week — current masters become the baseline so only NEW mastery counts.
    baseline = [...mastered];
    seen = [];
  } else {
    baseline = prev.baseline;
    seen = prev.seen;
    for (const id of mastered) {
      if (!baseline.includes(id) && !seen.includes(id)) seen.push(id);
    }
  }

  const next: Stored = { weekOf, baseline, seen };
  writeStored(accountId, next);
  return {
    weekOf,
    target: WEEKLY_GOAL_TARGET,
    mastered: seen.length,
    newSkills: seen,
    done: seen.length >= WEEKLY_GOAL_TARGET,
  };
}

/** Read-only view (no mutation) for display before a turn is recorded. */
export function loadWeeklyGoal(
  accountId: string,
  now = Date.now(),
): WeeklyGoal {
  const weekOf = weeklyGoalWeekKey(now);
  const prev = readStored(accountId);
  const seen = prev && prev.weekOf === weekOf ? prev.seen : [];
  return {
    weekOf,
    target: WEEKLY_GOAL_TARGET,
    mastered: seen.length,
    newSkills: seen,
    done: seen.length >= WEEKLY_GOAL_TARGET,
  };
}

/** Kid-facing summary line, e.g. "This week: 2/3 new skills". */
export function weeklyGoalLine(goal: WeeklyGoal): string {
  if (goal.done) return `Weekly goal: ${goal.mastered}/${goal.target} new skills — goal hit!`;
  return `Weekly goal: ${goal.mastered}/${goal.target} new skills this week`;
}
