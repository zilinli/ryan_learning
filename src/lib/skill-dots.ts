/**
 * P0 (report §8.3) — pure logic behind the child-visible skill dots.
 * Classifies each skill into green (mastered P≥0.8) / yellow (in practice) /
 * grey (new) and surfaces 2–3 strengths + 2–3 to keep practising.
 */

import {
  skillStrengths,
  skillWeaknesses,
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
};

export function summarizeSkillDots(mem: LearningMemory | null): SkillDotsSummary {
  const skills = mem?.skills || [];
  const grouped: Record<SkillDotTone, number> = {
    green: 0,
    yellow: 0,
    grey: 0,
  };
  for (const s of skills) {
    grouped[skillDotTone(s)] += 1;
  }
  return {
    skills,
    grouped,
    strengths: skillStrengths(mem, 3),
    weaknesses: skillWeaknesses(mem, 3),
  };
}
