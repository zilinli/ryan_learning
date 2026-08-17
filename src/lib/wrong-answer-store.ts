/**
 * P1 (report §8.9) — wrong-answer book ("错题本").
 * Persists incorrect turns (question, student answer, skill, time), groups
 * them by skill, and can build a short review set to redo in the chat.
 */

import { kvGet, kvRemove, kvSet } from "./browser-kv";
import { inferSkillsFromText } from "./skill-catalog";
import type { SessionOpener } from "./session-opener";
import type { LearningMemory } from "./learning-memory";
import {
  dueReviews,
  effectiveReviewStage,
  isReviewScheduleComplete,
  reviewStageAfterOutcome,
  scheduleReview,
  type DueReview,
} from "./schedules";

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
  /** P0-1 — 间隔复测 stage（0 = 1 天后；缺省视为 0） */
  reviewStage?: number;
  /** P0-1 — 下次复测时间戳（ms） */
  nextReviewAt?: number;
};

export type { DueReview };

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
        skillLabel: sliceText(w.skillLabel || w.skillId || "General", 56),
        question: sliceText(w.question || "", 400),
        studentAnswer: sliceText(w.studentAnswer || "", 400),
        assistantText: sliceText(w.assistantText || "", 800),
        createdAt: Number(w.createdAt) || 0,
        reviewStage:
          w.reviewStage != null
            ? Math.max(0, Math.floor(Number(w.reviewStage) || 0))
            : undefined,
        nextReviewAt:
          w.nextReviewAt != null && Number(w.nextReviewAt) > 0
            ? Number(w.nextReviewAt)
            : undefined,
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
  entry: Omit<WrongAnswer, "id" | "accountId" | "createdAt"> & { createdAt?: number },
): WrongAnswer {
  const items = loadWrongAnswers(accountId);
  const createdAt = entry.createdAt ?? Date.now();
  const skillId = String(entry.skillId).slice(0, 48);
  const row: WrongAnswer = {
    id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    skillId,
    skillLabel: sliceText(entry.skillLabel, 56),
    question: sliceText(entry.question, 400),
    studentAnswer: sliceText(entry.studentAnswer, 400),
    assistantText: sliceText(entry.assistantText, 800),
    createdAt,
    reviewStage: 0,
    nextReviewAt:
      scheduleReview(skillId, 0, { fromMs: createdAt }) ?? undefined,
  };
  items.unshift(row);
  saveWrongAnswers(accountId, items);
  return row;
}

/** P0-1 — skillId → pKnown，用于掌握降频 */
function pKnownForSkill(
  mem: LearningMemory | null | undefined,
  skillId: string,
): number | undefined {
  return mem?.skills?.find((s) => s.id === skillId)?.pKnown;
}

/** P0-1 — 到期复测列表（按 overdue 排序） */
export function loadDueReviews(
  accountId: string,
  mem?: LearningMemory | null,
  now = Date.now(),
): DueReview[] {
  return dueReviews(loadWrongAnswers(accountId), now, (skillId) =>
    pKnownForSkill(mem, skillId),
  );
}

