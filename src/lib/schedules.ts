/**
 * P0-1 — 错题间隔复测排程（深度维度，report §7 P0）。
 * Roediger & Karpicke 2010 检索练习：1 / 3 / 7 天阶梯到期队列。
 */

import type { WrongAnswer } from "./wrong-answer-store";

/** 复测间隔（天）—— stage 0→1d, 1→3d, 2→7d */
export const retentionStages = [1, 3, 7] as const;

/** BKT 掌握阈值：达到后不再进入到期队列 */
export const MASTERED_PKNOWN = 0.8;

const DAY_MS = 86_400_000;

export type DueReview = {
  item: WrongAnswer;
  /** 已过期多久（ms），越大越 urgent */
  overdueMs: number;
};

/**
 * 根据 stage 计算下次复测时间；掌握（pKnown ≥ 0.8）或 stage 已走完则返回 null。
 */
export function scheduleReview(
  skillId: string,
  stageIndex: number,
  opts: { fromMs?: number; pKnown?: number } = {},
): number | null {
  void skillId; // 预留按 skill 定制间隔
  const pKnown = opts.pKnown;
  if (pKnown != null && pKnown >= MASTERED_PKNOWN) return null;
  if (stageIndex >= retentionStages.length) return null;
  const days = retentionStages[Math.max(0, stageIndex)]!;
  return (opts.fromMs ?? Date.now()) + days * DAY_MS;
}

/** 答对晋级 stage；答错重置 stage 0 */
export function reviewStageAfterOutcome(
  currentStage: number,
  correct: boolean,
): number {
  if (!correct) return 0;
  return currentStage + 1;
}

/** 该条目是否已完成全部间隔复测（或已掌握） */
export function isReviewScheduleComplete(
  stage: number,
  pKnown?: number,
): boolean {
  if (pKnown != null && pKnown >= MASTERED_PKNOWN) return true;
  return stage >= retentionStages.length;
}

/** 缺省 reviewStage（旧条目兼容） */
export function effectiveReviewStage(w: WrongAnswer): number {
  return Math.max(0, Math.floor(Number(w.reviewStage) || 0));
}

/**
 * 返回到期复测列表，按 overdue 降序（过期越久越靠前）。
 * `skillPKnown` 用于掌握降频过滤。
 */
export function dueReviews(
  wrongbook: WrongAnswer[],
  now: number,
  skillPKnown?: (skillId: string) => number | undefined,
): DueReview[] {
  const out: DueReview[] = [];
  for (const w of wrongbook) {
    const stage = effectiveReviewStage(w);
    const pKnown = skillPKnown?.(w.skillId);
    if (isReviewScheduleComplete(stage, pKnown)) continue;

    let dueAt = w.nextReviewAt;
    if (dueAt == null || dueAt <= 0) {
      // 旧条目：视为 stage 0，从 createdAt + 1 天起算
      dueAt = w.createdAt + retentionStages[0]! * DAY_MS;
    }
    if (dueAt <= now) {
      out.push({ item: w, overdueMs: now - dueAt });
    }
  }
  return out.sort((a, b) => b.overdueMs - a.overdueMs);
}
