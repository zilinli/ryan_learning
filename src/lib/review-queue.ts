/**
 * Daily review queue — FSRS-inspired retrievability on top of existing SM-2 + BKT.
 * Does not replace SM-2 storage; ranks what to practice today.
 */

import {
  applyMemoryDecay,
  normalizeMemory,
  type LearningMemory,
  type SkillMastery,
} from "./learning-memory";

const DAY_MS = 86_400_000;
const LN_0_9 = Math.log(0.9);

export type ReviewQueueItem = {
  skill: SkillMastery;
  /** Retrievability 0–1 (lower = more urgent) */
  retrievability: number;
  /** Stability in days (from SM-2 interval, min 1) */
  stability: number;
  /** Difficulty 1–10 mapped from BKT pKnown */
  difficulty: number;
  daysSinceReview: number;
};

/** R = exp(ln(0.9) * t / S) — FSRS-style forgetting curve. */
export function retrievability(elapsedDays: number, stabilityDays: number): number {
  const S = Math.max(0.1, stabilityDays);
  const t = Math.max(0, elapsedDays);
  const r = Math.exp(LN_0_9 * (t / S));
  if (!Number.isFinite(r)) return 0;
  return Math.max(0, Math.min(1, r));
}

/** Map BKT P(L) → FSRS-like difficulty (higher = harder). */
export function difficultyFromMastery(pKnown: number): number {
  const p = Number.isFinite(pKnown) ? Math.max(0, Math.min(1, pKnown)) : 0.5;
  return Math.max(1, Math.min(10, 10 - p * 10));
}

export function skillReviewMetrics(
  skill: SkillMastery,
  now = Date.now(),
): ReviewQueueItem {
  const stability = Math.max(1, skill.sm2State?.interval || 1);
  const prev = skill.sm2State?.prevReview || 0;
  const daysSinceReview = prev > 0 ? (now - prev) / DAY_MS : 999;
  const R = prev > 0 ? retrievability(daysSinceReview, stability) : 0.5;
  return {
    skill,
    retrievability: R,
    stability,
    difficulty: difficultyFromMastery(skill.pKnown),
    daysSinceReview,
  };
}

export type BuildReviewQueueOpts = {
  now?: number;
  /** Max items (default 5) */
  limit?: number;
  /** Prefer skills with R below this (default 0.85) */
  rThreshold?: number;
  /** Skill ids already reviewed today — skip */
  reviewedTodayIds?: Set<string> | string[];
};

/**
 * Build today's review queue: urgent low-R skills, cap 5, no same-day duplicates.
 */
export function buildDailyReviewQueue(
  mem: LearningMemory | null | undefined,
  opts: BuildReviewQueueOpts = {},
): ReviewQueueItem[] {
  if (!mem?.skills?.length) return [];
  const now = opts.now ?? Date.now();
  const limit = Math.max(1, Math.min(10, opts.limit ?? 5));
  const threshold = opts.rThreshold ?? 0.85;
  const skip = new Set(
    opts.reviewedTodayIds
      ? [...opts.reviewedTodayIds]
      : [],
  );

  const decayed = applyMemoryDecay(normalizeMemory(mem));
  const scored = decayed.skills
    .filter((s) => s.attempts > 0 && !skip.has(s.id))
    .map((s) => skillReviewMetrics(s, now))
    .filter((item) => item.retrievability < threshold || item.daysSinceReview >= item.stability * 0.8)
    .sort(
      (a, b) =>
        a.retrievability - b.retrievability ||
        b.difficulty - a.difficulty ||
        b.daysSinceReview - a.daysSinceReview,
    );

  return scored.slice(0, limit);
}

/** One-line student/parent cue for the queue. */
export function reviewQueueSummaryLine(items: ReviewQueueItem[]): string | null {
  if (!items.length) return null;
  const labels = items.slice(0, 3).map((i) => i.skill.label);
  if (labels.length === 1) return `今日复习：${labels[0]}`;
  return `今日复习：${labels.join("、")}`;
}
