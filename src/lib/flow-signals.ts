/**
 * P0 — in-session flow signals (report §9.2.1).
 * Lightweight "is this child in flow?" tracker that feeds difficulty
 * micro-adjustments: fast correct streaks suggest the challenge is too low
 * (step up), repeated slow/stuck turns suggest anxiety (step down).
 *
 * P0-2 — cross-session flow continuity: session-end highlights persist into
 * learning memory and surface as a one-line opener reference (24h window).
 *
 * Deliberately tiny and deterministic: every rule is a pure function on the
 * state so it can be unit-tested and tuned without an RL loop.
 */

import { kvGet, kvSet, kvRemove } from "./browser-kv";
import type { LastFlowMoment, LearningMemory } from "./learning-memory";
import {
  loadLearningMemory,
  normalizeMemory,
  saveLearningMemory,
} from "./learning-memory";

export type FlowOutcome = "correct" | "incorrect" | "practice";

export type FlowState = {
  /** Correct answers in a row this session */
  consecutiveCorrect: number;
  /** Incorrect answers in a row this session */
  consecutiveIncorrect: number;
  /** Correct AND answered fast — the "too easy" signal */
  fastCorrectStreak: number;
  /** Slow/stuck turns in a row — the "too hard" signal */
  slowStreak: number;
  totalCorrect: number;
  totalIncorrect: number;
  lastOutcome?: FlowOutcome;
};

export type FlowAdvice = "step-up" | "step-down" | "hold";

/** Answer latency under this (ms) counts as "fast / high-confidence". */
export const FLOW_FAST_MS = 6_000;
/** Answer latency over this (ms) counts as "slow / hesitating". */
export const FLOW_SLOW_MS = 30_000;
/** Fast correct answers in a row before we step the difficulty up. */
export const FLOW_UP_AFTER = 3;
/** Slow or wrong turns in a row before we step the difficulty down. */
export const FLOW_DOWN_AFTER = 2;
/** P0-2 — flow continuity window (24h). */
export const FLOW_CONTINUITY_MS = 24 * 60 * 60 * 1000;

const FLOW_KEY = "spark.flowState.v1";

export function emptyFlowState(): FlowState {
  return {
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    fastCorrectStreak: 0,
    slowStreak: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
  };
}

export function loadFlowState(): FlowState {
  const raw = kvGet(FLOW_KEY);
  if (!raw) return emptyFlowState();
  try {
    const p = JSON.parse(raw) as Partial<FlowState>;
    const s = emptyFlowState();
    s.consecutiveCorrect = Math.max(0, Math.floor(Number(p.consecutiveCorrect) || 0));
    s.consecutiveIncorrect = Math.max(0, Math.floor(Number(p.consecutiveIncorrect) || 0));
    s.fastCorrectStreak = Math.max(0, Math.floor(Number(p.fastCorrectStreak) || 0));
    s.slowStreak = Math.max(0, Math.floor(Number(p.slowStreak) || 0));
    s.totalCorrect = Math.max(0, Math.floor(Number(p.totalCorrect) || 0));
    s.totalIncorrect = Math.max(0, Math.floor(Number(p.totalIncorrect) || 0));
    if (p.lastOutcome) s.lastOutcome = p.lastOutcome;
    return s;
  } catch {
    return emptyFlowState();
  }
}

function saveFlowState(s: FlowState): void {
  kvSet(FLOW_KEY, JSON.stringify(s));
}

/** Reset the session flow tracker (call when a fresh tutoring session starts). */
export function beginFlowSession(): void {
  kvRemove(FLOW_KEY);
}

/** Pure decision rule — exported for tests. */
export function flowAdviceFor(s: FlowState): FlowAdvice {
  if (s.fastCorrectStreak >= FLOW_UP_AFTER) return "step-up";
  if (s.slowStreak >= FLOW_DOWN_AFTER || s.consecutiveIncorrect >= FLOW_DOWN_AFTER) {
    return "step-down";
  }
  return "hold";
}

/**
 * Record one classified turn and return the difficulty advice.
 * `latencyMs` drives the fast/slow flags (0 / omitted = neutral).
 */
