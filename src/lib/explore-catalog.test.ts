import { describe, expect, it } from "vitest";
import {
  buildExploreKickoffMessage,
  getExploreTopic,
  pickExploreTopics,
} from "./explore-catalog";
import { normalizeMemory, type LearningMemory } from "./learning-memory";

function memWith(skills: Array<{ id: string; label: string; pKnown: number }>): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: skills.map((s) => ({
      id: s.id,
      label: s.label,
      topicId: "test",
      pKnown: s.pKnown,
      mastery: Math.round(s.pKnown * 100),
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

describe("explore-catalog", () => {
  it("has a stable set of kid topics", () => {
    expect(getExploreTopic("space")?.emoji).toBe("🚀");
    expect(getExploreTopic("money")?.skillIds.length).toBeGreaterThan(0);
    expect(getExploreTopic("nope")).toBeUndefined();
  });

  it("picks a bounded number of topics and prefers known-skill overlap", () => {
    const mem = memWith([
      { id: "ecosystems", label: "ecosystems", pKnown: 0.9 },
      { id: "physics-6-8", label: "physics G6-8", pKnown: 0.7 },
    ]);
    const picks = pickExploreTopics(mem, 4);
    expect(picks.length).toBeLessThanOrEqual(4);
    expect(picks.length).toBeGreaterThan(0);
    const ids = picks.map((p) => p.id);
    // Topics overlapping the known skills all rank ahead of zero-overlap ones
    expect(ids).toContain("oceans");
    expect(ids).toContain("vehicles");
    expect(ids).toContain("space");
  });

  it("builds a kid-facing exploration kickoff", () => {
    const mem = memWith([
      { id: "fractions-concepts", label: "fraction concepts", pKnown: 0.6 },
    ]);
    const topic = getExploreTopic("space")!;
    const msg = buildExploreKickoffMessage(topic, mem);
    expect(msg).toMatch(/Space & planets/);
    expect(msg).toMatch(/ONE question at a time/);
    expect(msg).toMatch(/no spoilers/i);
    expect(msg).toMatch(/fraction concepts/); // anchors to what they know
  });
});
