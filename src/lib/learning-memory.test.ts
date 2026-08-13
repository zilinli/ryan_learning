import { describe, expect, it } from "vitest";
import {
  attributionBySource,
  emptyLearningMemory,
  inferTopicsFromText,
  learningMemoryPromptLines,
  mergeLearningMemory,
  normalizeMemory,
  parseConfidence,
  recordLearningTurnMemory,
  skillStrengths,
  skillWeaknesses,
} from "./learning-memory";

describe("learning-memory", () => {
  it("infers fraction and space topics via skill catalog", () => {
    expect(inferTopicsFromText("Help with 3/4 + 2/8 fractions").map((t) => t.id)).toContain(
      "fractions",
    );
    expect(inferTopicsFromText("Why does the Moon change phases?").map((t) => t.id)).toContain(
      "science-space",
    );
  });

  it("records BKT skill updates on struggle and win", () => {
    let mem = emptyLearningMemory();
    mem = recordLearningTurnMemory(mem, {
      userText: "I'm stuck on this fraction problem",
    });
    expect(mem.skills.some((t) => t.topicId === "fractions")).toBe(true);
    expect(mem.topics.some((t) => t.id === "fractions")).toBe(true);
    expect(mem.recentStruggles[0]).toMatch(/fraction/i);
    const before = mem.skills.find((t) => t.topicId === "fractions")!.mastery;

    mem = recordLearningTurnMemory(mem, {
      userText: "got it!",
      assistantText: "Yes, that's right — nice work on equivalent fractions.",
      chatTitle: "Fractions homework",
    });
    const after = mem.skills.find((t) => t.topicId === "fractions")!.mastery;
    expect(after).toBeGreaterThan(before);
    expect(mem.recentWins[0]).toMatch(/fraction/i);
  });

  it("merges remote and local by max mastery / pKnown", () => {
    const a = recordLearningTurnMemory(emptyLearningMemory(), {
      userText: "moon phases diagram",
    });
    const b = normalizeMemory({
      topics: [
        {
          id: "science-space",
          label: "Earth–Moon–Sun / space",
          mastery: 90,
          solves: 5,
          lastSeen: Date.now(),
        },
      ],
      skills: [
        {
          id: "earth-moon-sun",
          label: "Earth–Moon–Sun / space",
          topicId: "science-space",
          pKnown: 0.9,
          mastery: 90,
          attempts: 5,
          correct: 4,
          incorrect: 1,
          lastSeen: Date.now(),
          sm2State: { ef: 2.5, interval: 7, reps: 3, prevReview: Date.now() },
          eloState: { rating: 1500, n: 0, lastUpdate: 0 },
        },
      ],
      updatedAt: Date.now(),
    });
    const merged = mergeLearningMemory(a, b);
    expect(
      merged.skills.find((t) => t.id === "earth-moon-sun")!.mastery,
    ).toBeGreaterThanOrEqual(90);
  });

  it("migrates legacy topics-only memory into skills", () => {
    const mem = normalizeMemory({
      topics: [
        {
          id: "fractions",
          label: "fractions",
          mastery: 72,
          solves: 4,
          lastSeen: 1,
        },
      ],
      updatedAt: 1,
    });
    expect(mem.skills.length).toBeGreaterThan(0);
    expect(mem.skills[0]!.mastery).toBe(72);
  });

  it("parses confidence self-report", () => {
    expect(parseConfidence("I feel like a 2")).toBe(2);
    expect(parseConfidence("confidence 3")).toBe(3);
  });

  it("exposes strengths and weaknesses helpers", () => {
    let mem = emptyLearningMemory();
    for (let i = 0; i < 4; i++) {
      mem = recordLearningTurnMemory(mem, {
        userText: "got it — fractions equivalent",
        assistantText: "Yes, that's right — nice work!",
      });
    }
    mem = recordLearningTurnMemory(mem, {
      userText: "I'm stuck on long division",
    });
    expect(skillStrengths(mem).length + skillWeaknesses(mem).length).toBeGreaterThan(0);
  });

  it("renders prompt continuity lines with BKT reference", () => {
    const mem = recordLearningTurnMemory(emptyLearningMemory(), {
      userText: "fractions worksheet",
    });
    const text = learningMemoryPromptLines(mem).join("\n");
    expect(text).toMatch(/Learning memory|BKT|skills/i);
    expect(text).toMatch(/fraction/i);
    expect(text).toMatch(/Adaptive difficulty|tailor difficulty/i);
    expect(text).toMatch(/Self-assessment|confidence/i);
  });

  it("V2 attribution: records source counts per skill and preserves them on normalize", () => {
    let mem = emptyLearningMemory();
    mem = recordLearningTurnMemory(mem, {
      userText: "I'm stuck on this fraction problem",
      source: "deepDive",
    });
    mem = recordLearningTurnMemory(mem, {
      userText: "got it! fractions equivalent",
      assistantText: "Yes, that's right — nice work!",
      source: "deepDive",
    });
    mem = recordLearningTurnMemory(mem, {
      userText: "show me more fractions",
      assistantText: "Yes — 1/2 = 2/4, nice work on equivalent fractions.",
      source: "explore",
    });

    const frac = mem.skills.find((s) => s.topicId === "fractions");
    expect(frac?.sourceCounts?.deepDive).toBeGreaterThanOrEqual(1);
    expect(frac?.sourceCounts?.explore).toBeGreaterThanOrEqual(1);
    expect(frac?.lastSource).toBe("explore");

    const restored = normalizeMemory(mem);
    const frac2 = restored.skills.find((s) => s.topicId === "fractions");
    expect(frac2?.sourceCounts?.deepDive).toBe(frac?.sourceCounts?.deepDive);
    expect(frac2?.lastSource).toBe("explore");
  });

  it("V2 attribution: attributionBySource aggregates across skills and drops junk", () => {
    const mem = normalizeMemory({
      skills: [
        {
          id: "fractions-concepts",
          label: "Fraction concepts",
          topicId: "fractions",
          pKnown: 0.5,
          mastery: 50,
          attempts: 2,
          correct: 1,
          incorrect: 1,
          lastSeen: Date.now(),
          sm2State: { ef: 2.2, interval: 2, reps: 1, prevReview: Date.now() },
          eloState: { rating: 1300, n: 2, lastUpdate: Date.now() },
          sourceCounts: {
            deepDive: 2,
            junk: 9,
          } as Partial<Record<import("./learning-memory").LearningSource, number>>,
        },
      ],
      updatedAt: Date.now(),
    });
    const rows = attributionBySource(mem);
    expect(rows[0]?.source).toBe("deepDive");
    expect(rows[0]?.count).toBe(2);
    expect(rows.some((r) => (r.source as string) === "junk")).toBe(false);
    expect(rows[0]?.label).toBe("weekly deep dives");
  });
});
