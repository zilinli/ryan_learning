/**
 * Lightweight Bayesian Knowledge Tracing (BKT) for a single learner.
 * Classic Corbett & Anderson HMM update — no EM fitting (use G4-tuned priors).
 *
 * Also includes SM-2 spaced-repetition decay to model skill forgetting over days,
 * and ZPD (Zone of Proximal Development) scoring for difficulty recommendation.
 *
 * Refs: Wikipedia "Bayesian knowledge tracing"; pyBKT (CAHLR);
 *       SM-2: Woźniak (1987) — x1ee7/sm2-spaced-repetition;
 *       ZPD: Vygotsky; bkt.tyche.institute pipeline
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

/** SM-2 spaced-repetition state per skill. */
export type Sm2State = {
  /** Ease factor (≥ 1.3). Default 2.5, higher = easier. */
  ef: number;
  /** Days until next review (integer ≥ 1). */
  interval: number;
  /** Consecutive correct repetitions. */
  reps: number;
  /** Timestamp of previous review (ms). */
  prevReview: number;
};

/** Default SM-2 state for a newly introduced skill. */
export const DEFAULT_SM2: Sm2State = {
  ef: 2.5,
  interval: 1,
  reps: 0,
  prevReview: 0,
};

/** Bounds for SM-2 easiness factor. */
const SM2_EF_MIN = 1.3;
const DAY_MS = 86_400_000;

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
  // Neutral practice: half-weight toward "correct" (exposure without evidence of mastery)
  const up = bktUpdate(pKnown, true, { ...params, pLearn: params.pLearn * 0.45 });
  return clamp01(pKnown * 0.55 + up * 0.45);
}

// ── SM-2 Spaced Repetition ──────────────────────────────────────────

/**
 * Apply SM-2 forgetting decay to a skill's pKnown.
 * Models retrieval-strength decay over days since last review.
 *
 * Uses the SM-2 retrieval probability approximation:
 *   P(retrieval) ≈ 1 - 1/(interval * EF)^0.5
 * scaled by pKnown as the baseline.
 */
export function applySm2Decay(pKnown: number, sm2: Sm2State, now: number): number {
  if (sm2.prevReview <= 0) return pKnown;
  const daysSince = Math.max(0, (now - sm2.prevReview) / DAY_MS);
  if (daysSince < 0.5) return pKnown;

  // Retrieval probability from SM-2 theory: harder to recall as interval grows
  const ival = Math.max(1, sm2.interval);
  const ef = Math.max(SM2_EF_MIN, sm2.ef);
  const retrievalProb = Math.min(1, 1 / Math.sqrt((daysSince / ival) * ef));

  // Blend: decay pKnown toward 0 proportionally to retrieval failure
  const decayed = pKnown * retrievalProb;
  return clamp01(decayed);
}

/**
 * SM-2 update after a review turn.
 * Updates easiness factor, interval, and repetitions based on outcome.
 * Reference: classic SM-2 algorithm (Woźniak 1987).
 *
 * @param sm2  current SM-2 state
 * @param quality  self-assessed quality 0–5 (0=total blackout, 5=perfect)
 * @param now  timestamp of this review
 */
export function sm2Update(sm2: Sm2State, quality: number, now: number): Sm2State {
  const q = clamp(quality, 0, 5);
  let { ef, reps, interval } = sm2;

  if (q < 3) {
    // Failed: reset reps, shorten interval
    reps = 0;
    interval = 1;
  } else {
    // Passed: update EF and interval
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);

    reps += 1;
  }

  // SM-2 easiness factor update
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < SM2_EF_MIN) ef = SM2_EF_MIN;

  return { ef, interval, reps, prevReview: now };
}

/**
 * Map a BKT learning outcome to SM-2 quality rating (0–5).
 * correct → 4 (good), incorrect → 1 (blackout), practice → 3 (passable).
 * Confidence can adjust: high-conf + wrong = 0 (total blackout).
 */
export function outcomeToSm2Quality(
  outcome: "correct" | "incorrect" | "practice",
  confidence?: number,
): number {
  if (outcome === "correct") {
    if (confidence === 3) return 5; // high-confidence correct → perfect
    return 4;
  }
  if (outcome === "incorrect") {
    if (confidence === 3) return 0; // high-confidence wrong → total blackout
    if (confidence === 2) return 1;
    return 2; // low-confidence wrong → just barely wrong
  }
  // practice: neutral
  return 3;
}

