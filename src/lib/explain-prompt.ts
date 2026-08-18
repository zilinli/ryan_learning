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
 * Compact “worked answer” (7/12, 42, x=3) — not a chat sentence.
 * The explain bar interpolates this into “How did you get …?”; conversational
 * text like “港澳通行证” must never qualify.
 */
export function looksLikeWorkedAnswer(text: string): boolean {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 40) return false;
  const words = t.split(" ").filter(Boolean);
  if (words.length > 6) return false;
  const hasDigit = /\d/.test(t);
  const hasMath = /[=+\-×÷*/^√]/.test(t);
  if (!hasDigit && !hasMath) return false;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjk >= 4 && !hasDigit) return false;
  return true;
}

/**
 * Last assistant turn looks like a problem to solve, not casual chat.
 * A travel question with “？” is not enough on its own — pair with
 * looksLikeWorkedAnswer at the call site.
 */
export function looksLikeProblemTurn(assistantText: string): boolean {
  const t = (assistantText || "").trim();
  if (!t) return false;
  if (/[?？]/.test(t)) return true;
  return /(?:\d\s*[=+\-×÷*/^√]|solve|calculate|compute|fraction|equation|多少|等于|計算|计算)/i.test(
    t,
  );
}

/**
 * Trigger condition: pKnown 中/高，或秒答；低难度且慢答不触发。
 */
export function shouldExplainThinking(input: ExplainTriggerInput): boolean {
  const fast =
    input.responseTimeMs > 0 && input.responseTimeMs <= EXPLAIN_FAST_MS;
  const mediumPlus = input.pKnown >= EXPLAIN_PKNOWN_MED;
  if (mediumPlus || fast) return true;
  return false;
}

export type ExplainHoldInput = ExplainTriggerInput & {
  studentAnswer: string;
  assistantText: string;
};

/**
 * Hold the send and show the explain bar only when this looks like a
 * homework/quiz answer — never in ordinary conversation.
 */
export function shouldHoldForExplain(input: ExplainHoldInput): boolean {
  if (!shouldExplainThinking(input)) return false;
  if (!looksLikeWorkedAnswer(input.studentAnswer)) return false;
  if (!looksLikeProblemTurn(input.assistantText)) return false;
  return true;
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
