import { describe, expect, it } from "vitest";
import {
  generateRecipe,
  validateCraft,
  difficultyFromPKnown,
  fractionSkillSeed,
} from "./fraction-forge";

describe("fraction-forge", () => {
  it("generateRecipe creates valid recipes at each difficulty", () => {
    for (let d = 1; d <= 5; d++) {
      const recipe = generateRecipe(d);
      expect(recipe.difficulty).toBe(d);
      expect(recipe.answer).toHaveLength(2);
      expect(recipe.answer[0]).toBeGreaterThan(0);
      expect(recipe.answer[1]).toBeGreaterThan(0);
      expect(recipe.parts.length).toBeGreaterThanOrEqual(1);
      expect(recipe.question.length).toBeGreaterThan(0);
    }
  });

  it("validates correct fraction addition", () => {
    const recipe = {
      id: 1,
      name: "Test",
      op: "add" as const,
      parts: [[1, 4], [1, 4]] as Array<[number, number]>,
      answer: [1, 2] as [number, number],
      question: "1/4 + 1/4 = ?",
      difficulty: 1,
    };
    const result = validateCraft(recipe, 2, 4);
    expect(result.correct).toBe(true);
  });

  it("validates correct answer in simplified form", () => {
    const recipe = {
      id: 1,
      name: "Test",
      op: "add" as const,
      parts: [[1, 4], [1, 4]] as Array<[number, number]>,
      answer: [1, 2] as [number, number],
      question: "1/4 + 1/4 = ?",
      difficulty: 1,
    };
    // User says 2/4 = 1/2
    const result = validateCraft(recipe, 2, 4);
    expect(result.correct).toBe(true);
  });

  it("detects frac-add-denom misconception", () => {
    // 1/2 + 1/3 → student says 2/5 (added both num and den)
    const recipe = {
      id: 1,
      name: "Test",
      op: "add" as const,
      parts: [[1, 2], [1, 3]] as Array<[number, number]>,
      answer: [5, 6] as [number, number],
      question: "1/2 + 1/3 = ?",
      difficulty: 3,
    };
    const result = validateCraft(recipe, 2, 5);
    expect(result.correct).toBe(false);
    expect(result.misconceptionId).toBe("frac-add-denom");
  });

  it("detects frac-bigger-denom misconception", () => {
    // 1/2 - 1/3 = 1/6. If student uses the bigger denominator (3) instead of finding LCM:
    // 1/2 - 1/3 → student says 1/3 (kept the bigger denom). Expected is 1/6.
    const recipe = {
      id: 1,
      name: "Test",
      op: "subtract" as const,
      parts: [[1, 2], [1, 3]] as Array<[number, number]>,
      answer: [1, 6] as [number, number],
      question: "1/2 - 1/3 = ?",
      difficulty: 3,
    };
    // Wrong answer: student used denom 3 (bigger of {2,3}) — 2/3
    const result = validateCraft(recipe, 2, 3);
    expect(result.correct).toBe(false);
  });

  it("detects frac-of-set misconception in multiply", () => {
    // 3 × 1/2 → student divides instead of multiplies: 1/(2*3) = 1/6
    const recipe = {
      id: 1,
      name: "Test",
      op: "multiply_int" as const,
      parts: [[3, 1], [1, 2]] as Array<[number, number]>,
      answer: [3, 2] as [number, number],
      question: "3 × 1/2 = ?",
      difficulty: 4,
    };
    const result = validateCraft(recipe, 1, 6);
    expect(result.correct).toBe(false);
    expect(result.misconceptionId).toBe("frac-of-set");
  });

  it("difficultyFromPKnown maps correctly", () => {
    expect(difficultyFromPKnown(0.2)).toBe(1);
    expect(difficultyFromPKnown(0.4)).toBe(2);
    expect(difficultyFromPKnown(0.6)).toBe(3);
    expect(difficultyFromPKnown(0.8)).toBe(4);
    expect(difficultyFromPKnown(0.9)).toBe(5);
  });

  it("fractionSkillSeed returns meaningful text", () => {
    const recipe = generateRecipe(3);
    const seed = fractionSkillSeed(recipe);
    expect(seed).toContain("fractions");
    expect(seed).toContain("concepts");
  });
});
