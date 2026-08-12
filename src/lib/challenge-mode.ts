/**
 * P1 (report §8.4) — explicit challenge mode for mastered skills.
 * Picks high-BKT skills (P≥0.8), carries a per-skill "consecutive correct"
 * streak that auto-raises the difficulty band, and builds a kickoff message
 * that asks the AI teacher for multi-step / transfer questions.
 */

import type { LearningMemory, SkillMastery } from "./learning-memory";
import { kvGet, kvRemove, kvSet } from "./browser-kv";

export type ChallengeLevel = 1 | 2 | 3;

/** Mastery floor for a skill to be challenge-eligible. */
export const CHALLENGE_P_KNOWN = 0.8;
/** Correct answers needed to step up a difficulty band. */
export const CHALLENGE_BAND = 3;

const STREAK_PREFIX = "spark.challengeStreak.";
const ACTIVE_KEY = "spark.challengeActive.v1";

export function challengeStreakStorageKey(
  accountId: string,
  skillId: string,
): string {
  return `${STREAK_PREFIX}${accountId || "default"}.${skillId}`;
}

export function challengeLevelForStreak(streak: number): ChallengeLevel {
  const n = Math.max(0, Math.floor(streak) || 0);
  if (n >= CHALLENGE_BAND * 2) return 3;
  if (n >= CHALLENGE_BAND) return 2;
  return 1;
}

export function challengeLevelLabel(level: ChallengeLevel): string {
  return level === 1
    ? "warm challenge"
    : level === 2
      ? "harder — multi-step"
      : "expert — transfer";
}

/** Mastered skills worth challenging, strongest first. */
export function pickChallengeSkills(
  mem: LearningMemory | null | undefined,
  limit = 3,
): SkillMastery[] {
  if (!mem?.skills?.length) return [];
  return [...mem.skills]
    .filter((s) => s.attempts > 0 && s.pKnown >= CHALLENGE_P_KNOWN)
    .sort((a, b) => b.pKnown - a.pKnown || b.attempts - a.attempts)
    .slice(0, limit);
}

// ── Streak storage (localStorage via browser-kv) ────────────────────

export function getChallengeStreak(accountId: string, skillId: string): number {
  const raw = kvGet(challengeStreakStorageKey(accountId, skillId));
  const n = Number(raw || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Called after a correct answer in challenge mode — raises the band. */
export function bumpChallengeStreak(
  accountId: string,
  skillId: string,
): number {
  const next = getChallengeStreak(accountId, skillId) + 1;
  kvSet(challengeStreakStorageKey(accountId, skillId), String(next));
  return next;
}

/** Called after a wrong answer — the band drops back to level 1. */
export function resetChallengeStreak(accountId: string, skillId: string): void {
  kvRemove(challengeStreakStorageKey(accountId, skillId));
}

// ── Active-session marker (sessionStorage) ──────────────────────────

export type ChallengeSession = {
  accountId: string;
  skillId: string;
  label: string;
  startedAt: number;
};

export function startChallengeSession(s: ChallengeSession): void {
  kvSet(
    ACTIVE_KEY,
    JSON.stringify({
      accountId: String(s.accountId || "default").slice(0, 64),
      skillId: String(s.skillId || "").slice(0, 48),
      label: String(s.label || s.skillId).slice(0, 56),
      startedAt: Date.now(),
    }),
  );
}

export function peekChallengeSession(): ChallengeSession | null {
  const raw = kvGet(ACTIVE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ChallengeSession>;
    if (!p.skillId) return null;
    return {
      accountId: String(p.accountId || "default").slice(0, 64),
      skillId: String(p.skillId).slice(0, 48),
      label: String(p.label || p.skillId).slice(0, 56),
      startedAt: Number(p.startedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function endChallengeSession(): void {
  kvRemove(ACTIVE_KEY);
}

/** Apply a classified turn outcome to the running challenge streak, if any. */
export function recordChallengeOutcome(
  accountId: string,
  outcome: "correct" | "incorrect" | "practice",
): number | null {
  const active = peekChallengeSession();
  if (!active || active.accountId !== accountId) return null;
  if (outcome === "correct") return bumpChallengeStreak(accountId, active.skillId);
  if (outcome === "incorrect") {
    resetChallengeStreak(accountId, active.skillId);
  }
  return null;
}

/** User turn that starts a challenge-mode session on the homepage. */
export function buildChallengeKickoffMessage(
  skill: SkillMastery,
  streak: number,
): string {
  const level = challengeLevelForStreak(streak);
  const nextHint =
    level < 3
      ? ` After ${CHALLENGE_BAND} correct answers in a row, raise the bar again.`
      : "";
  return [
    `Challenge mode — ${skill.label} (I've mastered this; make it actually hard).`,
    `Start at ${challengeLevelLabel(level)} difficulty.`,
    "Give me ONE question at a time — multi-step, or transfer the skill to a new context (money, time, diagrams, a tricky wording).",
    "No spoilers: ask me to reason out loud first, check my steps, then reveal. If I'm stuck, give a small nudge instead of the answer.",
    `After each correct answer, keep the difficulty. After a wrong answer, drop back to the warm level.${nextHint}`,
  ].join("\n");
}
