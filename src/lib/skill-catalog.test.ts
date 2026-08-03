import { describe, expect, it } from "vitest";
import { inferSkillsFromText, SKILL_CATALOG, getSkillDef, topicLabelForId } from "./skill-catalog";

describe("skill-catalog", () => {
  it("covers all curriculum subjects", () => {
    const subjects = new Set(SKILL_CATALOG.map((s) => s.subject));
    ["math", "science", "ela", "humanities"].forEach((subj) =>
      expect(subjects.has(subj as never)).toBe(true),
    );
  });

  it("every skill has a valid topicId in catalog", () => {
    for (const s of SKILL_CATALOG) {
      expect(topicLabelForId(s.topicId)).toBeTruthy();
    }
  });

  it("getSkillDef returns the right entry", () => {
    const def = getSkillDef("fractions-concepts")!;
    expect(def.label).toContain("fraction");
    expect(def.topicId).toBe("fractions");
  });

  it("infers fractions from fraction text", () => {
    const hits = inferSkillsFromText("Help with 3/4 + 2/8 fractions");
    expect(hits.map((s) => s.id)).toContain("fractions-concepts");
  });

  it("infers space from moon phases", () => {
    const hits = inferSkillsFromText("Why does the Moon change phases?");
    expect(hits.map((s) => s.id)).toContain("earth-moon-sun");
  });

  it("infers fraction word problems when fraction + story cues", () => {
    const hits = inferSkillsFromText(
      "Amy has a fraction: 3/4 of a pizza. She shares it equally among 3 friends. How much does each get?",
    );
    expect(hits.map((s) => s.id)).toContain("fraction-word-problems");
    expect(hits.map((s) => s.id)).toContain("fractions-concepts");
  });

  it("finds prerequisite chains", () => {
    const def = getSkillDef("equivalent-fractions")!;
    expect(def.requires).toContain("fractions-concepts");
    expect(def.requires).toContain("multiplication-facts");
  });

  it("returns undefined for unknown id", () => {
    expect(getSkillDef("nonexistent")).toBeUndefined();
  });

  it("returns empty for non-matching text", () => {
    expect(inferSkillsFromText("I like ice cream")).toEqual([]);
  });
});
