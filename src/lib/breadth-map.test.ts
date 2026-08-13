import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import {
  buildBreadthFootprint,
  buildSubjectBridges,
  consumeSubjectStarter,
  stashBreadthBridgeStarter,
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

describe("breadth-map: subject bridges (report §9.4.1)", () => {
  it("finds a cross-subject door from a mastered skill's adjacent", () => {
    // geometry-measure (math) has adjacent physics-6-8 (science)
    const m = mem(["geometry-measure"]);
    const bridges = buildSubjectBridges(m);
    const toScience = bridges.find((b) => b.to === "science");
    expect(toScience).toBeDefined();
    expect(toScience!.from).toBe("math");
    expect(toScience!.doorSkillId).toBe("physics-6-8");
    expect(toScience!.starter).toContain("I already know");
  });

  it("skips adjacent skills that are already mastered", () => {
    const now = Date.now();
    const m = normalizeMemory({
      skills: [
        {
          id: "geometry-measure",
          label: "geometry-measure",
          topicId: "geometry",
          pKnown: 0.9,
          mastery: 90,
          attempts: 5,
          correct: 4,
          incorrect: 1,
          lastSeen: now,
          sm2State: { ef: 2.5, interval: 4, reps: 2, prevReview: now },
          eloState: { rating: 1500, n: 5, lastUpdate: now },
        },
        {
          id: "physics-6-8",
          label: "physics-6-8",
          topicId: "science-phys",
          pKnown: 0.85,
          mastery: 85,
          attempts: 5,
          correct: 4,
          incorrect: 1,
          lastSeen: now,
          sm2State: { ef: 2.5, interval: 4, reps: 2, prevReview: now },
          eloState: { rating: 1500, n: 5, lastUpdate: now },
        },
      ],
      updatedAt: now,
    });
    const bridges = buildSubjectBridges(m);
    expect(bridges.find((b) => b.to === "science")).toBeUndefined();
  });

  it("keeps same-subject adjacency out of the breadth map", () => {
    // earth-moon-sun (science) → ecosystems (science): not a breadth bridge
    const bridges = buildSubjectBridges(mem(["earth-moon-sun"]));
    expect(bridges.every((b) => b.from !== b.to)).toBe(true);
  });

  it("stash/consume bridge starter routes to the chat", () => {
    const bridges = buildSubjectBridges(mem(["geometry-measure"]));
    const bridge = bridges.find((b) => b.to === "science")!;
    stashBreadthBridgeStarter(bridge);
    const k = consumeSubjectStarter();
    expect(k).not.toBeNull();
    expect(k!.subject).toBe("science");
    expect(k!.starter).toContain("I already know");
  });
});
