import { describe, expect, it } from "vitest";
import {
  difficultyFromPKnown,
  generateMission,
  tickForFraction,
  validateVoyagerAnswer,
  voyagerSkillSeed,
  type VoyagerMission,
  type VoyagerAnswer,
} from "./fraction-voyager";

describe("fraction-voyager", () => {
  it("generates valid missions for all kinds and difficulties", () => {
    for (const kind of ["place", "compare", "partition"] as const) {
      for (let d = 1; d <= 5; d++) {
        const m = generateMission(kind, d);
        expect(m.kind).toBe(kind);
        expect(m.difficulty).toBe(d);
        expect(m.prompt.length).toBeGreaterThan(0);
        expect(m.target).toHaveLength(2);
        expect(m.target[1]).toBeGreaterThan(0);
      }
    }
  });

  it("place mission validates correct tick", () => {
    const mission: VoyagerMission = {
      id: 1,
      kind: "place",
      difficulty: 1,
      prompt: "Fly to 1/2",
      target: [1, 2],
      lineMax: 1,
      ticks: 4,
      skill: "fractions-concepts",
    };
    const expected = tickForFraction(1, 2, 4, 1);
    const answer: VoyagerAnswer = { kind: "place", placeTick: expected };
    const r = validateVoyagerAnswer(mission, answer);
    expect(r.correct).toBe(true);
  });

  it("place mission detects frac-whole-vs-part when flying past 1", () => {
    const mission: VoyagerMission = {
      id: 1,
      kind: "place",
      difficulty: 1,
      prompt: "Fly to 1/4",
      target: [1, 4],
      lineMax: 1,
      ticks: 8,
      skill: "fractions-concepts",
    };
    const r = validateVoyagerAnswer(mission, {
      kind: "place",
      placeTick: 8, // 8/8 = 1.0 — past the target of 1/4
    });
    expect(r.correct).toBe(false);
    expect(r.misconceptionId).toBe("frac-whole-vs-part");
  });

  it("compare mission validates bigger side", () => {
    const mission: VoyagerMission = {
      id: 1,
      kind: "compare",
      difficulty: 2,
      prompt: "Which holds more?",
      target: [3, 4],
      lineMax: 1,
      ticks: 8,
      compareLeft: [1, 4],
      compareRight: [3, 4],
      leftIsBigger: false,
      skill: "fractions-concepts",
    };
    expect(validateVoyagerAnswer(mission, { kind: "compare", comparePick: "right" }).correct).toBe(true);
    const wrong = validateVoyagerAnswer(mission, { kind: "compare", comparePick: "left" });
    expect(wrong.correct).toBe(false);
    expect(wrong.misconceptionId).toBe("frac-bigger-denom");
  });

  it("partition mission validates equivalent fill", () => {
    const mission: VoyagerMission = {
      id: 1,
      kind: "partition",
      difficulty: 2,
      prompt: "Slice 1/2 into 4 pieces",
      target: [1, 2],
      lineMax: 1,
      ticks: 4,
      bar: [1, 2],
      pieceCount: 4,
      fillCount: 2,
      skill: "equivalent-fractions",
    };
    expect(validateVoyagerAnswer(mission, { kind: "partition", fillCount: 2 }).correct).toBe(true);
    expect(validateVoyagerAnswer(mission, { kind: "partition", fillCount: 4 }).correct).toBe(false);
  });

  it("partition full-bar fill is frac-whole-vs-part", () => {
    const mission: VoyagerMission = {
      id: 1,
      kind: "partition",
      difficulty: 2,
      prompt: "Slice 1/2 into 4 pieces",
      target: [1, 2],
      lineMax: 1,
      ticks: 4,
      bar: [1, 2],
      pieceCount: 4,
      fillCount: 2,
      skill: "equivalent-fractions",
    };
    const r = validateVoyagerAnswer(mission, { kind: "partition", fillCount: 4 });
    expect(r.misconceptionId).toBe("frac-whole-vs-part");
  });

  it("difficultyFromPKnown maps ZPD bands", () => {
    expect(difficultyFromPKnown(0.2)).toBe(1);
    expect(difficultyFromPKnown(0.4)).toBe(2);
    expect(difficultyFromPKnown(0.6)).toBe(3);
    expect(difficultyFromPKnown(0.8)).toBe(4);
    expect(difficultyFromPKnown(0.9)).toBe(5);
  });

  it("tickForFraction clamps to line range", () => {
    expect(tickForFraction(1, 2, 4, 1)).toBe(2);
    expect(tickForFraction(3, 2, 4, 2)).toBe(3);
    expect(tickForFraction(5, 2, 4, 1)).toBe(4); // clamp
    expect(tickForFraction(0, 2, 4, 1)).toBe(0);
  });

  it("voyagerSkillSeed carries fraction context", () => {
    const mission = generateMission("place", 3);
    const seed = voyagerSkillSeed(mission);
    expect(seed).toContain("fractions");
    expect(seed).toContain(`${mission.target[0]}/${mission.target[1]}`);
  });
});
