/**
 * P0-3 — 「解释你的思路」轻提示（深度维度，Khanmigo cognitive onloading）。
 * 判分前触发判定 + 跳过逻辑；文案生成见 prompts.explainPrompt。
 */

import { FLOW_FAST_MS } from "./flow-signals";

/** pKnown 中档阈值（≈「有一定基础」） */
export const EXPLAIN_PKNOWN_MED = 0.45;

/** 秒答：与 flow-signals 共用 FAST 阈值 */
export const EXPLAIN_FAST_MS = FLOW_FAST_MS;

export type ExplainTriggerInput = {
  /** 该技能 BKT pKnown（0–1） */
  pKnown: number;
  /** 学生作答耗时（ms）；0 / 负值视为未知 */
  responseTimeMs: number;
};

/**
 * 触发条件：pKnown 中/高，或秒答；低难度且慢答不触发。
 */
export function shouldExplainThinking(input: ExplainTriggerInput): boolean {
  const fast =
    input.responseTimeMs > 0 && input.responseTimeMs <= EXPLAIN_FAST_MS;
  const mediumPlus = input.pKnown >= EXPLAIN_PKNOWN_MED;
  if (mediumPlus || fast) return true;
  return false;
}

/** 同题是否已跳过追问（内存 Set，测试可注入） */
const skippedQuestionIds = new Set<string>();

export function markExplainSkipped(questionId: string): void {
  if (questionId) skippedQuestionIds.add(questionId);
}

export function wasExplainSkipped(questionId: string): boolean {
  return skippedQuestionIds.has(questionId);
}

/** 测试清理 */
export function clearExplainSkipMemory(): void {
  skippedQuestionIds.clear();
}

/** 文案 ≤1 句校验 */
export function isAtMostOneSentence(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const parts = t.split(/[.!?。！？]+/).filter((s) => s.trim().length > 0);
  return parts.length <= 1 && !t.includes("\n");
}
