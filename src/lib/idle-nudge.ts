/**
 * AUD.6a — Soft idle return helpers (no streaks / no flame counters).
 * Pure: activity age, calm opener copy, parent idle note, dashboard→chat kickoff stash.
 */

import type { LearningMemory } from "./learning-memory";
import type { SessionOpener } from "./session-opener";

/** Calendar days of silence before soft return copy kicks in. */
export const IDLE_SOFT_DAYS = 3;

export const PRACTICE_KICKOFF_KEY = "spark.practiceKickoff.v1";

export type PracticeKickoff = {
  skillId: string;
  label: string;
  source: "dashboard-misconception" | "dashboard-weak";
};

/** Whole calendar days since the most recent skill lastSeen (0 = today). */
export function daysSinceLastActivity(
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): number | null {
  if (!mem?.skills?.length) return null;
  let latest = 0;
  for (const s of mem.skills) {
    if (s.lastSeen > latest) latest = s.lastSeen;
  }
  if (!latest || latest <= 0) return null;
  const diff = Math.max(0, now - latest);
  return Math.floor(diff / 86_400_000);
}

/** True when idle ≥ IDLE_SOFT_DAYS. */
export function isSoftIdle(
  mem: LearningMemory | null | undefined,
  now = Date.now(),
  threshold = IDLE_SOFT_DAYS,
): boolean {
  const d = daysSinceLastActivity(mem, now);
  return d != null && d >= threshold;
}

/**
 * Calm welcome-back line for empty-chat opener.
 * Must never mention streaks, flames, or “don't break the chain”.
 */
export function softReturnOpenerLine(skillLabel: string, idleDays: number): string {
  const label = String(skillLabel || "a warm-up").trim().slice(0, 48) || "a warm-up";
  const days = Math.max(IDLE_SOFT_DAYS, Math.floor(idleDays) || IDLE_SOFT_DAYS);
  return `Welcome back — it's been ${days} days. Want a gentle ${label} warm-up, or snap homework first?`;
}

/** Parent-facing idle note (digest / weekly). No child gamification. */
export function parentIdleNote(idleDays: number | null | undefined): string | null {
  if (idleDays == null || idleDays < IDLE_SOFT_DAYS) return null;
  const n = Math.floor(idleDays);
  return `Past ${n} days unused`;
}

export function buildPracticeKickoffOpener(kick: PracticeKickoff): SessionOpener {
  const label = String(kick.label || "practice").trim().slice(0, 56) || "practice";
  return {
    skillId: String(kick.skillId || "general").slice(0, 48),
    label,
    kind: "practice",
    line: `From your learning map: try a short ${label} check — or snap homework first?`,
  };
}

/** In-memory fallback for Node tests / blocked storage. */
const kickoffMemory = new Map<string, string>();

function kickoffWrite(raw: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(PRACTICE_KICKOFF_KEY, raw);
      return;
    }
  } catch {
    /* fall through */
  }
  kickoffMemory.set(PRACTICE_KICKOFF_KEY, raw);
}

function kickoffRead(): string | null {
  try {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(PRACTICE_KICKOFF_KEY);
    }
  } catch {
    /* fall through */
  }
  return kickoffMemory.get(PRACTICE_KICKOFF_KEY) ?? null;
}

function kickoffClear(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(PRACTICE_KICKOFF_KEY);
    }
  } catch {
    /* ignore */
  }
  kickoffMemory.delete(PRACTICE_KICKOFF_KEY);
}

export function stashPracticeKickoff(kick: PracticeKickoff): void {
  const payload: PracticeKickoff = {
    skillId: String(kick.skillId || "general").slice(0, 48),
    label: String(kick.label || "practice").slice(0, 56),
    source: kick.source,
  };
  kickoffWrite(JSON.stringify(payload));
}

/** Read and clear a one-shot dashboard→chat practice kickoff. */
export function consumePracticeKickoff(): PracticeKickoff | null {
  const raw = kickoffRead();
  kickoffClear();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PracticeKickoff>;
    const skillId = String(parsed.skillId || "").trim().slice(0, 48);
    const label = String(parsed.label || "").trim().slice(0, 56);
    if (!skillId || !label) return null;
    const source =
      parsed.source === "dashboard-weak"
        ? "dashboard-weak"
        : "dashboard-misconception";
    return { skillId, label, source };
  } catch {
    return null;
  }
}
