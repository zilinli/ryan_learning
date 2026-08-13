import { describe, expect, it } from "vitest";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import { skillDotTone, summarizeSkillDots } from "./skill-dots";

function mem(skills: Array<{ id: string; label: string; pKnown: number; attempts: number; correct: number; incorrect: number; lastSeen?: number }>): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: skills.map((s) => ({
      id: s.id,
      label: s.label,
      topicId: "t",
      pKnown: s.pKnown,
      mastery: Math.round(s.pKnown * 100),
      attempts: s.attempts,
      correct: s.correct,
      incorrect: s.incorrect,
      lastSeen: s.lastSeen ?? now,
      sm2State: { ef: 2.3, interval: 1, reps: 1, prevReview: now - 86_400_000 },
      eloState: { rating: 1400, n: 1, lastUpdate: now },
    })),
    updatedAt: now,
  });
}

describe("skillDotTone", () => {
  it("green at P≥0.8 with attempts", () => {
    expect(skillDotTone({ pKnown: 0.92, attempts: 5, lastSeen: 1 })).toBe("green");
  });

  it("yellow when practised but below mastery", () => {
    expect(skillDotTone({ pKnown: 0.55, attempts: 5, lastSeen: 1 })).toBe("yellow");
  });

  it("grey when never practised", () => {
    expect(skillDotTone({ pKnown: 0.3, attempts: 0, lastSeen: 0 })).toBe("grey");
  });
});

describe("summarizeSkillDots", () => {
  it("groups counts and surfaces strengths/weaknesses", () => {
    const m = mem([
      { id: "a", label: "Algebra", pKnown: 0.9, attempts: 8, correct: 7, incorrect: 1 },
      { id: "b", label: "Fractions", pKnown: 0.6, attempts: 4, correct: 2, incorrect: 2 },
      { id: "c", label: "Geometry", pKnown: 0.35, attempts: 2, correct: 0, incorrect: 2 },
      { id: "d", label: "Statistics", pKnown: 0.2, attempts: 0, correct: 0, incorrect: 0 },
    ]);
    const s = summarizeSkillDots(m);
    expect(s.grouped).toEqual({ green: 1, yellow: 2, grey: 1 });
    expect(s.strengths[0]?.id).toBe("a");
    expect(s.weaknesses[0]?.id).toBe("c");
  });

  it("empty memory yields empty summary", () => {
    const s = summarizeSkillDots(null);
    expect(s.skills).toHaveLength(0);
    expect(s.strengths).toHaveLength(0);
    expect(s.weaknesses).toHaveLength(0);
  });

  it("P2-1: litThisWeek counts dots practised in the current week only", () => {
    const now = Date.now();
    const lastWeek = now - 8 * 86_400_000;
    const m = mem([
      { id: "a", label: "Algebra", pKnown: 0.9, attempts: 8, correct: 7, incorrect: 1, lastSeen: now },
      { id: "b", label: "Fractions", pKnown: 0.6, attempts: 4, correct: 2, incorrect: 2, lastSeen: now },
      { id: "c", label: "Geometry", pKnown: 0.35, attempts: 2, correct: 0, incorrect: 2, lastSeen: lastWeek },
      { id: "d", label: "Statistics", pKnown: 0.2, attempts: 0, correct: 0, incorrect: 0, lastSeen: now },
    ]);
    const s = summarizeSkillDots(m, now);
    expect(s.litThisWeek.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });
});
