/**
 * P0 — in-session flow signals (report §9.2.1).
 * Lightweight "is this child in flow?" tracker that feeds difficulty
 * micro-adjustments: fast correct streaks suggest the challenge is too low
 * (step up), repeated slow/stuck turns suggest anxiety (step down).
 *
 * Deliberately tiny and deterministic: every rule is a pure function on the
 * state so it can be unit-tested and tuned without an RL loop.
 */

import { kvGet, kvSet, kvRemove } from "./browser-kv";

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
