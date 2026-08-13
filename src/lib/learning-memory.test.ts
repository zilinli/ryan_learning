import { describe, expect, it, vi } from "vitest";
import {
  attributionBySource,
  emptyLearningMemory,
  inferTopicsFromText,
  learningMemoryPromptLines,
  mergeLearningMemory,
  normalizeMemory,
  parseConfidence,
  recordLearningTurnMemory,
  serializeLearningMemoryForChat,
  skillStrengths,
  skillWeaknesses,
  weekKeyOf,
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

  it("V2 attribution: attributionBySource aggregates weekly buckets across skills and drops junk", () => {
    const now = Date.now();
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
          sourceCountsWeek: {
            deepDive: 2,
            junk: 9,
          } as Partial<Record<import("./learning-memory").LearningSource, number>>,
          sourceWeekKey: weekKeyOf(now),
        },
        {
          id: "place-value",
          label: "Place value",
          topicId: "place-value",
          pKnown: 0.7,
          mastery: 70,
          attempts: 3,
          correct: 2,
          incorrect: 1,
          lastSeen: Date.now(),
          sm2State: { ef: 2.3, interval: 2, reps: 1, prevReview: Date.now() },
          eloState: { rating: 1350, n: 3, lastUpdate: Date.now() },
          sourceCounts: { deepDive: 1, explore: 1 },
          sourceCountsWeek: { deepDive: 1, explore: 1 },
          // Last week's bucket — must NOT leak into this week's attribution.
          sourceWeekKey: weekKeyOf(now - 7 * 86_400_000),
        },
      ],
      updatedAt: Date.now(),
    });
    const rows = attributionBySource(mem);
    expect(rows[0]?.source).toBe("deepDive");
    expect(rows[0]?.count).toBe(2);
    expect(rows.some((r) => (r.source as string) === "junk")).toBe(false);
    expect(rows.some((r) => r.source === "explore")).toBe(false);
    expect(rows[0]?.label).toBe("weekly deep dives");
  });

  it("V3 attribution: weekly bucket rolls over when the week changes", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-10T12:00:00Z")); // Monday
      let mem = emptyLearningMemory();
      mem = recordLearningTurnMemory(mem, {
        userText: "I'm stuck on this fraction problem",
        source: "deepDive",
      });
      let frac = mem.skills.find((s) => s.topicId === "fractions");
      expect(frac?.sourceWeekKey).toBe("2026-08-10");
      expect(frac?.sourceCountsWeek?.deepDive).toBe(1);

      vi.setSystemTime(new Date("2026-08-17T12:00:00Z")); // next Monday
      mem = recordLearningTurnMemory(mem, {
        userText: "more fraction practice",
        assistantText: "Yes — 1/2 = 2/4, nice work on equivalent fractions.",
        source: "challenge",
      });
      frac = mem.skills.find((s) => s.topicId === "fractions");
      expect(frac?.sourceWeekKey).toBe("2026-08-17");
      expect(frac?.sourceCountsWeek?.deepDive).toBeUndefined();
      expect(frac?.sourceCountsWeek?.challenge).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("V3: serializeLearningMemoryForChat keeps sourceCounts + lastSource", () => {
    let mem = emptyLearningMemory();
    mem = recordLearningTurnMemory(mem, {
      userText: "I'm stuck on this fraction problem",
      source: "wrongbook",
    });
    mem = recordLearningTurnMemory(mem, {
      userText: "got it! fractions equivalent",
      assistantText: "Yes, that's right — nice work!",
      source: "variant",
    });
    const serialized = serializeLearningMemoryForChat(mem);
    const frac = serialized.skills.find(
      (s) => s.topicId === "fractions" && s.sourceCounts?.wrongbook,
    );
    expect(frac).toBeDefined();
    expect(frac?.sourceCounts?.wrongbook).toBeGreaterThanOrEqual(1);
    expect(frac?.sourceCounts?.variant).toBeGreaterThanOrEqual(1);
    expect(frac?.lastSource).toBe("variant");
  });

  it("V3: mergeSkill merges sourceCounts idempotently (max) and keeps the newer lastSource", () => {
    const now = Date.now();
    const a = normalizeMemory({
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
          lastSeen: now - 10,
          sm2State: { ef: 2.2, interval: 2, reps: 1, prevReview: now - 10 },
          eloState: { rating: 1300, n: 2, lastUpdate: now - 10 },
          sourceCounts: { deepDive: 3, wrongbook: 1 },
          lastSource: "deepDive",
        },
      ],
      updatedAt: now,
    });
    const b = normalizeMemory({
      skills: [
        {
          id: "fractions-concepts",
          label: "Fraction concepts",
          topicId: "fractions",
          pKnown: 0.6,
          mastery: 60,
          attempts: 3,
          correct: 2,
          incorrect: 1,
          lastSeen: now,
          sm2State: { ef: 2.3, interval: 3, reps: 2, prevReview: now },
          eloState: { rating: 1320, n: 3, lastUpdate: now },
          sourceCounts: { wrongbook: 2, explore: 1 },
          lastSource: "explore",
        },
      ],
      updatedAt: now,
    });
    const merged = mergeLearningMemory(a, b);
    const frac = merged.skills.find((s) => s.id === "fractions-concepts");
    expect(frac?.sourceCounts?.deepDive).toBe(3);
    expect(frac?.sourceCounts?.wrongbook).toBe(2);
    expect(frac?.sourceCounts?.explore).toBe(1);
    expect(frac?.lastSource).toBe("explore");
  });

  it("V3: mergeLearningMemory dedups gapHistory by skillId and unions days", () => {
    const now = Date.now();
    const gap = (expiresAt: number) => [
      {
        skillId: "physics-6-8",
        label: "Physics 6–8",
        days: ["2026-08-10"],
        expiresAt,
      },
    ];
    const a = normalizeMemory({
      skills: [
        {
          id: "physics-6-8",
          label: "Physics 6–8",
          topicId: "physics",
          pKnown: 0.4,
          mastery: 40,
          attempts: 2,
          correct: 1,
          incorrect: 1,
          lastSeen: now,
          sm2State: { ef: 2.2, interval: 2, reps: 1, prevReview: now },
          eloState: { rating: 1300, n: 2, lastUpdate: now },
        },
      ],
      gapHistory: gap(now + 86_400_000),
      updatedAt: now,
    });
    const b = normalizeMemory({
      ...a,
      gapHistory: gap(now + 2 * 86_400_000),
      updatedAt: now + 1,
    });
    const merged = mergeLearningMemory(a, b);
    const gaps = merged.gapHistory || [];
    expect(gaps.filter((g) => g.skillId === "physics-6-8").length).toBe(1);
    expect(gaps[0]?.expiresAt).toBe(now + 2 * 86_400_000);
  });

  it("V3: round-trip through merge preserves attribution end-to-end", () => {
    let deviceA = emptyLearningMemory();
    deviceA = recordLearningTurnMemory(deviceA, {
      userText: "moon phases — why do we see phases?",
      source: "connection",
    });
    deviceA = recordLearningTurnMemory(deviceA, {
      userText: "got it!",
      assistantText: "Great — phases come from moon/earth/sun positions.",
      source: "connection",
    });

    const deviceB = normalizeMemory({
      skills: [
        {
          id: "earth-moon-sun",
          label: "Earth–Moon–Sun / space",
          topicId: "science-space",
          pKnown: 0.5,
          mastery: 50,
          attempts: 1,
          correct: 0,
          incorrect: 1,
          lastSeen: Date.now() - 86_400_000,
          sm2State: { ef: 2.2, interval: 2, reps: 1, prevReview: Date.now() - 86_400_000 },
          eloState: { rating: 1300, n: 1, lastUpdate: Date.now() - 86_400_000 },
          sourceCounts: { explore: 2 },
          lastSource: "explore",
        },
      ],
      updatedAt: Date.now() - 86_400_000,
    });

    const merged = mergeLearningMemory(deviceB, deviceA);
    const space = merged.skills.find((s) => s.id === "earth-moon-sun");
    expect(space?.sourceCounts?.connection).toBeGreaterThanOrEqual(1);
    expect(space?.sourceCounts?.explore).toBe(2);
    expect(space?.lastSource).toBe("connection");

    const restored = normalizeMemory(merged);
    const space2 = restored.skills.find((s) => s.id === "earth-moon-sun");
    expect(space2?.sourceCounts?.connection).toBe(space?.sourceCounts?.connection);
    expect(space2?.sourceCounts?.explore).toBe(2);
    expect(space2?.lastSource).toBe("connection");
  });
});
