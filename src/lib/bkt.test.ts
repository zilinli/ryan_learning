import { describe, expect, it } from "vitest";
import { bktUpdate, masteryFromPKnown, pKnownFromMastery, softBktUpdate } from "./bkt";

describe("bktUpdate", () => {
  it("correct answer raises P(known)", () => {
    const before = 0.25;
    const after = bktUpdate(before, true);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThan(1);
  });

  it("incorrect answer lowers P(known)", () => {
    const before = 0.8;
    const after = bktUpdate(before, false);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it("stays within [0.001, 0.999]", () => {
    expect(bktUpdate(0.999, true)).toBeLessThanOrEqual(0.999);
    expect(bktUpdate(0.001, false)).toBeGreaterThanOrEqual(0.001);
  });

  it("multiple corrects approach ceiling", () => {
    let p = 0.25;
    for (let i = 0; i < 10; i++) p = bktUpdate(p, true);
    expect(p).toBeGreaterThan(0.85);
  });

  it("multiple incorrects drop toward floor", () => {
    let p = 0.8;
    for (let i = 0; i < 8; i++) p = bktUpdate(p, false);
    expect(p).toBeLessThan(0.3);
  });

  it("slip does not crash when fully mastered", () => {
    const p = bktUpdate(0.95, false);
    expect(p).toBeGreaterThan(0.7);   // slip + learn steps together
    expect(p).toBeLessThan(0.95);
  });
});

describe("softBktUpdate", () => {
  it("treats correct like bktUpdate correct", () => {
    expect(softBktUpdate(0.25, "correct")).toBe(bktUpdate(0.25, true));
  });

  it("treats incorrect like bktUpdate incorrect", () => {
    expect(softBktUpdate(0.8, "incorrect")).toBe(bktUpdate(0.8, false));
  });

  it("practice nudges slightly upward", () => {
    const before = 0.25;
    const after = softBktUpdate(before, "practice");
    expect(after).toBeGreaterThan(before);
  });

  it("practice is weaker than correct", () => {
    const pPractice = softBktUpdate(0.25, "practice");
    const pCorrect = softBktUpdate(0.25, "correct");
    expect(pCorrect).toBeGreaterThan(pPractice);
  });
});

describe("mastery helpers", () => {
  it("round-trips pKnown ↔ mastery", () => {
    expect(masteryFromPKnown(0.25)).toBe(25);
    expect(masteryFromPKnown(0.0)).toBe(0);
    expect(masteryFromPKnown(1)).toBe(100);
    expect(pKnownFromMastery(40)).toBeCloseTo(0.4, 1);
  });
});