/** P0-1 — 复测结果：答对晋级 stage，答错重置 stage 0 */
export function recordWrongAnswerReviewOutcome(
  accountId: string,
  id: string,
  correct: boolean,
  mem?: LearningMemory | null,
  now = Date.now(),
): WrongAnswer | null {
  const items = loadWrongAnswers(accountId);
  const idx = items.findIndex((w) => w.id === id);
  if (idx < 0) return null;
  const w = items[idx]!;
  const stage = effectiveReviewStage(w);
  const pKnown = pKnownForSkill(mem, w.skillId);
  const nextStage = reviewStageAfterOutcome(stage, correct);
  const nextAt = isReviewScheduleComplete(nextStage, pKnown)
    ? undefined
    : scheduleReview(w.skillId, nextStage, { fromMs: now, pKnown }) ??
      undefined;
  const updated: WrongAnswer = {
    ...w,
    reviewStage: nextStage,
    nextReviewAt: nextAt,
  };
  items[idx] = updated;
  saveWrongAnswers(accountId, items);
  return updated;
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

// ── P1-1 — this week's quiz ("组卷") ────────────────────────────────

export type WeeklyQuizItem = {
  id: string;
  skillId: string;
  skillLabel: string;
  question: string;
};

export type WeeklyQuiz = {
  /** Monday (YYYY-MM-DD) of the quiz's week. */
  weekOf: string;
  items: WeeklyQuizItem[];
};

/**
 * Build a 3–5 question quiz from this week's wrong answers, one per skill
 * (newest first). The quiz is the printable/re-doable sheet that closes the
 * "wrong answer → redo → remaster" loop (豆包/千问-style 组卷).
 */
export function buildWeeklyQuiz(
  accountId: string,
  count = 4,
  now = Date.now(),
): WeeklyQuiz {
  const weekStart = now - 7 * 86_400_000;
  const seen = new Set<string>();
  const items: WeeklyQuizItem[] = [];
  for (const w of loadWrongAnswers(accountId)) {
    if (w.createdAt < weekStart) continue;
    if (seen.has(w.skillId)) continue;
    seen.add(w.skillId);
    items.push({
      id: w.id,
      skillId: w.skillId,
      skillLabel: w.skillLabel,
      question: w.question,
    });
    const max = Math.max(3, Math.min(count, 5));
    if (items.length >= max) break;
  }
  return { weekOf: weekKeyOf(now), items };
}

/** Chat kickoff for redoing a quiz sheet (one question at a time). */
export function buildWeeklyQuizKickoffMessage(quiz: WeeklyQuiz): string {
  const lines = quiz.items.map(
    (w, i) => `Q${i + 1} (${w.skillLabel}): ${w.question}`,
  );
  return [
    "This week's quiz — let's redo these together:",
    ...lines,
    "Give them to me ONE at a time, Socratic hints only, no spoilers. Tell me right away which ones I got right this time.",
  ].join("\n");
}

/** Forget quiz items the child re-practiced successfully ("标记重做"). */
export function markWrongAnswersRedone(
  accountId: string,
  ids: string[],
): number {
  const idSet = new Set(ids);
  const before = loadWrongAnswers(accountId);
  const removed = before.filter((w) => idSet.has(w.id)).length;
  if (!removed) return 0;
  saveWrongAnswers(accountId, before.filter((w) => !idSet.has(w.id)));
  return removed;
}

/** Monday (YYYY-MM-DD) helper — mirrors learning-memory weekKeyOf. */
export function weekKeyOf(ts = Date.now()): string {
  const d = new Date(ts);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset),
  )
    .toISOString()
    .slice(0, 10);
}

function escHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Self-contained printable quiz sheet (P1-1 组卷打印) — one page a parent can
 * print for the child to work on paper, then redo in the chat.
 */
