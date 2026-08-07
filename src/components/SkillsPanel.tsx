"use client";

import { useEffect, useMemo, useState } from "react";
import type { LearningMemory } from "@/lib/learning-memory";
import {
  normalizeMemory,
  skillStrengths,
  skillWeaknesses,
  zpdWarmUpSkills,
} from "@/lib/learning-memory";
import { hasParentPin } from "./PinGate";
import type { SkillMastery } from "@/lib/learning-memory";

const STORAGE_KEY = "spark.skillsPanelOpen";

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  const mem = useMemo(
    () => (memory ? normalizeMemory(memory) : null),
    [memory],
  );

  const strong = useMemo(
    () => (mem?.skills.length ? skillStrengths(mem, 2) : []),
    [mem],
  );
  const weak = useMemo(
    () => (mem?.skills.length ? skillWeaknesses(mem, 2) : []),
    [mem],
  );
  const zpdSingle = useMemo(
    () => (mem?.skills.length ? zpdWarmUpSkills(mem, 1)[0] ?? null : null),
    [mem],
  );
  const pinSet = useMemo(() => hasParentPin(), []);

  if (!mem?.skills.length) return null;

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const zpdHint = zpdSingle?.label
    ? zpdSingle.label.length > 18
      ? `${zpdSingle.label.slice(0, 16)}…`
      : zpdSingle.label
    : null;

  return (
    <div
      className={`mx-3 mb-2 flex shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] ${
        open ? "max-h-[min(40%,18rem)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full shrink-0 items-center gap-2 px-3 py-2 text-left transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)]"
      >
        <span
          className="shrink-0 text-[10px] text-[var(--ink-muted)]"
          aria-hidden
        >
          {open ? "▾" : "▸"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
          Learning
          {!open && zpdHint ? (
            <span className="font-normal normal-case tracking-normal text-[var(--ink-muted)]">
              {" "}
              · Try: {zpdHint}
            </span>
          ) : null}
        </span>
        {!open && weak.length > 0 ? (
          <span className="shrink-0 rounded-full bg-[var(--coral)]/10 px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--coral)]">
            {weak.length} focus
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[var(--line)]/50 px-3 pb-2.5 pt-1.5">
          <p className="text-[10px] text-[var(--ink-muted)]">
            BKT + SM-2 · updates each chat
          </p>

          {zpdSingle ? (
            <div className="mt-1.5 rounded-lg border border-[var(--teal)]/25 bg-[var(--teal)]/5 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--teal)]">
                Today&apos;s challenge
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-[var(--ink)]">
                Try: {zpdSingle.label}
              </p>
              <p className="text-[10px] text-[var(--ink-muted)]">
                You&apos;re in the zone — ZPD target
              </p>
            </div>
          ) : null}

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

          {!strong.length && !weak.length ? (
            <ul className="mt-2 space-y-0.5">
              {[...mem.skills]
                .sort((a, b) => b.lastSeen - a.lastSeen)
                .slice(0, 3)
                .map((s) => (
                  <SkillRow
                    key={s.id}
                    skill={s}
                    color="text-[var(--ink-muted)]"
                  />
                ))}
            </ul>
          ) : null}

          <div className="mt-2 border-t border-[var(--line)]/60 pt-1.5">
            <p className="text-[10px] text-[var(--ink-muted)]">
              {pinSet ? (
                <span>Parent PIN active</span>
              ) : (
                <span>
                  Parent PIN not set
                  <span className="text-[var(--teal)]">
                    {" "}
                    — open Code Agent to configure
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
