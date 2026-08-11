/**
 * D2 / Report-v3 R6 — Parent digests (daily one-liner + weekly in-app summary).
 * Pure builders from BKT memory — no email/SMTP.
 */

import { getMisconception } from "./misconceptions";
import {
  daysSinceLastActivity,
  parentIdleNote,
} from "./idle-nudge";
import {
  needsReviewSkills,
  skillWeaknesses,
  zpdWarmUpSkills,
  type LearningMemory,
  type SkillMastery,
} from "./learning-memory";

const WEEK_MS = 7 * 86_400_000;

export function buildParentDailyDigest(
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): string {
  if (!mem?.skills?.length) {
    return "Today: no skill activity logged yet.";
  }
  const weak = skillWeaknesses(mem, 2);
  const review = needsReviewSkills(mem, 1);
  const zpd = zpdWarmUpSkills(mem, 1);
  const focus = weak[0] ?? review[0] ?? zpd[0];
  const parts: string[] = [];
  const idle = parentIdleNote(daysSinceLastActivity(mem, now));
  if (idle) parts.push(idle);
  if (focus) {
    parts.push(`Today: ${focus.label}`);
    if (focus.mastery <= 50) {
      parts.push(`still building (~${focus.mastery}%)`);
    } else if (review[0]?.id === focus.id) {
      parts.push("due for review");
    } else {
      parts.push("in the practice zone");
    }
  }
  if (weak.length > 1) {
    parts.push(`also watch ${weak[1]!.label}`);
  }
  const recent = [...mem.skills].sort((a, b) => b.lastSeen - a.lastSeen)[0];
  if (recent && (!focus || recent.id !== focus.id) && !idle) {
    parts.push(`last chat touched ${recent.label}`);
  }
  return parts.join(" · ").slice(0, 280);
}

export type WeeklyMisconceptionRow = {
  id: string;
  label: string;
  count: number;
  skillLabel?: string;
};

export type ParentWeeklyDigest = {
  weekOf: string;
  practiced: Array<{ id: string; label: string; mastery: number; deltaHint: string }>;
  masteryUp: SkillMastery[];
  masteryDown: SkillMastery[];
  topMisconceptions: WeeklyMisconceptionRow[];
  reviewDue: SkillMastery[];
  nextWeekFocus: SkillMastery[];
  /** AUD.6a — whole days since last skill activity; null if unknown */
  idleDays: number | null;
  text: string;
};

function weekOfLabel(now: number): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset));
  return monday.toISOString().slice(0, 10);
}

function deltaHint(s: SkillMastery): string {
  if (s.mastery >= 70) return "↑ steady";
  if (s.incorrect > s.correct) return "↓ needs support";
  if (s.correct > s.incorrect) return "↑ building";
  return "→ holding";
}

/**
 * Weekly parent summary for PIN UI / copy. Window = last 7 days by lastSeen.
 */
export function buildParentWeeklyDigest(
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): ParentWeeklyDigest {
  const weekOf = weekOfLabel(now);
  if (!mem?.skills?.length) {
    return {
      weekOf,
      practiced: [],
      masteryUp: [],
      masteryDown: [],
      topMisconceptions: [],
      reviewDue: [],
      nextWeekFocus: [],
      idleDays: null,
      text: `Week of ${weekOf}: no skill activity logged yet.`,
    };
  }

  const weekStart = now - WEEK_MS;
  const practicedSkills = mem.skills
    .filter((s) => s.lastSeen >= weekStart)
    .sort((a, b) => b.lastSeen - a.lastSeen);

  const practiced = practicedSkills.slice(0, 8).map((s) => ({
    id: s.id,
    label: s.label,
    mastery: s.mastery,
    deltaHint: deltaHint(s),
  }));

  const masteryUp = practicedSkills
    .filter((s) => s.correct >= s.incorrect && s.mastery >= 55)
    .slice(0, 3);
  const masteryDown = practicedSkills
    .filter((s) => s.incorrect > s.correct || s.pKnown < 0.4)
    .sort((a, b) => a.pKnown - b.pKnown)
    .slice(0, 3);

  const mcMap = new Map<string, WeeklyMisconceptionRow>();
  for (const s of mem.skills) {
    for (const h of s.misconceptionHits || []) {
      if (h.lastSeen < weekStart && h.count < 2) continue;
      const tag = getMisconception(h.id);
      const prev = mcMap.get(h.id);
      if (!prev || h.count > prev.count) {
        mcMap.set(h.id, {
          id: h.id,
          label: tag?.label || h.id,
          count: h.count,
          skillLabel: s.label,
        });
      }
    }
  }
  const topMisconceptions = [...mcMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const reviewDue = needsReviewSkills(mem, 4);
  const nextWeekFocus = [
    ...skillWeaknesses(mem, 2),
    ...zpdWarmUpSkills(mem, 2),
  ]
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
    .slice(0, 3);

  const idleDays = daysSinceLastActivity(mem, now);
  const idleNote = parentIdleNote(idleDays);

  const lines: string[] = [`Week of ${weekOf}`];
  if (idleNote) {
    lines.push(idleNote);
  }
  if (practiced.length) {
    lines.push(
      `Practiced: ${practiced.map((p) => `${p.label} (~${p.mastery}% ${p.deltaHint})`).join("; ")}`,
    );
  } else {
    lines.push("Practiced: no chats logged in the last 7 days.");
  }
  if (masteryUp.length) {
    lines.push(`Gains: ${masteryUp.map((s) => s.label).join(", ")}`);
  }
  if (masteryDown.length) {
    lines.push(`Watch: ${masteryDown.map((s) => `${s.label} (~${s.mastery}%)`).join(", ")}`);
  }
  if (topMisconceptions.length) {
    lines.push(
      `Frequent patterns: ${topMisconceptions.map((m) => `${m.label}×${m.count}`).join("; ")}`,
    );
  }
  if (reviewDue.length) {
    lines.push(`SM-2 due: ${reviewDue.map((s) => s.label).join(", ")}`);
  }
  if (nextWeekFocus.length) {
    lines.push(`Next week focus: ${nextWeekFocus.map((s) => s.label).join(", ")}`);
  }

  return {
    weekOf,
    practiced,
    masteryUp,
    masteryDown,
    topMisconceptions,
    reviewDue,
    nextWeekFocus,
    idleDays,
    text: lines.join("\n"),
  };
}
