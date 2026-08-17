import { afterEach, describe, expect, it } from "vitest";
import { FLOW_FAST_MS } from "./flow-signals";
import {
  clearExplainSkipMemory,
  EXPLAIN_PKNOWN_MED,
  isAtMostOneSentence,
  markExplainSkipped,
  shouldExplainThinking,
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
});
