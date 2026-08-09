"use client";

import { useEffect, useMemo, useState } from "react";
import type { LearningMemory } from "@/lib/learning-memory";
import {
  normalizeMemory,
  skillStrengths,
  skillWeaknesses,
  zpdWarmUpSkills,
} from "@/lib/learning-memory";
import { buildParentDailyDigest } from "@/lib/parent-digest";
import { hasParentPin, PinGate } from "./PinGate";
import type { SkillMastery } from "@/lib/learning-memory";

const STORAGE_KEY = "spark.skillsPanelOpen";

type Props = {
  memory: LearningMemory | null;
  checkMode?: boolean;
  onCheckModeChange?: (on: boolean) => void;
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

export function SkillsPanel({
  memory,
  checkMode = false,
  onCheckModeChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Load persisted open state post-hydration; deferred so no setState runs
    // synchronously in the effect.
    const t = setTimeout(() => {
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === "1") setOpen(true);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
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
  const pinSet = useMemo(() => hasParentPin(), [showPin, parentUnlocked]);
  const digest = useMemo(() => buildParentDailyDigest(mem), [mem]);

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

  const lockParent = () => {
    setParentUnlocked(false);
    setShowPin(false);
    onCheckModeChange?.(false);
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Parent
            </p>
            {!pinSet ? (
              <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                Set parent PIN
                <span className="text-[var(--teal)]">
                  {" "}
                  — open Code Agent to configure
                </span>
              </p>
            ) : !parentUnlocked ? (
              <button
                type="button"
                onClick={() => setShowPin(true)}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] px-2 text-left text-[12px] text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
              >
                Unlock parent view
              </button>
            ) : (
              <div className="mt-1.5 space-y-2">
                <p className="text-[12px] leading-snug text-[var(--ink)]">
                  {digest}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(digest).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                    className="min-h-11 rounded-lg border border-[var(--line)] px-3 text-[12px] text-[var(--ink)]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={lockParent}
                    className="min-h-11 rounded-lg px-3 text-[12px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
                  >
                    Done
                  </button>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[12px] text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={checkMode}
                    onChange={(e) => onCheckModeChange?.(e.target.checked)}
                    className="h-4 w-4 accent-[var(--teal)]"
                  />
                  Check answers (parent)
                </label>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showPin ? (
        <PinGate
          onUnlock={() => {
            setParentUnlocked(true);
            setShowPin(false);
          }}
          onCancel={() => setShowPin(false)}
        />
      ) : null}
    </div>
  );
}
