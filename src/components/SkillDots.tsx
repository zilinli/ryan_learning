"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadLearningMemory,
  type LearningMemory,
} from "@/lib/learning-memory";
import {
  skillDotTone,
  summarizeSkillDots,
  type SkillDotTone,
} from "@/lib/skill-dots";

const TONE_CLASS: Record<SkillDotTone, string> = {
  green: "bg-[#2e9e6b]",
  yellow: "bg-[#d9a441]",
  grey: "bg-[var(--line)]",
};

const TONE_LABEL: Record<SkillDotTone, string> = {
  green: "mastered",
  yellow: "in practice",
  grey: "just met",
};

/**
 * P0 (report §8.3) — child-visible skill growth: one dot per skill.
 * Green = mastered (P≥0.8), yellow = in practice, grey = new.
 * Tap to reveal 2–3 strengths and 2–3 skills to keep practising.
 */
export function SkillDots({
  accountId,
  className = "",
}: {
  accountId: string;
  className?: string;
}) {
  const [mem, setMem] = useState<LearningMemory | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMem(loadLearningMemory(accountId));
    setOpen(false);
  }, [accountId]);

  const dots = useMemo(() => summarizeSkillDots(mem), [mem]);
  const litIds = useMemo(() => new Set(dots.litThisWeek.map((s) => s.id)), [dots]);

  if (dots.skills.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          My skills
        </p>
        <p className="text-[11px] text-[var(--ink-muted)]">
          {dots.grouped.green} down · {dots.grouped.yellow} practising ·{" "}
          {dots.grouped.grey} new
        </p>
      </button>

      {/* P2-1 — growth moment banner: dots lit this week */}
      {dots.litThisWeek.length > 0 ? (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-xl border border-[#2e9e6b]/30 bg-[#2e9e6b]/10 px-3 py-2"
        >
          <span className="text-base leading-none" aria-hidden>
            🎉
          </span>
          <p className="text-[12px] text-[var(--ink)]">
            You lit{" "}
            <span className="font-semibold text-[#2e9e6b]">
              {dots.litThisWeek.length}
            </span>{" "}
            dot{dots.litThisWeek.length > 1 ? "s" : ""} this week
            {dots.grouped.green > 0 ? " — level up!" : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="list" aria-label="Skill dots">
        {dots.skills.map((s) => {
          const tone = skillDotTone(s);
          return (
            <span
              key={s.id}
              role="listitem"
              title={`${s.label} — ${TONE_LABEL[tone]} (${Math.round(s.pKnown * 100)}%)`}
              className={`h-3.5 w-3.5 rounded-full ${TONE_CLASS[tone]} ring-2 ring-[var(--surface)] ${
                litIds.has(s.id) ? "animate-pulse" : ""
              }`}
            />
          );
        })}
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {dots.strengths.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-[#2e9e6b]">Got it</p>
              <ul className="mt-1 space-y-1">
                {dots.strengths.map((s) => (
                  <li key={s.id} className="text-[13px] text-[var(--ink)]">
                    {s.label}
                    <span className="ml-1 text-[11px] text-[var(--ink-muted)]">
                      {Math.round(s.mastery)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {dots.weaknesses.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-[#d9a441]">
                Keep practising
              </p>
              <ul className="mt-1 space-y-1">
                {dots.weaknesses.map((s) => (
                  <li key={s.id} className="text-[13px] text-[var(--ink)]">
                    {s.label}
                    <span className="ml-1 text-[11px] text-[var(--ink-muted)]">
                      {Math.round(s.mastery)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
