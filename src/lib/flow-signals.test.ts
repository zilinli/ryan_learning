import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  beginFlowSession,
  emptyFlowState,
  flowAdviceFor,
  FLOW_DOWN_AFTER,
  FLOW_UP_AFTER,
  recordFlowTurn,
} from "./flow-signals";

afterEach(() => {
  kvClearMemory();
  beginFlowSession();
});

describe("flow-signals — advice rules", () => {
  it("fast-correct streak raises difficulty (step-up)", () => {
    let s = emptyFlowState();
    s.fastCorrectStreak = FLOW_UP_AFTER;
    expect(flowAdviceFor(s)).toBe("step-up");
  });

  it("slow streak or wrong streak lowers difficulty (step-down)", () => {
    let s = emptyFlowState();
    s.slowStreak = FLOW_DOWN_AFTER;
    expect(flowAdviceFor(s)).toBe("step-down");
    s = emptyFlowState();
    s.consecutiveIncorrect = FLOW_DOWN_AFTER;
    expect(flowAdviceFor(s)).toBe("step-down");
  });

  it("neutral returns hold", () => {
    expect(flowAdviceFor(emptyFlowState())).toBe("hold");
  });
});

describe("flow-signals — recordFlowTurn", () => {
  it("fast correct builds the step-up signal after the threshold", () => {
    let advice = "hold";
    for (let i = 0; i < FLOW_UP_AFTER; i++) {
      advice = recordFlowTurn("correct", { latencyMs: 1_000 });
    }
    expect(advice).toBe("step-up");
  });

  it("slow turns build the step-down signal", () => {
    let advice = "hold";
    for (let i = 0; i < FLOW_DOWN_AFTER; i++) {
      advice = recordFlowTurn("incorrect", { latencyMs: 60_000 });
    }
    expect(advice).toBe("step-down");
  });

  it("slow correct turns build the hesitation signal (still not fast)", () => {
    recordFlowTurn("correct", { latencyMs: 60_000 });
    // First slow correct: counts as hesitation but not yet step-down
    expect(recordFlowTurn("correct", { latencyMs: 60_000 })).toBe("step-down");
  });

  it("neutral practice resets the fast signal", () => {
    recordFlowTurn("correct", { latencyMs: 500 });
    expect(recordFlowTurn("practice", { latencyMs: 500 })).toBe("hold");
  });
});
