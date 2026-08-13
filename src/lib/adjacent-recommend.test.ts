import { describe, expect, it } from "vitest";
import { buildAdjacentKickoffMessage, buildAdjacentOpener, recommendAdjacent } from "./adjacent-recommend";
import { normalizeMemory, type LearningMemory } from "./learning-memory";

function mem(entries: Array<{ id: string; pKnown: number; attempts?: number }>): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: entries.map((e, i) => ({
      id: e.id,
      label: e.id,
      topicId: "test",
      pKnown: e.pKnown,
      mastery: Math.round(e.pKnown * 100),
      attempts: e.attempts ?? 4,
      correct: Math.round((e.attempts ?? 4) * e.pKnown),
      incorrect: (e.attempts ?? 4) - Math.round((e.attempts ?? 4) * e.pKnown),
      lastSeen: now,
      sm2State: { ef: 2.5, interval: 4, reps: 2, prevReview: now - 2 * 86_400_000 },
      eloState: { rating: 1500, n: 4, lastUpdate: now },
    })),
    updatedAt: now,
  });
}

describe("recommendAdjacent", () => {
  it("recommends a fresh adjacent skill when a skill is highly mastered", () => {
    // fractions-concepts is mastered → its adjacent ratios-proportions is fresh
    const rec = recommendAdjacent(mem([{ id: "fractions-concepts", pKnown: 0.9 }]));
    expect(rec).not.toBeNull();
    expect(rec!.fromSkillId).toBe("fractions-concepts");
    expect(rec!.skillId).toBe("ratios-proportions");
    expect(rec!.line).toContain("ratios");
  });

  it("returns null when no skill is mastered", () => {
    expect(recommendAdjacent(mem([{ id: "fractions-concepts", pKnown: 0.3 }]))).toBeNull();
  });

  it("returns null when the mastered skill has no adjacent list", () => {
    // counting-cardinality has no adjacent → nothing to recommend
    expect(recommendAdjacent(mem([{ id: "counting-cardinality", pKnown: 0.95 }]))).toBeNull();
  });

  it("prefers untouched neighbors over already-touched ones", () => {
    // earth-moon-sun mastered, adjacent = [physics-6-8, ecosystems]
    // physics is already touched (pKnown 0.4), ecosystems fresh → ecosystems
    const rec = recommendAdjacent(
      mem([
        { id: "earth-moon-sun", pKnown: 0.9 },
        { id: "physics-6-8", pKnown: 0.4 },
      ]),
    );
    expect(rec).not.toBeNull();
    expect(rec!.skillId).toBe("ecosystems");
  });

  it("skips neighbors the student already mastered", () => {
    const rec = recommendAdjacent(
      mem([
        { id: "earth-moon-sun", pKnown: 0.99 },
        { id: "physics-6-8", pKnown: 0.9 },
        { id: "ecosystems", pKnown: 0.2 },
      ]),
    );
    expect(rec).not.toBeNull();
    expect(rec!.skillId).toBe("ecosystems");
  });

  it("returns null for empty memory", () => {
    expect(recommendAdjacent(null)).toBeNull();
    expect(recommendAdjacent(mem([]))).toBeNull();
  });
});

describe("buildAdjacentKickoffMessage", () => {
  it("names both the mastered skill and the neighbor", () => {
    const rec = recommendAdjacent(mem([{ id: "fractions-concepts", pKnown: 0.9 }]))!;
    const msg = buildAdjacentKickoffMessage(rec, mem([{ id: "fractions-concepts", pKnown: 0.9 }]));
    expect(msg).toContain("fractions-concepts");
    expect(msg).toContain("ratios");
  });
});

describe("buildAdjacentOpener", () => {
  it("wraps the recommendation as a zpd SessionOpener with kickoff override", () => {
    const opener = buildAdjacentOpener(mem([{ id: "fractions-concepts", pKnown: 0.9 }]));
    expect(opener).not.toBeNull();
    expect(opener!.kind).toBe("zpd");
    expect(opener!.skillId).toBe("ratios-proportions");
    expect(opener!.kickoffOverride?.trim().length).toBeGreaterThan(10);
  });

  it("returns null when nothing to recommend", () => {
    expect(buildAdjacentOpener(mem([{ id: "counting-cardinality", pKnown: 0.95 }]))).toBeNull();
  });
});