export function buildWeeklyQuizPrintHtml(
  quiz: WeeklyQuiz,
  opts: { accountLabel?: string; now?: number } = {},
): string {
  const now = opts.now ?? Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const rows = quiz.items.length
    ? quiz.items
        .map(
          (w, i) => `<li class="q">
            <div class="qno">${i + 1}</div>
            <div>
              <p class="skill">${escHtml(w.skillLabel)}</p>
              <p class="text">${escHtml(w.question)}</p>
              <div class="answer-line"></div>
            </div>
          </li>`,
        )
        .join("\n")
    : "<li class='empty'>No tricky questions this week — nice job!</li>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>This week's quiz — The Answer Book</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 640px; margin: 2rem auto; padding: 0 1.25rem; color: #1a1a1a; line-height: 1.45; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .meta { color: #555; font-size: 0.9rem; }
  ul { list-style: none; padding: 0; }
  li.q { display: flex; gap: 0.9rem; padding: 1rem 0; border-bottom: 1px solid #eee; page-break-inside: avoid; }
  .qno { font-size: 1.1rem; font-weight: 700; color: #a85f42; min-width: 1.6rem; }
  .skill { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 0.15rem; }
  .text { margin: 0 0 1rem; }
  .answer-line { border-bottom: 1px solid #aaa; height: 1.4rem; }
  .empty { color: #666; }
  footer { margin-top: 2rem; font-size: 0.75rem; color: #888; }
  @media print { body { margin: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <p class="meta">The Answer Book · AI Tutor — This week's quiz</p>
  <h1>${escHtml(opts.accountLabel || "Student")}</h1>
  <p class="meta">Week of ${escHtml(quiz.weekOf)} · Generated ${escHtml(day)}</p>
  <p class="meta">Try each one on paper first, then redo them with the tutor in the app.</p>
  <ul>
${rows}
  </ul>
  <footer>Private family record · Print or Save as PDF from the browser.</footer>
  <p class="no-print"><button type="button" onclick="window.print()">Print / Save as PDF</button></p>
</body>
</html>`;
}

export function buildDueReviewKickoffMessage(items: WrongAnswer[]): string {
  const lines = items.map(
    (w, i) => `Q${i + 1} (${w.skillLabel}): ${w.question}`,
  );
  return [
    "These wrong answers are DUE for a spaced retest — give me VARIANT questions (new numbers, same skill):",
    ...lines,
    "One at a time, Socratic hints only, no spoilers. Check whether I really remember it.",
  ].join("\n");
}

/** Opener card for due spaced reviews. */
export function buildDueReviewOpener(items: WrongAnswer[]): SessionOpener {
  return {
    skillId: "wrongbook-due",
    label: "Due retest",
    kind: "practice",
    line: `${items.length} wrong answer${items.length === 1 ? "" : "s"} due for retest — let's check you still remember.`,
    kickoffOverride: buildDueReviewKickoffMessage(items),
    source: "wrongbook",
  };
}

export function stashDueReviewKickoff(items: WrongAnswer[]): void {
  writeKickoff(JSON.stringify({ kind: "dueReview", items: items.slice(0, 5) }));
}

export function consumeDueReviewKickoff(): WrongAnswer[] | null {
  const raw = readKickoff();
  clearKickoff();
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as {
      kind?: string;
      items?: Array<Partial<WrongAnswer>>;
    };
    if (p?.kind !== "dueReview" || !Array.isArray(p.items)) return null;
    return p.items.map((w, i) => ({
      id: String(w.id || `due_${i}_${Date.now()}`),
      accountId: "local",
      skillId: String(w.skillId || "general").slice(0, 48),
      skillLabel: sliceText(w.skillLabel || w.skillId || "General", 56),
      question: sliceText(w.question || "", 400),
      studentAnswer: "",
      assistantText: "",
      createdAt: Date.now(),
      reviewStage: w.reviewStage,
      nextReviewAt: w.nextReviewAt,
    }));
  } catch {
    return null;
  }
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

// ── P1 — wrong answer → variant / harder path (report §9.3.2) ─────────

export type WrongAnswerAction = "variant" | "harder";

/**
 * Build the kickoff for a single wrong answer:
 * - "variant" re-tests the SAME skill with new numbers/situation (does the
 *   student really know it, or just this question?).
 * - "harder" steps up half a level: transfer the skill to a new context or a
 *   slightly harder extension (concept lift).
 */
export function buildVariantKickoffMessage(
  w: WrongAnswer,
  action: WrongAnswerAction,
): string {
  if (action === "variant") {
    return [
      `I got this one wrong before — now try a VARIANT of it (${w.skillLabel}):`,
      `Original: ${w.question}`,
      "Give me ONE new question like this with different numbers and a fresh situation.",
      "Check whether I really understand it or just remembered the answer. Socratic hints only, no spoilers.",
    ].join("\n");
  }
  return [
    `I got this one wrong before — now lift it UP half a level (${w.skillLabel}):`,
    `Original: ${w.question}`,
    "Give me ONE harder question that transfers this skill to a new context (real life, another subject, a tricky wording).",
    "If I'm stuck, nudge me — but make it genuinely harder than the original. No spoilers.",
  ].join("\n");
}

/** Stash a one-shot variant/harder kickoff for the homepage chat. */
export function stashVariantKickoff(
  w: WrongAnswer,
  action: WrongAnswerAction,
): void {
  writeKickoff(JSON.stringify({ action, skillId: w.skillId, skillLabel: w.skillLabel, question: w.question }));
}

export function consumeVariantKickoff(): {
  action: WrongAnswerAction;
  skillId: string;
  skillLabel: string;
  question: string;
} | null {
  const raw = readKickoff();
  clearKickoff();
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as {
      action?: WrongAnswerAction;
      skillId?: string;
      skillLabel?: string;
      question?: string;
    };
    if (!p || (p.action !== "variant" && p.action !== "harder")) return null;
    return {
      action: p.action,
      skillId: String(p.skillId || "general").slice(0, 48),
      skillLabel: sliceText(p.skillLabel || p.skillId || "General", 56),
      question: sliceText(p.question || "", 400),
    };
  } catch {
    return null;
  }
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
      question: sliceText(w.question || "", 400),
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
    source: "wrongbook",
  };
}

/** Opener card for a single wrong answer's variant / harder kickoff. */
export function buildVariantKickoffOpener(
  v: NonNullable<ReturnType<typeof consumeVariantKickoff>>,
): SessionOpener {
  const row: WrongAnswer = {
    id: `vr_${Date.now()}`,
    accountId: "local",
    skillId: v.skillId,
    skillLabel: v.skillLabel,
    question: v.question,
    studentAnswer: "",
    assistantText: "",
    createdAt: Date.now(),
  };
  return {
    skillId: v.skillId,
    label: v.skillLabel,
    kind: "practice",
    line:
      v.action === "harder"
        ? `Lift "${v.skillLabel}" up a level — one harder twist.`
        : `One more try on "${v.skillLabel}" — same idea, new numbers.`,
    kickoffOverride: buildVariantKickoffMessage(row, v.action),
    source: "variant",
  };
}
