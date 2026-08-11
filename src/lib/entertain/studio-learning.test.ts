import { describe, expect, it } from "vitest";
import {
  studioOutcomeFromSoftFeedback,
  tedTopicsToSkillSeed,
} from "./studio-learning";

describe("studio-learning", () => {
  it("maps TED science topics to science seed text", () => {
    const s = tedTopicsToSkillSeed(["science", "technology"]);
    expect(s).toMatch(/science/i);
    expect(s).toMatch(/technology|engineering/i);
  });

  it("defaults to ideas seed when topics empty", () => {
    expect(tedTopicsToSkillSeed([])).toMatch(/ideas|thinking/i);
    expect(tedTopicsToSkillSeed(undefined)).toMatch(/ideas|thinking/i);
  });

  it("maps soft feedback to BKT outcomes", () => {
    expect(
      studioOutcomeFromSoftFeedback(
        "Short answers can be sharp — but this one needs more evidence.",
      ),
    ).toBe("incorrect");
    expect(
      studioOutcomeFromSoftFeedback(
        "Retell should carry the arc. Add one beat from the middle.",
      ),
    ).toBe("incorrect");
    expect(
      studioOutcomeFromSoftFeedback(
        "Nice start. Push the critique: name the tension.",
      ),
    ).toBe("practice");
    expect(
      studioOutcomeFromSoftFeedback(
        "Solid draft for a literal prompt. Rubric nudge: cite one detail.",
      ),
    ).toBe("correct");
    expect(studioOutcomeFromSoftFeedback("")).toBe("practice");
  });
});
