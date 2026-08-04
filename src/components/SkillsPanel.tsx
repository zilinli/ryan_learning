"use client";

import { useMemo } from "react";
import type { LearningMemory } from "@/lib/learning-memory";
import {
  normalizeMemory,
  skillStrengths,
  skillWeaknesses,
  zpdWarmUpSkills,
  needsReviewSkills,
} from "@/lib/learning-memory";
import { hasParentPin } from "./PinGate";
import type { SkillMastery } from "@/lib/learning-memory";

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

function MasteryBar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="ml-1 inline-flex h-1.5 w-10 rounded-full bg-[var(--line)] align-baseline">
      <span
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </span>
  );
}

function SkillRow({ skill, color }: { skill: SkillMastery; color: string }) {
  return (
    <li className="flex items-center justify-between gap-2 text-[12px] text-[var(--ink)]">
      <span className="truncate">{skill.label}</span>
      <span className="shrink-0 tabular-nums flex items-center gap-0.5">
        <span className={color}>{skill.mastery}%</span>
        <span className="text-[10px] text-[var(--ink-muted)] opacity-60">
          {daysAgo(skill.lastSeen)}
        </span>
      </span>
    </li>
  );
}

export function SkillsPanel({ memory }: Props) {
  if (!memory) return null;
  const mem = normalizeMemory(memory);
  if (!mem.skills.length) return null;

  const strong = useMemo(() => skillStrengths(mem, 3), [mem]);
  const weak = useMemo(() => skillWeaknesses(mem, 3), [mem]);
  const zpd = useMemo(() => zpdWarmUpSkills(mem, 3), [mem]);
  const review = useMemo(() => needsReviewSkills(mem, 2), [mem]);

  const weakest = useMemo(
    () => [...mem.skills].sort((a, b) => a.mastery - b.mastery)[0] ?? null,
    [mem.skills],
  );

  // Topic grouping: count mastered (≥80%) and developing (40–79%) skills
  const topicSummary = useMemo(() => {
    const map = new Map<string, { mastered: number; developing: number; total: number }>();
    for (const s of mem.skills) {
      if (s.attempts === 0) continue;
      const entry = map.get(s.topicId) || { mastered: 0, developing: 0, total: 0 };
      entry.total++;
      if (s.mastery >= 80) entry.mastered++;
      else if (s.mastery >= 40) entry.developing++;
      map.set(s.topicId, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 4);
  }, [mem]);

  const pinSet = useMemo(() => hasParentPin(), []);

  const zpdSingle = zpd[0] ?? null;

  return (
    <div className="mx-3 mb-2 rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
        Ryan · learning dashboard
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
        BKT + SM-2 · updates each chat
      </p>

      {/* ZPD recommendation */}
      {zpdSingle ? (
        <div className="mt-2 rounded-lg border border-[var(--teal)]/25 bg-[var(--teal)]/5 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            🎯 Today's challenge
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--ink)]">
            Try: {zpdSingle.label}
          </p>
          <p className="text-[10px] text-[var(--ink-muted)]">
            You're in the zone — ZPD target
          </p>
          <MasteryBar pct={zpdSingle.mastery} color="bg-[var(--teal)]" />
        </div>
      ) : null}

      {/* Topic overview */}
      {topicSummary.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-[var(--ink-muted)]">
            📊 Topic overview
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {topicSummary.map(([topicId, { mastered, developing, total }]) => (
              <span
                key={topicId}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-1.5 py-0.5 text-[10px] text-[var(--ink)]"
              >
                <span className="truncate max-w-[70px]">{topicId === "math" ? "Math" : topicId === "ela" ? "Reading" : topicId === "science" ? "Science" : topicId === "humanities" ? "Humanities" : topicId}</span>
                <span className="tabular-nums text-[var(--teal)]">{mastered}</span>
                {developing > 0 ? (
                  <span className="tabular-nums text-[var(--coral)]">·{developing}</span>
                ) : null}
                {total > mastered + developing ? (
                  <span className="tabular-nums text-[var(--ink-muted)]">·{total - mastered - developing}</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* SM-2 review alerts */}
      {review.length > 0 ? (
        <div className="mt-2 rounded-lg border border-[var(--yellow)]/30 bg-[var(--yellow)]/5 px-2 py-1.5">
          <p className="text-[10px] font-medium text-[var(--yellow)]">
            🔔 Review needed
          </p>
          <ul className="mt-0.5 space-y-0">
            {review.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-[11px] text-[var(--ink)]"
              >
                <span className="truncate">{s.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--ink-muted)]">
                  {s.mastery}% · {daysAgo(s.lastSeen)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Strong skills */}
      {strong.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-[var(--ink-muted)]">
            Stronger
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {strong.map((s) => (
              <SkillRow key={s.id} skill={s} color="text-[var(--teal)]" />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Weak skills */}
      {weak.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-[var(--ink-muted)]">
            Focus
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {weak.map((s) => (
              <SkillRow key={s.id} skill={s} color="text-[var(--coral)]" />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Fallback: recent skills */}
      {!strong.length && !weak.length ? (
        <ul className="mt-2 space-y-0.5">
          {[...mem.skills]
            .sort((a, b) => b.lastSeen - a.lastSeen)
            .slice(0, 4)
            .map((s) => (
              <SkillRow key={s.id} skill={s} color="text-[var(--ink-muted)]" />
            ))}
        </ul>
      ) : null}

      {/* Parent PIN status */}
      <div className="mt-2.5 border-t border-[var(--line)]/60 pt-1.5">
        <p className="text-[10px] text-[var(--ink-muted)]">
          {pinSet ? (
            <span className="inline-flex items-center gap-1">
              🔒 Parent PIN active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              🔓 Parent PIN not set
              <span className="text-[var(--teal)]">
                — open Code Agent to configure
              </span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
