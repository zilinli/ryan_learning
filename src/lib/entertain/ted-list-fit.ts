/**
 * Compatibility aliases for ted-fit.ts (canonical TED list ranking).
 * Prefer importing from `./ted-fit` in new code.
 */

import type { TedTalk } from "./ted-catalog";
import {
  inferTedAudience,
  sortTedTalksByLearnerFit,
  tedFitScore,
  type TedLearnerFit,
} from "./ted-fit";

export { typicalAgeForGrade } from "./ted-challenge";
export {
  clampGrade,
  inferTedAudience as resolveTedAudience,
  tedFitScore as tedListFitScore,
  type TedAudience,
  type TedLearnerFit,
} from "./ted-fit";

export function clampAge(n: number): number {
  if (!Number.isFinite(n)) return 9;
  return Math.max(4, Math.min(22, Math.round(n)));
}

export function formatTedGradeRange(min: number, max: number): string {
  const a = Math.max(1, Math.min(12, Math.round(min)));
  const b = Math.max(a, Math.min(12, Math.round(max)));
  return a === b ? `G${a}` : `G${a}–${b}`;
}

export function sortTedTalksForLearner(
  talks: TedTalk[],
  learner: TedLearnerFit = {},
): TedTalk[] {
  return sortTedTalksByLearnerFit(talks, learner).map((t) => {
    const a = inferTedAudience(t);
    return { ...t, gradeMin: a.gradeMin, gradeMax: a.gradeMax };
  });
}

/** @deprecated Use tedFitScore from ted-fit */
export const scoreTalk = tedFitScore;
