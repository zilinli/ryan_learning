"use client";

import { useMemo } from "react";
import type { LearningMemory } from "@/lib/learning-memory";
import {
  normalizeMemory,
  skillStrengths,
  skillWeaknesses,
} from "@/lib/learning-memory";

type Props = {
  memory: LearningMemory | null;
};

function daysAgo(ts: number): string {
  if (!ts || ts <= 0) return "";
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days <= 6) return `${days}d ago`;
  if (days <= 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function SkillsPanel({ memory }: Props) {
  if (!memory) return null;
  const mem = normalizeMemory(memory);
  if (!mem.skills.length) return null;

  const strong = skillStrengths(mem, 3);
  const weak = skillWeaknesses(mem, 3);
  const recent = [...mem.skills]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 4);

  const weakest = useMemo(
    () => [...mem.skills].sort((a, b) => a.mastery - b.mastery)[0] ?? null,
    [mem.skills],
  );

  return (
    <div className="mx-3 mb-2 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
        Ryan · skill map
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
        BKT mastery · updates after each chat
      </p>

      {weakest ? (
        <div className="mt-1.5">
          <span className="inline-block rounded-full bg-[var(--coral)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--coral)]">
            🔍 Focus: {weakest.label} ({weakest.mastery}%)
          </span>
        </div>
      ) : null}

      {strong.length ? (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-[var(--ink-muted)]">
            Stronger
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {strong.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-[12px] text-[var(--ink)]"
              >
                <span className="truncate">{s.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--teal)]">
                  {s.mastery}%<span className="ml-1 text-[10px] opacity-60">{daysAgo(s.lastSeen)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {weak.length ? (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-[var(--ink-muted)]">
            Focus
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {weak.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-[12px] text-[var(--ink)]"
              >
                <span className="truncate">{s.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--coral)]">
                  {s.mastery}%<span className="ml-1 text-[10px] opacity-60">{daysAgo(s.lastSeen)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!strong.length && !weak.length && recent.length ? (
        <ul className="mt-2 space-y-0.5">
          {recent.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 text-[12px] text-[var(--ink)]"
            >
              <span className="truncate">{s.label}</span>
              <span className="shrink-0 tabular-nums text-[var(--ink-muted)]">
                {s.mastery}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