// ── ZPD (Zone of Proximal Development) Scoring ─────────────────────

/**
 * Score a skill for ZPD suitability.
 * Returns a closeness-to-optimal score where 1.0 = perfect ZPD match (P≈0.7).
 * Skills too easy (P>0.9) or too hard (P<0.3) score lower.
 */
export function zpdScore(pKnown: number): number {
  const target = 0.7;
  const dist = Math.abs(pKnown - target);
  // Gaussian-like decay: peak at target, drop off as distance increases
  return Math.exp(-dist * dist * 6);
}

/**
 * Compute P(solve) for a skill — simple proxy from pKnown.
 * Accounts for slip (know it but fail) and guess (don't know but succeed).
 */
export function pSolve(
  pKnown: number,
  pSlip: number = DEFAULT_BKT.pSlip,
  pGuess: number = DEFAULT_BKT.pGuess,
): number {
  return pKnown * (1 - pSlip) + (1 - pKnown) * pGuess;
}

/**
 * Joint P(solve) across multiple skills (geometric mean approximation).
 */
export function jointPSolve(skills: number[]): number {
  if (!skills.length) return 0;
  const logSum = skills.reduce((sum, p) => sum + Math.log(Math.max(0.001, p)), 0);
  return Math.exp(logSum / skills.length);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ── Elo-hybrid Difficulty Tracking (Phase 1.6) ─────────────────────

/** Per-skill Elo rating for item difficulty. Reference: Pelánek (2016). */
export type EloState = {
  /** Current Elo rating (default 1500). Higher = harder. */
  rating: number;
  /** Total number of attempts (for dynamic K-value). */
  n: number;
  /** Last update timestamp (ms). */
  lastUpdate: number;
};

export const DEFAULT_ELO: EloState = {
  rating: 1500,
  n: 0,
  lastUpdate: 0,
};

const ELO_DEFAULT_K = 32;

/**
 * Dynamic K-factor for Elo updates.
 * Large K for new topics (uncertain), smaller K for familiar topics.
 */
function eloKValue(n: number): number {
  if (n <= 3) return 48;
  if (n <= 8) return 32;
  return 24;
}

/**
 * Compute expected probability of a correct answer given the Elo rating.
 * Standard Elo formula: P = 1 / (1 + 10^((R_opponent - R_player) / 400))
 * Here we model the skill's difficulty (rating) vs a fixed student ability.
 * High rating → hard item → low P(correct).
 */
function eloExpected(difficultyRating: number, studentRating = 1400): number {
  return 1 / (1 + 10 ** ((difficultyRating - studentRating) / 400));
}

/**
 * Update Elo difficulty rating after a turn.
 * Correct → item was too easy (rating decreases).
 * Incorrect → item was too hard (rating increases).
 *
 * @param elo     current Elo state
 * @param outcome observed outcome
 * @param now     timestamp
 */
export function eloUpdate(
  elo: EloState,
  outcome: "correct" | "incorrect" | "practice",
  now: number,
): EloState {
  const n = elo.n + 1;
  const K = eloKValue(n);
  const expected = eloExpected(elo.rating);
  let actual: number;
  if (outcome === "correct") actual = 1;
  else if (outcome === "incorrect") actual = 0;
  else actual = 0.55; // practice → slight positive

  const rating = Math.round(elo.rating + K * (actual - expected));
  return {
    rating: clamp(rating, 800, 2600),
    n,
    lastUpdate: now,
  };
}

/**
 * Adjust BKT parameters based on Elo difficulty.
 * Harder items (high Elo) → higher slip, lower guess.
 * Easier items (low Elo) → lower slip, higher guess.
 */
export function difficultyAdjustedBktParams(
  elo: EloState,
  base = DEFAULT_BKT,
): { pSlip: number; pGuess: number } {
  // Normalize difficulty: 0 (very easy) to 1 (very hard)
  const t = clamp((elo.rating - 1000) / 1600, 0, 1);
  // Slip rises with difficulty: base ~0.07 → 0.14 at hardest
  const pSlip = clamp01(base.pSlip * (0.7 + 0.6 * t));
  // Guess falls with difficulty: base ~0.22 → 0.13 at hardest
  const pGuess = clamp01(base.pGuess * (1.15 - 0.5 * t));
  return { pSlip, pGuess };
}
