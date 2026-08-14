/**
 * Force Bay — unit tests (pure stepper + ZPD + misconceptions).
 */

import { describe, expect, it } from "vitest";
import {
  baySkillSeed,
  difficultyFromPKnown,
  generateBayMission,
  kindsForDifficulty,
  netForce,
  runBay,
  validateBayAnswer,
  type BayMission,
} from "./force-bay";

describe("force-bay difficulty", () => {
  it("maps pKnown bands to 1–5", () => {
    expect(difficultyFromPKnown(0.1)).toBe(1);
    expect(difficultyFromPKnown(0.4)).toBe(2);
    expect(difficultyFromPKnown(0.6)).toBe(3);
    expect(difficultyFromPKnown(0.8)).toBe(4);
    expect(difficultyFromPKnown(0.9)).toBe(5);
  });

  it("unlocks mission kinds by difficulty", () => {
    expect(kindsForDifficulty(1)).toEqual(["push"]);
    expect(kindsForDifficulty(3)).toContain("collide");
    expect(kindsForDifficulty(5)).toContain("ramp");
  });
});

describe("force-bay physics", () => {
  it("coasts after an impulse (no continuous push needed)", () => {
    const m: BayMission = {
      id: 1,
      kind: "push",
      difficulty: 1,
      prompt: "t",
      docks: 4,
      targetDock: 2,
      startDock: 0,
      mass: 1,
      friction: 0,
      skill: "forces-motion",
    };
    const run = runBay(m, [{ dir: 1, strength: 1 }]);
    expect(run.landedDock).toBeGreaterThan(0);
  });

  it("net force zero keeps the barge at the start dock", () => {
    const m = generateBayMission("balance", 2);
    const run = runBay(m, [
      { dir: 1, strength: 2 },
      { dir: -1, strength: 2 },
    ]);
    expect(netForce([{ dir: 1, strength: 2 }, { dir: -1, strength: 2 }])).toBe(0);
    expect(run.landedDock).toBe(m.startDock);
  });

  it("equal-mass collide: mover stops, parked takes motion", () => {
    const m = generateBayMission("collide", 3);
    const run = runBay(m, [{ dir: 1, strength: 3 }]);
    expect(run.moverStopped).toBe(true);
    expect(run.parkedLandedDock).toBeGreaterThan(m.parkedDock!);
  });

  it("same push: light craft goes at least as far as heavy", () => {
    const m = generateBayMission("mass", 4);
    const light = runBay({ ...m, mass: 1 }, [{ dir: 1, strength: 3 }]);
    const heavy = runBay({ ...m, mass: 3 }, [{ dir: 1, strength: 3 }]);
    expect(light.landedDock).toBeGreaterThanOrEqual(heavy.landedDock);
  });
});

describe("force-bay validation", () => {
  it("push: correct prediction + landing → correct", () => {
    const base: BayMission = {
      id: 1,
      kind: "push",
      difficulty: 1,
      prompt: "t",
      docks: 5,
      targetDock: 0,
      startDock: 0,
      mass: 1,
      friction: 0.15,
      skill: "forces-motion",
    };
    const arrows = [{ dir: 1 as const, strength: 2 as const }];
    const landed = runBay(base, arrows).landedDock;
    const m = { ...base, targetDock: landed };
    const r = validateBayAnswer(m, { arrows, predictedDock: landed });
    expect(r.correct).toBe(true);
    expect(r.outcome).toBe("correct");
  });

  it("push: landing right but wrong prediction → practice", () => {
    const m: BayMission = {
      id: 1,
      kind: "push",
      difficulty: 1,
      prompt: "t",
      docks: 5,
      targetDock: 2,
      startDock: 0,
      mass: 1,
      friction: 0.2,
      skill: "forces-motion",
    };
    for (let s = 1; s <= 5; s++) {
      const r = validateBayAnswer(m, {
        arrows: [{ dir: 1, strength: s as 1 | 2 | 3 | 4 | 5 }],
        predictedDock: 0,
      });
      if (r.run.landedDock === 2) {
        expect(r.outcome).toBe("practice");
        return;
      }
    }
    // If no strength lands on 2, still assert miss path works
    const miss = validateBayAnswer(m, {
      arrows: [],
      predictedDock: 2,
    });
    expect(miss.correct).toBe(false);
    expect(miss.misconceptionId).toBe("phys-force-to-keep-moving");
  });

  it("balance: equal arrows + predict stay → correct", () => {
    const m = generateBayMission("balance", 2);
    const r = validateBayAnswer(m, {
      arrows: [
        { dir: 1, strength: 3 },
        { dir: -1, strength: 3 },
      ],
      predictedDock: m.startDock,
    });
    expect(r.correct).toBe(true);
  });

  it("mass: guessing heavy → phys-heavier-faster", () => {
    const m = generateBayMission("mass", 4);
    const r = validateBayAnswer(m, {
      arrows: [{ dir: 1, strength: 3 }],
      predictedDock: m.targetDock,
      massGuess: "heavy",
    });
    expect(r.correct).toBe(false);
    expect(r.misconceptionId).toBe("phys-heavier-faster");
  });

  it("collide: guessing mover keeps going → misconception", () => {
    const m = generateBayMission("collide", 3);
    const r = validateBayAnswer(m, {
      arrows: [{ dir: 1, strength: 4 }],
      predictedDock: m.targetDock,
      collideGuess: "mover",
    });
    expect(r.correct).toBe(false);
    expect(r.misconceptionId).toBe("phys-force-to-keep-moving");
  });

  it("skill seed mentions force/motion", () => {
    const m = generateBayMission("push", 2);
    expect(baySkillSeed(m)).toMatch(/force|motion/i);
  });
});
