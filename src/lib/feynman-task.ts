/**
 * P2 (report §8.6) — weekly "explain it to the family" Feynman task.
 * Picks a mastered skill as the teach-back topic; parents can mark it done
 * and the weekly report notes "the child taught X to the family".
 */

import type { LearningMemory, SkillMastery } from "./learning-memory";
import { kvGet, kvSet } from "./browser-kv";

export type FeynmanTask = {
  weekOf: string;
  skillId: string;
  skillLabel: string;
  /** Kid-facing instruction (Feynman): teach it aloud. */
  kidPrompt: string;
  /** Parent-facing suggestion. */
  parentPrompt: string;
};

/** Monday (YYYY-MM-DD) of the current week — matches parent digest. */
export function feynmanWeekKey(now = Date.now()): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset),
  );
  return monday.toISOString().slice(0, 10);
}

function pickTeachBackSkill(mem: LearningMemory | null | undefined): SkillMastery | null {
  if (!mem?.skills?.length) return null;
  const practiced = mem.skills.filter((s) => s.attempts > 0);
  if (!practiced.length) return null;
  const byKnown = [...practiced].sort(
    (a, b) => b.pKnown - a.pKnown || b.lastSeen - a.lastSeen,
  );
  return byKnown[0] ?? null;
}

export function buildFeynmanTask(
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): FeynmanTask | null {
  const skill = pickTeachBackSkill(mem);
  if (!skill) return null;
  return {
    weekOf: feynmanWeekKey(now),
    skillId: skill.id,
    skillLabel: skill.label,
    kidPrompt: `Teach someone at home about ${skill.label}. Explain it in your own words, use one example, and ask them one question to check they got it.`,
    parentPrompt: `Ask your child to teach you ${skill.label} — no notes allowed. One example, one check question. That is the whole task.`,
  };
}

// ── Done-state (localStorage per account + week) ────────────────────

export function feynmanDoneKey(accountId: string, weekOf: string): string {
  return `spark.feynmanDone.${accountId || "default"}.${weekOf}`;
}

export function loadFeynmanDone(accountId: string, weekOf: string): boolean {
  return kvGet(feynmanDoneKey(accountId, weekOf)) === "1";
}

export function markFeynmanDone(accountId: string, task: FeynmanTask): void {
  kvSet(feynmanDoneKey(accountId, task.weekOf), "1");
}

/** Weekly-report line — used inside the parent digest text. */
export function feynmanTaskLine(task: FeynmanTask, done: boolean): string {
  if (done) {
    return `Feynman teach-back: the child explained ${task.skillLabel} to the family this week — lovely!`;
  }
  return `Feynman teach-back: have the child explain ${task.skillLabel} to you — one example, one check question.`;
}
