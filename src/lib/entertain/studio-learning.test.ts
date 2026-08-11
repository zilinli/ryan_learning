import { describe, expect, it } from "vitest";
import { tedTopicsToSkillSeed } from "./studio-learning";

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
});
