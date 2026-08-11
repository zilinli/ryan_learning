import { describe, expect, it } from "vitest";
import {
  advanceCoachState,
  coachStatePromptBlock,
  deriveCoachStateFromHistory,
  emptyCoachState,
  isIDontKnowSignal,
} from "./coach-state";

describe("isIDontKnowSignal", () => {
  it("detects EN/ZH/Yue helplessness", () => {
    expect(isIDontKnowSignal("I don't know")).toBe(true);
    expect(isIDontKnowSignal("idk")).toBe(true);
    expect(isIDontKnowSignal("我不知道")).toBe(true);
    expect(isIDontKnowSignal("唔明")).toBe(true);
    expect(isIDontKnowSignal("直接告诉我答案")).toBe(true);
  });

  it("ignores substantive attempts", () => {
    expect(isIDontKnowSignal("I think the angle is 45 because the triangle is isosceles")).toBe(
      false,
    );
  });
});

describe("advanceCoachState", () => {
  it("starts at probe", () => {
    const s = emptyCoachState();
    expect(s.strategy).toBe("probe");
    expect(s.frustration).toBe(0);
  });

  it("raises frustration after two consecutive IDK", () => {
    let s = emptyCoachState();
    s = advanceCoachState(s, "I don't know");
    expect(s.consecutiveIDontKnow).toBe(1);
    expect(s.frustration).toBe(0);
    s = advanceCoachState(s, "我不知道");
    expect(s.consecutiveIDontKnow).toBe(2);
    expect(s.frustration).toBe(1);
  });

  it("cools frustration after a real attempt", () => {
    let s = emptyCoachState();
    s = advanceCoachState(s, "idk");
    s = advanceCoachState(s, "dunno");
    expect(s.frustration).toBe(1);
    s = advanceCoachState(
      s,
      "Maybe we add the two known angles and subtract from 180?",
    );
    expect(s.consecutiveIDontKnow).toBe(0);
    expect(s.frustration).toBe(0);
  });

  it("escalates to partial_answer under high frustration + round", () => {
    let s = emptyCoachState();
    for (let i = 0; i < 6; i++) {
      s = advanceCoachState(s, "I don't know");
    }
    expect(s.frustration).toBe(3);
    expect(s.round).toBeGreaterThanOrEqual(5);
    expect(s.strategy).toBe("partial_answer");
  });

  it("low mastery prefers scaffold earlier", () => {
    const s = advanceCoachState(emptyCoachState(0.2), "what next?");
    expect(s.strategy).toBe("scaffold");
  });
});

describe("deriveCoachStateFromHistory", () => {
  it("replays user turns then current", () => {
    const s = deriveCoachStateFromHistory(
      [
        { role: "user", content: "help" },
        { role: "assistant", content: "What do you notice?" },
        { role: "user", content: "idk" },
      ],
      "我不知道",
    );
    expect(s.consecutiveIDontKnow).toBe(2);
    expect(s.frustration).toBeGreaterThanOrEqual(1);
  });
});

describe("coachStatePromptBlock", () => {
  it("forbids full solutions after IDK streak", () => {
    let s = emptyCoachState();
    s = advanceCoachState(s, "idk");
    s = advanceCoachState(s, "idk");
    const block = coachStatePromptBlock(s);
    expect(block).toMatch(/Coach state machine/);
    expect(block).toMatch(/FORBIDDEN/);
    expect(block).toMatch(/strategy=/);
  });
});
