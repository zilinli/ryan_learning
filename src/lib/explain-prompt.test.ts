import { afterEach, describe, expect, it } from "vitest";
import { FLOW_FAST_MS } from "./flow-signals";
import {
  clearExplainSkipMemory,
  EXPLAIN_PKNOWN_MED,
  isAtMostOneSentence,
  looksLikeProblemTurn,
  looksLikeWorkedAnswer,
  markExplainSkipped,
  shouldExplainThinking,
  shouldHoldForExplain,
  wasExplainSkipped,
} from "./explain-prompt";
import { explainPrompt } from "./prompts";

afterEach(() => {
  clearExplainSkipMemory();
});

describe("explain-prompt — P0-3 解释思路", () => {
  it("T1 触发：pKnown 中/高或秒答触发；低难度慢答不触发", () => {
    expect(
      shouldExplainThinking({
        pKnown: EXPLAIN_PKNOWN_MED,
        responseTimeMs: 60_000,
      }),
    ).toBe(true);
    expect(
      shouldExplainThinking({
        pKnown: 0.2,
        responseTimeMs: 2_000,
      }),
    ).toBe(true);
    expect(
      shouldExplainThinking({
        pKnown: 0.2,
        responseTimeMs: FLOW_FAST_MS + 5_000,
      }),
    ).toBe(false);
  });

  it("T2 跳过：同题标记后不再追问", () => {
    markExplainSkipped("q1");
    expect(wasExplainSkipped("q1")).toBe(true);
    expect(wasExplainSkipped("q2")).toBe(false);
  });

  it("T3 文案 ≤1 句", () => {
    const p = explainPrompt({
      label: "fractions",
      studentAnswer: "7/12",
    });
    expect(p).toContain("7/12");
    expect(isAtMostOneSentence(p)).toBe(true);
    expect(isAtMostOneSentence(explainPrompt({ label: "algebra" }))).toBe(true);
  });

  it("does not interpolate conversational chat into How did you get …?", () => {
    const p = explainPrompt({
      label: "General practice",
      studentAnswer: "港澳通行证",
    });
    expect(p).not.toMatch(/港澳通行证/);
    expect(p).not.toMatch(/^How did you get /);
    expect(isAtMostOneSentence(p)).toBe(true);
  });

  it("looksLikeWorkedAnswer accepts compact math, rejects chat", () => {
    expect(looksLikeWorkedAnswer("7/12")).toBe(true);
    expect(looksLikeWorkedAnswer("42")).toBe(true);
    expect(looksLikeWorkedAnswer("x=3")).toBe(true);
    expect(looksLikeWorkedAnswer("1/2 + 1/4")).toBe(true);
    expect(looksLikeWorkedAnswer("港澳通行证")).toBe(false);
    expect(looksLikeWorkedAnswer("赶时间")).toBe(false);
    expect(looksLikeWorkedAnswer("I don't know")).toBe(false);
    expect(looksLikeWorkedAnswer("")).toBe(false);
  });

  it("shouldHoldForExplain skips casual travel chat even on a fast reply", () => {
    expect(
      shouldHoldForExplain({
        pKnown: 0.2,
        responseTimeMs: 1_000,
        studentAnswer: "港澳通行证",
        assistantText: "你有港澳通行证还是回乡证？",
      }),
    ).toBe(false);
    expect(
      shouldHoldForExplain({
        pKnown: 0.5,
        responseTimeMs: 20_000,
        studentAnswer: "7/12",
        assistantText: "What is 1/3 + 1/4?",
      }),
    ).toBe(true);
  });

  it("looksLikeProblemTurn detects questions and equations", () => {
    expect(looksLikeProblemTurn("What is 1/3 + 1/4?")).toBe(true);
    expect(looksLikeProblemTurn("你有港澳通行证还是回乡证？")).toBe(true);
    expect(looksLikeProblemTurn("Let's keep chatting about the trip.")).toBe(
      false,
    );
  });
});
