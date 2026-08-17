import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  beginFlowSession,
  buildFlowMomentFromState,
  buildOpenerWithFlowContinuity,
  dismissFlowContinuity,
  emptyFlowState,
  endFlowSession,
  FLOW_CONTINUITY_MS,
  FLOW_UP_AFTER,
  flowAdviceFor,
  flowAdviceLabel,
  flowAdvicePromptNote,
  FLOW_DOWN_AFTER,
  isSingleSentence,
  recordFlowTurn,
} from "./flow-signals";
import {
  emptyLearningMemory,
  loadLearningMemory,
  normalizeMemory,
  saveLearningMemory,
} from "./learning-memory";
const ACCT = "acct_flow";

afterEach(() => {
  kvClearMemory();
  beginFlowSession();
  try {
    localStorage.removeItem(`spark.ryan.memory`);
  } catch {
    /* ignore */
  }
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

describe("flow-signals — growth-moment copy (report §9.2.1)", () => {
  it("step-up has a kid-facing label and a coach prompt note", () => {
    expect(flowAdviceLabel("step-up")).toContain("harder");
    expect(flowAdvicePromptNote("step-up")).toContain("notch harder");
  });

  it("step-down has a gentler label and prompt note", () => {
    expect(flowAdviceLabel("step-down")).toContain("gentler");
    expect(flowAdvicePromptNote("step-down")).toContain("gentler");
  });

  it("hold produces no copy for either audience", () => {
    expect(flowAdviceLabel("hold")).toBeNull();
    expect(flowAdvicePromptNote("hold")).toBeNull();
  });
});

describe("flow-signals — P0-2 cross-session continuity", () => {
  const now = Date.now();

  it("T1 24h 内 flow 事件 → 延续句；超时或无事件 → 不返回", () => {
    const mem = normalizeMemory({
      ...emptyLearningMemory(),
      lastFlowMoment: {
        label: "speed questions",
        summary: "5 fast correct on speed questions",
        at: now - 60_000,
      },
    });
    const line = buildOpenerWithFlowContinuity(mem, now);
    expect(line).toMatch(/5/);
    expect(line).toMatch(/speed questions/);
    expect(
      buildOpenerWithFlowContinuity(mem, now + FLOW_CONTINUITY_MS + 1),
    ).toBeNull();
    expect(buildOpenerWithFlowContinuity(emptyLearningMemory(), now)).toBeNull();
  });

  it("T2 dismiss 后不再出现", () => {
    const mem = normalizeMemory({
      ...emptyLearningMemory(),
      lastFlowMoment: {
        label: "fractions",
        summary: "3 fast correct on fractions",
        at: now,
      },
    });
    // simulate dismiss via learning memory field
    const dismissed = {
      ...mem,
      flowContinuityDismissedAt: now,
    };
    expect(buildOpenerWithFlowContinuity(dismissed, now)).toBeNull();
  });

  it("T3 延续句 ≤1 句且包含具体数字/技能", () => {
    let s = emptyFlowState();
    s.fastCorrectStreak = FLOW_UP_AFTER;
    const moment = buildFlowMomentFromState(s, "fraction speed");
    expect(moment?.summary).toMatch(/3/);
    const mem = endFlowSession(emptyLearningMemory(), {
      state: s,
      skillLabel: "fraction speed",
    });
    const line = buildOpenerWithFlowContinuity(mem, now)!;
    expect(isSingleSentence(line)).toBe(true);
    expect(line).toMatch(/\d/);
    expect(line.toLowerCase()).toMatch(/fraction/);
  });

  it("T4 旧记忆无 lastFlowMoment 不崩溃", () => {
    expect(() =>
      buildOpenerWithFlowContinuity({ ...emptyLearningMemory(), updatedAt: 1 }),
    ).not.toThrow();
  });

  it("dismissFlowContinuity 持久化", () => {
    if (typeof localStorage === "undefined") return;
    const mem = normalizeMemory({
      ...emptyLearningMemory(),
      lastFlowMoment: {
        label: "algebra",
        summary: "4 fast correct on algebra",
        at: now,
      },
    });
    saveLearningMemory(mem, ACCT);
    dismissFlowContinuity(ACCT);
    const loaded = loadLearningMemory(ACCT);
    expect(loaded.flowContinuityDismissedAt).toBe(now);
    expect(buildOpenerWithFlowContinuity(loaded, now)).toBeNull();
  });
});
