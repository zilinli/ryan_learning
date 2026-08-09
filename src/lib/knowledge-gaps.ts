/**
 * A3 — Cross-day knowledge-gap merge with decay/expiry for session opener.
 */

import type { LearningMemory, SkillMastery } from "./learning-memory";
import { skillWeaknesses } from "./learning-memory";

export type GapDayEntry = {
  skillId: string;
  label: string;
  /** Local YYYY-MM-DD days this skill was weak / practiced as gap */
  days: string[];
  /** Epoch ms — drop after this */
  expiresAt: number;
};

const DEFAULT_TTL_MS = 14 * 86_400_000; // 14 days
const MAX_GAPS = 12;

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function pruneGapHistory(
  gaps: GapDayEntry[] | undefined,
  now = Date.now(),
): GapDayEntry[] {
  if (!gaps?.length) return [];
  return gaps
    .filter((g) => g && g.skillId && g.expiresAt > now && g.days?.length)
    .map((g) => ({
      skillId: String(g.skillId).slice(0, 48),
      label: String(g.label || g.skillId).slice(0, 56),
      days: [...new Set(g.days.filter(Boolean))].slice(-14),
      expiresAt: Number(g.expiresAt) || now + DEFAULT_TTL_MS,
    }))
    .sort((a, b) => b.days.length - a.days.length || b.expiresAt - a.expiresAt)
    .slice(0, MAX_GAPS);
}

/** Record today's weak skills into gap history (call on practice offer / session end). */
export function recordGapsFromMemory(
  prev: GapDayEntry[] | undefined,
  mem: LearningMemory | null | undefined,
  now = new Date(),
  ttlMs = DEFAULT_TTL_MS,
): GapDayEntry[] {
  const weak = mem ? skillWeaknesses(mem, 3) : [];
  if (!weak.length) return pruneGapHistory(prev, now.getTime());
  const day = localDateKey(now);
  const expiresAt = now.getTime() + ttlMs;
  const map = new Map<string, GapDayEntry>();
  for (const g of pruneGapHistory(prev, now.getTime())) {
    map.set(g.skillId, { ...g, days: [...g.days] });
  }
  for (const s of weak) {
    const cur = map.get(s.id) || {
      skillId: s.id,
      label: s.label,
      days: [],
      expiresAt,
    };
    if (!cur.days.includes(day)) cur.days.push(day);
    cur.label = s.label;
    cur.expiresAt = expiresAt;
    map.set(s.id, cur);
  }
  return pruneGapHistory([...map.values()], now.getTime());
}

/** Skills seen weak on ≥2 distinct calendar days (still unexpired). */
export function recurringGapSkills(
  gaps: GapDayEntry[] | undefined,
  minDays = 2,
  now = Date.now(),
): GapDayEntry[] {
  return pruneGapHistory(gaps, now).filter((g) => g.days.length >= minDays);
}

export function pickRecurringGapSkill(
  gaps: GapDayEntry[] | undefined,
  mem: LearningMemory | null | undefined,
): SkillMastery | null {
  const recurring = recurringGapSkills(gaps, 2);
  if (!recurring.length || !mem?.skills?.length) return null;
  for (const g of recurring) {
    const skill = mem.skills.find((s) => s.id === g.skillId);
    if (skill) return skill;
  }
  // Gap entry without live skill row — synthesize lightweight
  const top = recurring[0]!;
  return {
    id: top.skillId,
    label: top.label,
    topicId: "general",
    pKnown: 0.35,
    mastery: 35,
    attempts: top.days.length,
    correct: 0,
    incorrect: top.days.length,
    lastSeen: Date.now(),
    sm2State: { ef: 2.5, interval: 1, reps: 0, prevReview: 0 },
    eloState: { rating: 1200, n: 0, lastUpdate: 0 },
  };
}
