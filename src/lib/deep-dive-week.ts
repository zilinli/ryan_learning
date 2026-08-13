/**
 * P1 — weekly deep-dive day (report §9.3.1).
 * Once per week the empty-chat state offers a "deep project": it takes the
 * student's own material (a recent wrong answer, else a mastered skill) and
 * runs it through an explicit 5E loop (Engage → Explore → Explain →
 * Elaborate → Evaluate) that ends in a small product for Studio/Journal.
 * Mirrors weekly-goal's cadence (Monday-keyed week) so it's one rhythm.
 */

import { kvGet, kvSet } from "./browser-kv";
import type { LearningMemory } from "./learning-memory";
import { buildWrongAnswerReviewSet, type WrongAnswer } from "./wrong-answer-store";

export const DEEP_DIVE_DAY = 0; // Sunday (getUTCDay) — but offer is any day of a fresh week
const MASTERY_FLOOR = 0.82;

export type DeepDiveSource = "wrongbook" | "mastered" | "zpd";

export type DeepDiveOffer = {
  weekOf: string;
  topicLabel: string;
  source: DeepDiveSource;
  skillId: string | null;
  /** 5E kickoff message sent to the chat when the student taps Start */
  kickoff: string;
  done: boolean;
};

type Stored = { weekOf: string; done: boolean };

const KEY_PREFIX = "spark.deepDive.";

export function deepDiveStorageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId || "default"}`;
}

/** Monday (YYYY-MM-DD) of the week containing `now` — same key as weekly-goal. */
export function deepDiveWeekKey(now = Date.now()): string {
  const d = new Date(now);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset),
  )
    .toISOString()
    .slice(0, 10);
}

function readStored(accountId: string, weekOf: string): Stored {
  try {
    const raw = kvGet(deepDiveStorageKey(accountId));
    if (!raw) return { weekOf, done: false };
    const p = JSON.parse(raw) as Partial<Stored>;
    if (p && p.weekOf === weekOf) {
      return { weekOf, done: Boolean(p.done) };
    }
    return { weekOf, done: false };
  } catch {
    return { weekOf, done: false };
  }
}

function writeStored(accountId: string, st: Stored): void {
  kvSet(deepDiveStorageKey(accountId), JSON.stringify(st));
}

/** Mark this week's deep dive as started/complete (no nagging until Monday). */
export function markDeepDiveDone(accountId: string, now = Date.now()): void {
  const weekOf = deepDiveWeekKey(now);
  writeStored(accountId, { weekOf, done: true });
}

/** Pick the anchor topic: newest wrong answer first, else a mastered skill. */
export function pickDeepDiveAnchor(
  mem: LearningMemory | null | undefined,
  wrongAnswers: WrongAnswer[] = [],
): { label: string; source: DeepDiveSource; skillId: string | null } {
  const recentWrong = wrongAnswers[0];
  if (recentWrong?.skillLabel) {
    return {
      label: recentWrong.skillLabel,
      source: "wrongbook",
      skillId: recentWrong.skillId || null,
    };
  }
  const mastered = [...(mem?.skills || [])]
    .filter((s) => s.attempts > 0 && s.pKnown >= MASTERY_FLOOR)
    .sort((a, b) => b.pKnown - a.pKnown)[0];
  if (mastered) {
    return { label: mastered.label, source: "mastered", skillId: mastered.id };
  }
  const zpd = [...(mem?.skills || [])]
    .filter((s) => s.pKnown >= 0.35 && s.pKnown <= 0.72)
    .sort((a, b) => b.pKnown - a.pKnown)[0];
  return zpd
    ? { label: zpd.label, source: "zpd", skillId: zpd.id }
    : { label: "a question you're curious about", source: "zpd", skillId: null };
}

/**
 * Build this week's deep-dive offer. Returns null when already done this week
 * or there is no usable anchor.
 */
export function buildDeepDiveOffer(
  accountId: string,
  mem: LearningMemory | null | undefined,
  wrongAnswers: WrongAnswer[] = [],
  now = Date.now(),
): DeepDiveOffer | null {
  const weekOf = deepDiveWeekKey(now);
  const st = readStored(accountId, weekOf);
  if (st.done) return null;
  const anchor = pickDeepDiveAnchor(mem, wrongAnswers);
  return {
    weekOf,
    topicLabel: anchor.label,
    source: anchor.source,
    skillId: anchor.skillId,
    kickoff: buildDeepDiveKickoff(anchor.label, anchor.source),
    done: false,
  };
}

/** Read-only view (no mutation). */
export function loadDeepDiveStatus(
  accountId: string,
  now = Date.now(),
): { weekOf: string; done: boolean } {
  return readStored(accountId, deepDiveWeekKey(now));
}

/**
 * Explicit 5E loop + a small product, so the "deep dive" is a habit not a
 * one-off button (report §9.3.1). Also marks the effort as a growth moment.
 */
export function buildDeepDiveKickoff(
  topicLabel: string,
  source: DeepDiveSource,
): string {
  const opener =
    source === "wrongbook"
      ? `Let's go DEEP on "${topicLabel}" — the one that tripped me up before.`
      : `Let's go DEEP on "${topicLabel}" today.`;
  return [
    opener,
    "Run this as a weekly deep project, one step at a time:",
    "1. ENGAGE — ask me a wonder question about it first; I'll pick one to explore.",
    "2. EXPLORE — give me a small puzzle or prediction to try BEFORE you explain. No spoilers.",
    "3. EXPLAIN — now I explain it back in my own words; you check and sharpen it.",
    "4. ELABORATE — apply it to a new situation I haven't seen (real life, another subject, a harder twist).",
    "5. EVALUATE — one final self-check: what was hard, what clicked, what I'd do differently.",
    "End with a mini product: a short poster, a diagram, or a 5-line summary I can save in Studio/Journal.",
    "This is meant to be effortful — that's where the growth is. Stay Socratic the whole way.",
  ].join("\n");
}

/** Convenience: feed the wrong-answer set straight in. */
export function buildDeepDiveOfferForAccount(
  accountId: string,
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): DeepDiveOffer | null {
  return buildDeepDiveOffer(accountId, mem, buildWrongAnswerReviewSet(accountId, 3), now);
}
