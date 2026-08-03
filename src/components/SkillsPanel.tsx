"use client";

import type { LearningMemory } from "@/lib/learning-memory";
import {
  normalizeMemory,
  skillStrengths,
  skillWeaknesses,
} from "@/lib/learning-memory";

type Props = {
  memory: LearningMemory | null;
};

export function SkillsPanel({ memory }: Props) {
  if (!memory) return null;
  const mem = normalizeMemory(memory);
  if (!mem.skills.length) return null;

  const strong = skillStrengths(mem, 3);
  const weak = skillWeaknesses(mem, 3);
  const recent = [...mem.skills]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 4);

  return (
    <div className="mx-3 mb-2 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
        Ryan · skill map
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
        BKT mastery · updates after each chat
      </p>

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
                  {s.mastery}%
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
                  {s.mastery}%
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