export function recordFlowTurn(
  outcome: FlowOutcome,
  opts?: { latencyMs?: number },
): FlowAdvice {
  const s = loadFlowState();
  const latency = opts?.latencyMs;
  const fast = latency != null && latency <= FLOW_FAST_MS;
  const slow = latency != null && latency >= FLOW_SLOW_MS;

  if (outcome === "correct") {
    s.consecutiveCorrect += 1;
    s.consecutiveIncorrect = 0;
    s.totalCorrect += 1;
    s.fastCorrectStreak = fast ? s.fastCorrectStreak + 1 : 0;
    s.slowStreak = slow ? s.slowStreak + 1 : 0;
  } else if (outcome === "incorrect") {
    s.consecutiveIncorrect += 1;
    s.consecutiveCorrect = 0;
    s.totalIncorrect += 1;
    s.fastCorrectStreak = 0;
    s.slowStreak = slow ? s.slowStreak + 1 : 0;
  } else {
    // neutral practice — keep signals but don't push either way
    s.fastCorrectStreak = 0;
  }
  s.lastOutcome = outcome;
  saveFlowState(s);
  return flowAdviceFor(s);
}

/** Kid-facing label for the advice, used for the "growth moment" line. */
export function flowAdviceLabel(advice: FlowAdvice): string | null {
  if (advice === "step-up") return "That was fast — you're ready for a harder spin.";
  if (advice === "step-down") return "Let's make the next one a little gentler.";
  return null;
}

/**
 * Coach-facing prompt note (report §9.2.1): lets the LLM adjust the *next*
 * question's difficulty in any conversation, not just challenge mode.
 */
export function flowAdvicePromptNote(advice: FlowAdvice): string | null {
  if (advice === "step-up") {
    return "The child just breezed through a fast correct streak — nudge the next question a notch harder.";
  }
  if (advice === "step-down") {
    return "The child is stuck or hesitating — make the next question a little gentler.";
  }
  return null;
}

// ── P0-2 — 跨会话心流延续 ───────────────────────────────────────────

/** 从当前 flow 状态提取可持久化的高光时刻；无足够信号则 null。 */
export function buildFlowMomentFromState(
  state: FlowState,
  skillLabel = "speed questions",
): LastFlowMoment | null {
  const streak = Math.max(state.fastCorrectStreak, state.consecutiveCorrect);
  if (streak < FLOW_UP_AFTER) return null;
  const now = Date.now();
  return {
    label: skillLabel.slice(0, 56),
    summary: `${streak} fast correct on ${skillLabel.slice(0, 40)}`,
    at: now,
  };
}

/**
 * 会话结束：把 lastFlowMoment 写入学习记忆（caller 负责 saveLearningMemory）。
 * 新 moment 会清除 dismiss 标记。
 */
export function endFlowSession(
  mem: LearningMemory,
  opts?: { state?: FlowState; skillLabel?: string },
): LearningMemory {
  const state = opts?.state ?? loadFlowState();
  const moment = buildFlowMomentFromState(state, opts?.skillLabel);
  const base = normalizeMemory(mem);
  if (!moment) return base;
  return normalizeMemory({
    ...base,
    lastFlowMoment: moment,
    flowContinuityDismissedAt: undefined,
    updatedAt: Date.now(),
  });
}

/**
 * 24h 内有 flow 事件且未 dismiss → 返回 ≤1 句延续引用；否则 null。
 */
export function buildOpenerWithFlowContinuity(
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): string | null {
  const m = mem ? normalizeMemory(mem) : null;
  const fm = m?.lastFlowMoment;
  if (!fm) return null;
  if (now - fm.at > FLOW_CONTINUITY_MS) return null;
  if (
    m!.flowContinuityDismissedAt != null &&
    m!.flowContinuityDismissedAt >= fm.at
  ) {
    return null;
  }
  const n = fm.summary.match(/\d+/)?.[0] ?? String(FLOW_UP_AFTER);
  const line = `Last time you nailed ${n} ${fm.label} questions fast — let's try beating that pace.`;
  return isSingleSentence(line) ? line : line.split(".")[0] + ".";
}

/** 延续句必须为单句（测试 / 校验用）。 */
export function isSingleSentence(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const sentences = t.split(/[.!?。！？]+/).filter((s) => s.trim().length > 0);
  return sentences.length <= 1;
}

/** 持久化忽略标记 — 当前 lastFlowMoment 不再出现在 opener 下方。 */
export function dismissFlowContinuity(accountId: string): void {
  const mem = loadLearningMemory(accountId);
  const fm = mem.lastFlowMoment;
  if (!fm) return;
  saveLearningMemory(
    {
      ...normalizeMemory(mem),
      flowContinuityDismissedAt: fm.at,
      updatedAt: Date.now(),
    },
    accountId,
  );
}
