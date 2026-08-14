import { describe, expect, it } from "vitest";
import {
  generateOrbitMission,
  orbitSkillSeed,
  peakBandFromPush,
  validateOrbitAnswer,
} from "./orbit-scout";

describe("orbit-scout", () => {
  it("peak band scales with push, clamped", () => {
    expect(peakBandFromPush(1, 5)).toBe(0);
    expect(peakBandFromPush(3, 5)).toBe(2);
    expect(peakBandFromPush(9, 5)).toBe(4);
  });

  it("drop: same is correct; heavy is misconception", () => {
    const m = generateOrbitMission("drop", 1);
    expect(validateOrbitAnswer(m, { dropGuess: "same" }).correct).toBe(true);
    const wrong = validateOrbitAnswer(m, { dropGuess: "heavy" });
    expect(wrong.misconceptionId).toBe("phys-heavier-falls-faster");
  });

  it("always-down: down is correct", () => {
    const m = generateOrbitMission("always-down", 1);
    expect(validateOrbitAnswer(m, { gravityDir: "down" }).correct).toBe(true);
    expect(validateOrbitAnswer(m, { gravityDir: "up" }).misconceptionId).toBe(
      "science-earth-scale",
    );
  });

  it("arc: matching push + prediction is correct", () => {
    const m = generateOrbitMission("arc", 2);
    const push = ((m.targetBand ?? 0) + 1) as 1 | 2 | 3 | 4 | 5;
    const r = validateOrbitAnswer(m, {
      push,
      predictedBand: m.targetBand,
    });
    expect(r.correct).toBe(true);
  });

  it("skill seed mentions gravity", () => {
    expect(orbitSkillSeed(generateOrbitMission("arc", 2))).toMatch(/gravity/i);
  });
});
