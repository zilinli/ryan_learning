import { describe, expect, it } from "vitest";
import {
  autoAdvanceCheck,
  detectPriorTier,
  emptyLearningMemory,
  type LearningMemory,
  type SkillMastery,
} from "../learning-memory";
import { DEFAULT_SM2, DEFAULT_ELO } from "../bkt";

function makeSkill(
  overrides: Partial<SkillMastery> & { id: string },
): SkillMastery {
  return {
    label: overrides.label || overrides.id,
    topicId: overrides.topicId || "math",
    pKnown: 0.25,
    mastery: 25,
    attempts: 5,
    correct: 2,
    incorrect: 2,
    lastSeen: Date.now(),
    sm2State: { ...DEFAULT_SM2 },
    eloState: { ...DEFAULT_ELO },
    ...overrides,
  };
}

describe("autoAdvanceCheck", () => {
  it("returns advance suggestion when all skills > 85%", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "fractions-concepts", pKnown: 0.90, mastery: 90 }),
        makeSkill({ id: "equivalent-fractions", pKnown: 0.88, mastery: 88 }),
        makeSkill({ id: "geometry-measure", pKnown: 0.92, mastery: 92 }),
        makeSkill({ id: "reading-evidence", pKnown: 0.87, mastery: 87 }),
        makeSkill({ id: "multiplication-facts", pKnown: 0.95, mastery: 95 }),
      ],
    };
    const result = autoAdvanceCheck(mem, "elementary");
    expect(result).not.toBeNull();
    expect(result!.suggestedBand).toBe("middle");
    expect(result!.confidence).toBeGreaterThan(0.8);
    expect(result!.skillsReady).toBeGreaterThanOrEqual(3);
  });

  it("returns null when skills are mixed (not all above 85%)", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "fractions-concepts", pKnown: 0.90, mastery: 90 }),
        makeSkill({ id: "equivalent-fractions", pKnown: 0.88, mastery: 88 }),
        makeSkill({ id: "geometry-measure", pKnown: 0.45, mastery: 45 }),
        makeSkill({ id: "reading-evidence", pKnown: 0.80, mastery: 80 }),
        makeSkill({ id: "multiplication-facts", pKnown: 0.95, mastery: 95 }),
      ],
    };
    const result = autoAdvanceCheck(mem, "elementary");
    expect(result).toBeNull();
  });

  it("returns null when not enough skills attempted (< 3)", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "fractions-concepts", pKnown: 0.95, mastery: 95 }),
        makeSkill({ id: "equivalent-fractions", pKnown: 0.90, mastery: 90 }),
        // skill with 0 attempts shouldn't count
        makeSkill({ id: "geometry-measure", pKnown: 0.50, mastery: 50, attempts: 0 }),
      ],
    };
    const result = autoAdvanceCheck(mem, "elementary");
    expect(result).toBeNull();
  });

  it("returns null when already at 'high' band (ceiling)", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "ap-calculus", pKnown: 0.95, mastery: 95 }),
        makeSkill({ id: "honors-biology", pKnown: 0.92, mastery: 92 }),
        makeSkill({ id: "honors-chemistry", pKnown: 0.90, mastery: 90 }),
        makeSkill({ id: "trigonometry", pKnown: 0.88, mastery: 88 }),
      ],
    };
    const result = autoAdvanceCheck(mem, "high");
    expect(result).toBeNull();
  });

  it("returns null when < 75% of skills reach threshold", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "fractions-concepts", pKnown: 0.90, mastery: 90 }),
        makeSkill({ id: "equivalent-fractions", pKnown: 0.88, mastery: 88 }),
        makeSkill({ id: "geometry-measure", pKnown: 0.60, mastery: 60 }),
        makeSkill({ id: "reading-evidence", pKnown: 0.55, mastery: 55 }),
        makeSkill({ id: "multiplication-facts", pKnown: 0.50, mastery: 50 }),
      ],
    };
    const result = autoAdvanceCheck(mem, "elementary");
    expect(result).toBeNull();
  });

  // Phase 12D.5: Ryan regression — existing BKT state within G4 range should NOT trigger advance
  it("Ryan's current G4 BKT state should NOT trigger advance", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "fractions-concepts", pKnown: 0.72, mastery: 72 }),
        makeSkill({ id: "equivalent-fractions", pKnown: 0.60, mastery: 60 }),
        makeSkill({ id: "division-basics", pKnown: 0.55, mastery: 55 }),
        makeSkill({ id: "multiplication-facts", pKnown: 0.80, mastery: 80 }),
        makeSkill({ id: "geometry-measure", pKnown: 0.65, mastery: 65 }),
        makeSkill({ id: "reading-evidence", pKnown: 0.78, mastery: 78 }),
      ],
    };
    const result = autoAdvanceCheck(mem, "elementary");
    expect(result).toBeNull();
  });

  // V2 P1 — prior tier (report §9.3.1): high-prior students advance more eagerly
  it("high-prior tier fires with a slightly lower readiness bar", () => {
    // 4/5 skills above 80%: standard threshold (85%) + 75% ratio would NOT fire
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "fractions-concepts", pKnown: 0.83, mastery: 83 }),
        makeSkill({ id: "equivalent-fractions", pKnown: 0.82, mastery: 82 }),
        makeSkill({ id: "geometry-measure", pKnown: 0.84, mastery: 84 }),
        makeSkill({ id: "reading-evidence", pKnown: 0.81, mastery: 81 }),
        makeSkill({ id: "multiplication-facts", pKnown: 0.50, mastery: 50 }),
      ],
    };
    expect(autoAdvanceCheck(mem, "elementary", "standard")).toBeNull();
    const result = autoAdvanceCheck(mem, "elementary", "high");
    expect(result).not.toBeNull();
    expect(result!.suggestedBand).toBe("middle");
  });
});

describe("detectPriorTier", () => {
  it("flags accelerated curriculum (grade above enrolled grade)", () => {
    expect(
      detectPriorTier(
        { grade: 4, curriculum: { label: "G5 accelerated", grade: 5, subjects: [] } },
        emptyLearningMemory(),
      ),
    ).toBe("high");
  });

  it("stays standard when curriculum matches the enrolled grade", () => {
    expect(
      detectPriorTier(
        { grade: 4, curriculum: { label: "G4", grade: 4, subjects: [] } },
        emptyLearningMemory(),
      ),
    ).toBe("standard");
  });

  it("flags high when several well-attempted skills sit above 75%", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "a", pKnown: 0.90, mastery: 90, attempts: 6 }),
        makeSkill({ id: "b", pKnown: 0.88, mastery: 88, attempts: 5 }),
        makeSkill({ id: "c", pKnown: 0.80, mastery: 80, attempts: 4 }),
      ],
    };
    expect(detectPriorTier(null, mem)).toBe("high");
  });

  it("stays standard without enough evidence", () => {
    const mem: LearningMemory = {
      ...emptyLearningMemory(),
      skills: [
        makeSkill({ id: "a", pKnown: 0.90, mastery: 90, attempts: 6 }),
        makeSkill({ id: "b", pKnown: 0.88, mastery: 88, attempts: 5 }),
        makeSkill({ id: "c", pKnown: 0.40, mastery: 40, attempts: 4 }),
      ],
    };
    expect(detectPriorTier(null, mem)).toBe("standard");
  });
});
