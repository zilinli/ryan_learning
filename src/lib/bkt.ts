/**
 * Lightweight Bayesian Knowledge Tracing (BKT) for a single learner.
 * Classic Corbett & Anderson HMM update — no EM fitting (use G4-tuned priors).
 *
 * Refs: Wikipedia “Bayesian knowledge tracing”; pyBKT (CAHLR).
 */

export type BktParams = {
  /** P(L0) — prior probability of knowing the skill */
  pInit: number;
  /** P(T) — probability of learning after an opportunity */
  pLearn: number;
  /** P(S) — slip: wrong answer when known */
  pSlip: number;
  /** P(G) — guess: right answer when unknown */
  pGuess: number;
};

/** Defaults tuned for Grade-4 scaffolding (conservative learning, modest guess/slip). */
export const DEFAULT_BKT: BktParams = {
  pInit: 0.25,
  pLearn: 0.18,
  pSlip: 0.1,
  pGuess: 0.2,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0.001, Math.min(0.999, n));
}

/** Posterior P(L | observation), then apply learning transition. */
export function bktUpdate(
  pKnown: number,
  correct: boolean,
  params: BktParams = DEFAULT_BKT,
): number {
  const pL = clamp01(pKnown);
  const { pSlip, pGuess, pLearn } = params;

  let posterior: number;
  if (correct) {
    const numer = pL * (1 - pSlip);
    const denom = numer + (1 - pL) * pGuess;
    posterior = denom > 0 ? numer / denom : pL;
  } else {
    const numer = pL * pSlip;
    const denom = numer + (1 - pL) * (1 - pGuess);
    posterior = denom > 0 ? numer / denom : pL;
  }

  // Learn step: may transition unknown → known after the opportunity
  const next = posterior + (1 - posterior) * pLearn;
  return clamp01(next);
}

export function masteryFromPKnown(pKnown: number): number {
  return Math.round(clamp01(pKnown) * 100);
}

export function pKnownFromMastery(mastery: number): number {
  return clamp01((Number(mastery) || 0) / 100);
}

/**
 * Soft outcome for tutoring turns (not binary quiz items).
 * win → treat as correct; struggle → incorrect; else a mild positive practice.
 */
export function softBktUpdate(
  pKnown: number,
  outcome: "correct" | "incorrect" | "practice",
  params: BktParams = DEFAULT_BKT,
): number {
  if (outcome === "correct") return bktUpdate(pKnown, true, params);
  if (outcome === "incorrect") return bktUpdate(pKnown, false, params);
  // Neutral practice: half-weight toward “correct” (exposure without evidence of mastery)
  const up = bktUpdate(pKnown, true, { ...params, pLearn: params.pLearn * 0.45 });
  return clamp01(pKnown * 0.55 + up * 0.45);
}
