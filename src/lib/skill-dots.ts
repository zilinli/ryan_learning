/**
 * P0 (report §8.3) — pure logic behind the child-visible skill dots.
 * Classifies each skill into green (mastered P≥0.8) / yellow (in practice) /
 * grey (new) and surfaces 2–3 strengths + 2–3 to keep practising.
 */

import {
  skillStrengths,
  skillWeaknesses,
  weekKeyOf,
  type LearningMemory,
  type SkillMastery,
} from "./learning-memory";

export type SkillDotTone = "green" | "yellow" | "grey";

export function skillDotTone(skill: {
  pKnown: number;
  attempts: number;
  lastSeen: number;
}): SkillDotTone {
  if (skill.pKnown >= 0.8 && skill.attempts > 0) return "green";
  if (skill.attempts > 0 && skill.lastSeen > 0) return "yellow";
  return "grey";
}

export type SkillDotsSummary = {
  skills: SkillMastery[];
  grouped: Record<SkillDotTone, number>;
  strengths: SkillMastery[];
  weaknesses: SkillMastery[];
  /** P2-1 — dots that lit up during the current week (a "growth moment"). */
  litThisWeek: SkillMastery[];
};

/** Monday timestamp (UTC) of the current week — used for the growth banner. */
export function weekStartOf(ts = Date.now()): number {
  const wk = weekKeyOf(ts);
  return Date.parse(wk + "T00:00:00.000Z");
}

export function summarizeSkillDots(
  mem: LearningMemory | null,
  now = Date.now(),
): SkillDotsSummary {
  const skills = mem?.skills || [];
  const grouped: Record<SkillDotTone, number> = {
    green: 0,
    yellow: 0,
    grey: 0,
  };
  for (const s of skills) {
    grouped[skillDotTone(s)] += 1;
  }
  const weekStart = weekStartOf(now);
  const litThisWeek = skills.filter(
    (s) => s.lastSeen >= weekStart && skillDotTone(s) !== "grey",
  );
  return {
    skills,
    grouped,
    strengths: skillStrengths(mem, 3),
    weaknesses: skillWeaknesses(mem, 3),
    litThisWeek,
  };
}
