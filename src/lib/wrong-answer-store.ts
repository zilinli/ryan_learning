/**
 * P1 (report §8.9) — wrong-answer book ("错题本").
 * Persists incorrect turns (question, student answer, skill, time), groups
 * them by skill, and can build a short review set to redo in the chat.
 */

import { kvGet, kvRemove, kvSet } from "./browser-kv";
import { inferSkillsFromText } from "./skill-catalog";
import type { SessionOpener } from "./session-opener";

export type WrongAnswer = {
  id: string;
  accountId: string;
  skillId: string;
  skillLabel: string;
  /** The question the student got wrong (last assistant turn). */
  question: string;
  studentAnswer: string;
  /** Assistant correction / guidance (kept short). */
  assistantText: string;
  createdAt: number;
};

const MAX_WRONG = 60;
const KEY_PREFIX = "spark.wrongAnswers.";
const KICKOFF_KEY = "spark.wrongReviewKickoff.v1";

export function wrongAnswerStorageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId || "default"}`;
}

function sliceText(t: string, n: number): string {
  return String(t || "").replace(/\s+/g, " ").trim().slice(0, n);
}

export function loadWrongAnswers(accountId: string): WrongAnswer[] {
  const raw = kvGet(wrongAnswerStorageKey(accountId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<Partial<WrongAnswer>>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((w) => w && w.skillId)
      .map((w) => ({
        id: String(w.id || `wa_${w.createdAt || Date.now()}`),
        accountId: String(w.accountId || accountId),
        skillId: String(w.skillId).slice(0, 48),
        skillLabel: sliceText(w.skillLabel || w.skillId, 56),
        question: sliceText(w.question, 400),
        studentAnswer: sliceText(w.studentAnswer, 400),
        assistantText: sliceText(w.assistantText, 800),
        createdAt: Number(w.createdAt) || 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function saveWrongAnswers(accountId: string, items: WrongAnswer[]): void {
  kvSet(wrongAnswerStorageKey(accountId), JSON.stringify(items.slice(0, MAX_WRONG)));
}

/** Infer a skill label for a raw text (falls back to a generic label). */
export function skillLabelForText(text: string): { skillId: string; skillLabel: string } {
  const hit = inferSkillsFromText(text)[0];
  return hit
    ? { skillId: hit.id, skillLabel: hit.label }
    : { skillId: "general", skillLabel: "General practice" };
}

export function addWrongAnswer(
  accountId: string,
  entry: Omit<WrongAnswer, "id" | "accountId" | "createdAt">,
): WrongAnswer {
  const items = loadWrongAnswers(accountId);
  const row: WrongAnswer = {
    id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    skillId: String(entry.skillId).slice(0, 48),
    skillLabel: sliceText(entry.skillLabel, 56),
    question: sliceText(entry.question, 400),
    studentAnswer: sliceText(entry.studentAnswer, 400),
    assistantText: sliceText(entry.assistantText, 800),
    createdAt: Date.now(),
  };
  items.unshift(row);
  saveWrongAnswers(accountId, items);
  return row;
}

export function deleteWrongAnswer(accountId: string, id: string): boolean {
  const items = loadWrongAnswers(accountId);
  const next = items.filter((w) => w.id !== id);
  if (next.length === items.length) return false;
  saveWrongAnswers(accountId, next);
  return true;
}

export type WrongAnswerGroup = {
  skillId: string;
  skillLabel: string;
  items: WrongAnswer[];
};

/** Newest-first groups, most-common skills first. */
export function wrongAnswersBySkill(accountId: string): WrongAnswerGroup[] {
  const map = new Map<string, WrongAnswer[]>();
  for (const w of loadWrongAnswers(accountId)) {
    const list = map.get(w.skillId) || [];
    list.push(w);
    map.set(w.skillId, list);
  }
  return [...map.entries()]
    .map(([skillId, items]) => ({
      skillId,
      skillLabel: items[0]?.skillLabel || skillId,
      items,
    }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** Pick up to `limit` most-recent wrong answers across skills (weekend set). */
export function buildWrongAnswerReviewSet(
  accountId: string,
  limit = 3,
): WrongAnswer[] {
  return loadWrongAnswers(accountId).slice(0, Math.max(1, limit));
}

export function buildWrongReviewKickoffMessage(items: WrongAnswer[]): string {
  const lines = items.map(
    (w, i) => `Q${i + 1} (${w.skillLabel}): ${w.question}`,
  );
  return [
    "Let's redo the ones I got wrong. I'll paste them below —",
    ...lines,
    "Give them to me ONE at a time, Socratic hints only, no spoilers. Check my new answer against what I said before.",
  ].join("\n");
}

// ── Chat handoff (sessionStorage one-shot, like practice kickoff) ───

const kickoffMemory = new Map<string, string>();

function writeKickoff(raw: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(KICKOFF_KEY, raw);
      return;
    }
  } catch {
    /* fall through */
  }
  kickoffMemory.set(KICKOFF_KEY, raw);
}

function readKickoff(): string | null {
  try {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(KICKOFF_KEY);
    }
  } catch {
    /* fall through */
  }
  return kickoffMemory.get(KICKOFF_KEY) ?? null;
}

function clearKickoff(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(KICKOFF_KEY);
    }
  } catch {
    /* ignore */
  }
  kickoffMemory.delete(KICKOFF_KEY);
}

export function stashWrongReviewKickoff(items: WrongAnswer[]): void {
  const payload = items.slice(0, 5).map((w) => ({
    skillId: w.skillId,
    skillLabel: w.skillLabel,
    question: w.question,
  }));
  writeKickoff(JSON.stringify(payload));
}

export function consumeWrongReviewKickoff(): WrongAnswer[] | null {
  const raw = readKickoff();
  clearKickoff();
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as Array<Partial<WrongAnswer>>;
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return arr.map((w, i) => ({
      id: `wr_${i}_${Date.now()}`,
      accountId: "local",
      skillId: String(w.skillId || "general").slice(0, 48),
      skillLabel: sliceText(w.skillLabel || w.skillId || "General", 56),
      question: sliceText(w.question, 400),
      studentAnswer: "",
      assistantText: "",
      createdAt: Date.now(),
    }));
  } catch {
    return null;
  }
}

/** Opener card for a wrong-answer review that auto-sends the questions. */
export function buildWrongReviewOpener(items: WrongAnswer[]): SessionOpener {
  return {
    skillId: "wrongbook",
    label: "Review box",
    kind: "practice",
    line: "Let's redo the ones that tripped you up — one at a time.",
    kickoffOverride: buildWrongReviewKickoffMessage(items),
  };
}
