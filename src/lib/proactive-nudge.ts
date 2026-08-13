/**
 * V2 P0 — proactive outreach (report §9.2.2).
 * Mirrors Khanmigo V2's "cognitive onloading": instead of waiting for the child
 * to tap a card, Spark *offers* a short review session when a wrong answer went
 * un-followed-up, or when the child returns after being idle for a while.
 *
 * Deliberately invite-only and autonomy-first:
 * - non-blocking banner, "Let's review" / "Not now";
 * - one nudge per account per cooldown window;
 * - "Not now" dismisses for the rest of the day;
 * - never escalates or interrupts mid-session.
 */

import { kvGet, kvRemove, kvSet } from "./browser-kv";
import type { ChatMessage } from "./types";
import type { PriorTier } from "./bkt";
import {
  buildWrongReviewKickoffMessage,
  loadWrongAnswers,
  type WrongAnswer,
} from "./wrong-answer-store";

export type ProactiveReason = "recent-wrong" | "idle-return";

export type ProactiveInvite = {
  reason: ProactiveReason;
  /** Wrong answers to redo together (up to 3, newest first). */
  items: WrongAnswer[];
  /** Kid-facing invite line. */
  line: string;
  /** The kickoff to send when the child says "Let's review". */
  kickoff: string;
};

/** Idle (tab hidden) longer than this before a return is worth a nudge. */
export const PROACTIVE_IDLE_MS = 5 * 60_000;
/** Wrong answer not followed up within this many turns → eligible. */
export const PROACTIVE_TURNS = 3;
/** Cooldown between nudges per account (10 min). */
export const PROACTIVE_COOLDOWN_MS = 10 * 60_000;

const PENDING_KEY_PREFIX = "spark.proactivePending.";
const SHOWN_KEY_PREFIX = "spark.proactiveShown.";
const DISMISS_KEY_PREFIX = "spark.proactiveDismiss.";

function pendingKey(accountId: string): string {
  return `${PENDING_KEY_PREFIX}${accountId || "default"}`;
}
function shownKey(accountId: string): string {
  return `${SHOWN_KEY_PREFIX}${accountId || "default"}`;
}
function dismissKey(accountId: string): string {
  return `${DISMISS_KEY_PREFIX}${accountId || "default"}`;
}

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Record that a wrong answer happened at `at` (pending a follow-up review). */
export function noteWrongAnswerAt(accountId: string, at = Date.now()): void {
  kvSet(pendingKey(accountId), String(at));
}

/** Mark that the student started a review (clears the pending state). */
export function noteReviewStarted(accountId: string): void {
  kvRemove(pendingKey(accountId));
}

/** Pending wrong-answer timestamp, or null when already reviewed. */
export function loadPendingWrongAt(accountId: string): number | null {
  const raw = kvGet(pendingKey(accountId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Turns that happened after the pending wrong answer. Returns Infinity when
 * there is no pending wrong answer (never eligible from the wrong path).
 */
export function turnsSinceLastWrong(
  messages: Pick<ChatMessage, "createdAt">[],
  pendingAt: number | null,
): number {
  if (pendingAt == null) return Infinity;
  return messages.filter((m) => m.createdAt > pendingAt).length;
}

/** The most recent wrong answers (the "review set"). */
export function pendingReviewSet(
  accountId: string,
  limit = 3,
): WrongAnswer[] {
  return loadWrongAnswers(accountId).slice(0, Math.max(1, limit));
}

/** True when the text is a wrong-answer review/variant kickoff being sent. */
export function isWrongReviewKickoff(text: string): boolean {
  const t = String(text || "");
  return (
    t.includes("Let's redo the ones I got wrong") ||
    t.includes("I got this one wrong before")
  );
}

/** Kid-facing invite copy + the review kickoff to send on accept. */
export function buildProactiveInvite(
  items: WrongAnswer[],
  reason: ProactiveReason = "recent-wrong",
): ProactiveInvite {
  const first = items[0]?.skillLabel || "that one";
  const line =
    reason === "idle-return"
      ? `Welcome back! I remember "${first}" was a bit tricky — want to spend 2 minutes on it together?`
      : items.length > 1
        ? `I noticed a couple of questions were tricky (${items
            .map((w) => w.skillLabel)
            .slice(0, 2)
            .join(", ")}) — want to spend 2 minutes on them together?`
        : `I saw "${first}" was a bit tricky — want to spend 2 minutes on it together?`;
  return {
    reason,
    items,
    line,
    kickoff: buildWrongReviewKickoffMessage(items),
  };
}

// ── Frequency / autonomy guards ─────────────────────────────────────

/** Remember that a nudge was shown (cooldown clock). */
export function markProactiveShown(accountId: string, at = Date.now()): void {
  kvSet(shownKey(accountId), String(at));
}

/** True when a nudge was shown within the cooldown window. */
export function proactiveShownRecently(
  accountId: string,
  cooldownMs = PROACTIVE_COOLDOWN_MS,
  now = Date.now(),
): boolean {
  const raw = kvGet(shownKey(accountId));
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && now - n < cooldownMs;
}

/** "Not now" → off for the rest of the day. */
export function dismissProactiveToday(
  accountId: string,
  now = new Date(),
): void {
  kvSet(dismissKey(accountId), localDateKey(now));
}

export function dismissedProactiveToday(
  accountId: string,
  now = new Date(),
): boolean {
  return kvGet(dismissKey(accountId)) === localDateKey(now);
}

/**
 * Decide whether to surface the invite right now.
 * - `recent-wrong`: a pending wrong answer exists, enough turns passed without
 *   follow-up, and no cooldown/dismissal is active.
 * - `idle-return`: child returned after ≥ PROACTIVE_IDLE_MS away (cooldown +
 *   dismissal still respected).
 */
export function shouldProactiveInvite(
  accountId: string,
  opts: {
    reason: ProactiveReason;
    /** pendingAt from loadPendingWrongAt (needed for "recent-wrong"). */
    pendingAt?: number | null;
    turnsSince?: number;
    now?: number;
    /** V3 — prior tier; high-prior learners default to reactive (report §9.2.2). */
    priorTier?: PriorTier;
  },
): boolean {
  if (dismissedProactiveToday(accountId)) return false;
  if (proactiveShownRecently(accountId, PROACTIVE_COOLDOWN_MS, opts?.now)) {
    return false;
  }
  if (opts.reason === "idle-return") return true;
  // recent-wrong — high-prior students are on reactive by default: proactive
  // interruption has ~zero marginal benefit for them and can break flow
  // (mixed human-AI tiering + flow evidence). They still get idle-return.
  if (opts.priorTier === "high") return false;
  if (opts.pendingAt == null) return false;
  if (opts.turnsSince == null || opts.turnsSince < PROACTIVE_TURNS) return false;
  return true;
}
