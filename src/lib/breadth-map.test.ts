import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import {
  buildBreadthFootprint,
  consumeSubjectStarter,
  stashSubjectStarter,
  subjectForInterest,
} from "./breadth-map";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import { interestStorageKey } from "./interest-store";

const ACCT = "acct_breadth";

function mem(ids: string[]): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: ids.map((id, i) => ({
      id,
      label: id,
      topicId: "test",
      pKnown: i === 0 ? 0.9 : 0.5,
      mastery: i === 0 ? 90 : 50,
      attempts: 4,
      correct: 3,
      incorrect: 1,
      lastSeen: now,
      sm2State: { ef: 2.5, interval: 4, reps: 2, prevReview: now - 2 * 86_400_000 },
      eloState: { rating: 1500, n: 4, lastUpdate: now },
    })),
    updatedAt: now,
  });
}

afterEach(() => {
  kvClearMemory();
  consumeSubjectStarter();
  for (const k of [interestStorageKey(ACCT)]) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(k);
  }
});

describe("breadth-map", () => {
  it("marks subjects explored when skills are attempted", () => {
    const fp = buildBreadthFootprint(mem(["multiplication-facts", "ecosystems"]), ACCT);
    const math = fp.find((f) => f.subject === "math")!;
    const sci = fp.find((f) => f.subject === "science")!;
    const humanities = fp.find((f) => f.subject === "humanities")!;
    expect(math.explored).toBe(true);
    expect(math.skillCount).toBe(1);
    expect(sci.explored).toBe(true);
    expect(humanities.explored).toBe(false);
    expect(humanities.starter.length).toBeGreaterThan(10);
  });

  it("subjectForInterest guesses broad domains from topics", () => {
    expect(subjectForInterest({ topicId: "space", label: "Space" })).toBe("science");
    expect(subjectForInterest({ topicId: "money", label: "Money" })).toBe("math");
    expect(subjectForInterest({ topicId: "robots", label: "Robots" })).toBe("science");
  });

  it("stash/consume subject starter is one-shot", () => {
    const fp = buildBreadthFootprint(mem([]), ACCT);
    const untouched = fp.find((f) => !f.explored)!;
    stashSubjectStarter(untouched);
    const k = consumeSubjectStarter();
    expect(k).not.toBeNull();
    expect(k!.label).toBe(untouched.label);
    expect(k!.starter.length).toBeGreaterThan(10);
    expect(consumeSubjectStarter()).toBeNull();
  });
});
