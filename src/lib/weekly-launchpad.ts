/**
 * V2 P1 — weekly Launchpad (report §9.3.2).
 * One "This week" strip in the empty chat that aggregates every weekly rhythm
 * the system already has — deep dive, connection card, Feynman teach-back and
 * the short-cycle goal — into a single status bar with tap-through actions.
 * Purely a read-only view: it never mutates state, so it can't fight with the
 * individual offer cards (which keep their own shown/done keys).
 */

import { buildConnectionOffer } from "./connection-card";
import { deepDiveWeekKey, loadDeepDiveStatus } from "./deep-dive-week";
import {
  buildFeynmanTask,
  feynmanTaskLine,
  loadFeynmanDone,
} from "./feynman-task";
import type { LearningMemory } from "./learning-memory";
import { loadWeeklyGoal, weeklyGoalLine } from "./weekly-goal";

export type LaunchpadItemKey = "deepDive" | "connection" | "feynman" | "goal";

export type LaunchpadAction =
  | { type: "deepDive"; weekOf: string }
  | { type: "connection"; weekOf: string }
  | { type: "feynman"; weekOf: string; skillLabel: string }
  | { type: "goal"; weekOf: string };

export type LaunchpadItem = {
  key: LaunchpadItemKey;
  label: string;
  emoji: string;
  done: boolean;
  /** One-line status shown under the label. */
  line: string;
  action: LaunchpadAction;
};

export type WeeklyLaunchpadView = {
  weekOf: string;
  items: LaunchpadItem[];
  doneCount: number;
  totalCount: number;
};

/** Chat kickoff for the items that don't have a dedicated offer card. */
export function launchpadKickoff(action: LaunchpadAction): string {
  switch (action.type) {
    case "feynman":
      return `Feynman teach-back practice: have me explain ${action.skillLabel} in my own words. Ask me to teach you — then give feedback and ONE check question. No spoilers.`;
    case "goal":
      return `Weekly goal sprint: give me ONE well-chosen question from a subject I haven't nailed yet this week. If I get it right, give me another a notch harder — let's master something new today.`;
    default:
      return "";
  }
}

/**
 * Aggregate this week's statuses. Read-only — nothing here writes storage.
 */
export function buildWeeklyLaunchpad(
  accountId: string,
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): WeeklyLaunchpadView {
  const weekOf = deepDiveWeekKey(now);

  const deepDive = loadDeepDiveStatus(accountId, now);
  const connectionOffer = buildConnectionOffer(accountId, now); // null ⇒ already shown/done
  const feynman = buildFeynmanTask(mem, now);
  const feynmanDone = feynman ? loadFeynmanDone(accountId, feynman.weekOf) : false;
  const goal = loadWeeklyGoal(accountId, now);

  const items: LaunchpadItem[] = [
    {
      key: "deepDive",
      label: "Deep dive",
      emoji: "🧗",
      done: deepDive.done,
      line: deepDive.done ? "Deep project done" : "One deep project this week",
      action: { type: "deepDive", weekOf },
    },
    {
      key: "connection",
      label: "Connection",
      emoji: "🔗",
      done: !connectionOffer,
      line: connectionOffer ? connectionOffer.card.title : "Connection card seen",
      action: { type: "connection", weekOf },
    },
    {
      key: "feynman",
      label: "Teach-back",
      emoji: "🗣️",
      done: feynmanDone,
      line: feynman
        ? feynmanTaskLine(feynman, feynmanDone)
        : "No teach-back skill yet",
      action: {
        type: "feynman",
        weekOf,
        skillLabel: feynman?.skillLabel ?? "",
      },
    },
    {
      key: "goal",
      label: "Weekly goal",
      emoji: "🎯",
      done: goal.done,
      line: weeklyGoalLine(goal),
      action: { type: "goal", weekOf },
    },
  ];

  return {
    weekOf,
    items,
    doneCount: items.filter((i) => i.done).length,
    totalCount: items.length,
  };
}
