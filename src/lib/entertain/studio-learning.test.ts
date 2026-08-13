import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "../browser-kv";
import {
  recordStudioLearningTurn,
  studioOutcomeFromSoftFeedback,
  tedTopicsToSkillSeed,
} from "./studio-learning";

const ACCT = "acct_studio_src";

afterEach(() => {
  kvClearMemory();
  delete (globalThis as { window?: unknown }).window;
});

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

  it("V3 — records TED Lab turns under the ted source", async () => {
    (globalThis as { window?: unknown }).window = {};
    const mem = await recordStudioLearningTurn({
      accountId: ACCT,
      source: "ted",
      title: "Why curiosity matters",
      userText:
        "The talk says curiosity drives learning, with evidence from science studies.",
      tedTopics: ["science"],
      outcome: "correct",
    });
    expect(mem).not.toBeNull();
    const tedSkills = (mem?.skills || []).filter((s) => s.sourceCounts?.ted);
    expect(tedSkills.length).toBeGreaterThan(0);
    expect(tedSkills[0]?.lastSource).toBe("ted");
  });

  it("V3 — records Writing Studio turns under the writing source", async () => {
    (globalThis as { window?: unknown }).window = {};
    const mem = await recordStudioLearningTurn({
      accountId: ACCT,
      source: "writing",
      title: "My paragraph",
      userText: "I wrote about how we learn new words from stories.",
      outcome: "practice",
    });
    expect(mem).not.toBeNull();
    const writingSkills = (mem?.skills || []).filter((s) => s.sourceCounts?.writing);
    expect(writingSkills.length).toBeGreaterThan(0);
    expect(writingSkills[0]?.lastSource).toBe("writing");
  });
});
