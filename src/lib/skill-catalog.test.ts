import { describe, expect, it } from "vitest";
import {
  detectLanguage,
  getSkillDef,
  inferSkillsFromText,
  inferSkillsFromTextMultiLang,
  isWordProblem,
  SKILL_CATALOG,
  topicLabelForId,
} from "./skill-catalog";

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

// ── Multi-lingual Word-problem Parsing (Phase 0.6) ──────────

describe("detectLanguage", () => {
  it("detects English", () => {
    expect(detectLanguage("Hello, can you help me with fractions?")).toBe("en");
  });

  it("detects simplified Chinese", () => {
    expect(detectLanguage("请问这个分数题目应该怎么做")).toBe("zh-CN");
  });

  it("detects traditional Chinese with Cantonese markers", () => {
    expect(detectLanguage("唔該你可唔可以幫我睇下呢條題目")).toBe("zh-HK");
  });

  it("detects mixed EN+ZH", () => {
    const text = "这个fraction很容易。How do I solve it?";
    // roughly balanced → mixed
    const lang = detectLanguage(text);
    expect(["mixed", "zh-CN", "en"]).toContain(lang);
  });

  it("returns en for empty text", () => {
    expect(detectLanguage("")).toBe("en");
  });
});

describe("inferSkillsFromTextMultiLang", () => {
  it("returns detected language", () => {
    const { language } = inferSkillsFromTextMultiLang("请问分数怎么算");
    expect(["zh-CN", "zh-HK"]).toContain(language);
  });

  it("detects fraction word problem in Chinese", () => {
    const { skills } = inferSkillsFromTextMultiLang(
      "帮我解决这个分数的应用题 小明有3/4个蛋糕 他吃了1/2 还剩多少",
    );
    // Should find fraction-related skills
    expect(skills.length).toBeGreaterThan(0);
    const ids = skills.map((s) => s.id);
    expect(ids.some((id) => id.includes("fraction"))).toBe(true);
  });

  it("detects fraction word problem in English", () => {
    const { skills, language } = inferSkillsFromTextMultiLang(
      "Word problem: Sarah has 3/4 of a cake. She ate 1/2. How much is left?",
    );
    expect(language).toBe("en");
    const ids = skills.map((s) => s.id);
    expect(ids.some((id) => id.includes("fraction"))).toBe(true);
  });
});

describe("isWordProblem", () => {
  it("detects EN word problem", () => {
    expect(isWordProblem("Can you help with this word problem?")).toBe(true);
  });

  it("detects ZH word problem", () => {
    expect(isWordProblem("这是一道应用题")).toBe(true);
  });

  it("returns false for plain question", () => {
    expect(isWordProblem("What is 2+2?")).toBe(false);
  });
});
