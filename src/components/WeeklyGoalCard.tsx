"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadLearningMemory,
  hydrateLearningMemoryFromServer,
} from "@/lib/learning-memory";
import {
  loadWeeklyGoal,
  reconcileWeeklyGoal,
  WEEKLY_GOAL_TARGET,
  type WeeklyGoal,
} from "@/lib/weekly-goal";

/** P2 — "master 3 new skills this week" short-cycle goal card. */
export function WeeklyGoalCard({ accountId }: { accountId: string }) {
  const [goal, setGoal] = useState<WeeklyGoal | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hydrateLearningMemoryFromServer(accountId).then((mem) => {
      if (cancelled) return;
      reconcileWeeklyGoal(accountId, mem ?? loadLearningMemory(accountId));
      if (!cancelled) setGoal(loadWeeklyGoal(accountId));
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const pct = useMemo(() => {
    if (!goal) return 0;
    return Math.min(100, Math.round((goal.mastered / WEEKLY_GOAL_TARGET) * 100));
  }, [goal]);

  if (!goal) return null;

  const dots = Array.from({ length: WEEKLY_GOAL_TARGET }, (_, i) => (
    <span
      key={i}
      className={`h-3 w-3 rounded-full ${
        i < goal.mastered ? "bg-[var(--teal)]" : "bg-[var(--mist)]"
      }`}
      aria-hidden
    />
  ));

  return (
    <section
      className={`rounded-2xl border p-4 ${
        goal.done
          ? "border-[#2e9e6b]/40 bg-[#2e9e6b]/10"
          : "border-[var(--line)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Weekly goal
        </p>
        <span className="tabular-nums text-sm font-semibold text-[var(--teal)]">
          {goal.mastered}/{WEEKLY_GOAL_TARGET}
        </span>
      </div>
      <p className="mt-1 text-[15px] font-medium text-[var(--ink)]">
        {goal.done
          ? "Goal hit — you mastered 3 new skills this week! "
          : `Master ${WEEKLY_GOAL_TARGET} new skills this week`}
      </p>
      <div className="mt-2 flex gap-1.5">{dots}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--mist)]">
        <div
          className="h-full rounded-full bg-[var(--teal)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {goal.done ? (
        <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
          Keep going — every new skill still counts.
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
          New skills you have mastered count toward this. Try a new topic in
          chat.
        </p>
      )}
    </section>
  );
}
