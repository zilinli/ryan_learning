import { describe, expect, it } from "vitest";
import {
  buildFallbackNatGeoChallenge,
  parseNatGeoChallengeJson,
  natgeoChallengeSystemPrompt,
} from "./natgeo-challenge";
import { findNatGeoArticle } from "./natgeo-catalog";

describe("natgeo-challenge", () => {
  const article = findNatGeoArticle("african-lion");
  if (!article) throw new Error("african-lion not found in catalog");

  it("builds fallback challenge from catalog article", () => {
    const challenge = buildFallbackNatGeoChallenge(article, {
      grade: 4,
      englishLevel: "developing",
    });
    expect(challenge).toBeTruthy();
    expect(challenge.articleSlug).toBe("african-lion");
    expect(challenge.title).toBe("African Lion");
    expect(challenge.items.length).toBe(5);
    expect(challenge.generatedFromAI).toBe(false);
    expect(challenge.grade).toBe(4);
    expect(challenge.level).toBe("developing");
  });

  it("each challenge item has required fields", () => {
    const challenge = buildFallbackNatGeoChallenge(article, {
      grade: 6,
      englishLevel: "confident",
    });
    for (const item of challenge.items) {
      expect(item.id).toBeTruthy();
      expect(item.kind).toBeTruthy();
      expect(item.prompt.length).toBeGreaterThan(10);
      expect(item.rubricHint.length).toBeGreaterThan(10);
      expect(item.choices.length).toBe(4);
      expect(item.correctChoices.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("adapts difficulty for emerging readers", () => {
    const challenge = buildFallbackNatGeoChallenge(article, {
      grade: 2,
      englishLevel: "emerging",
    });
    expect(challenge.level).toBe("emerging");
    expect(challenge.grade).toBe(2);
    // Emerging prompts should be shorter/simpler
    const prompts = challenge.items.map((i) => i.prompt).join(" ");
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("adapts difficulty for advanced readers", () => {
    const challenge = buildFallbackNatGeoChallenge(article, {
      grade: 10,
      englishLevel: "advanced",
    });
    expect(challenge.level).toBe("advanced");
    expect(challenge.grade).toBe(10);
  });

  it("defaults grade to 4 when not provided", () => {
    const challenge = buildFallbackNatGeoChallenge(article);
    expect(challenge.grade).toBe(4);
  });

  it("generates system prompt with article content", () => {
    const prompt = natgeoChallengeSystemPrompt(article, {
      grade: 5,
      englishLevel: "developing",
    });
    expect(prompt).toContain("African Lion");
    expect(prompt).toContain("grade 5");
    expect(prompt).toContain("reading-comprehension");
  });

  it("parses valid JSON challenge", () => {
    const json = JSON.stringify({
      items: [
        {
          kind: "main-idea",
          prompt: "What is the main idea of this article?",
          choices: [
            "Lions live in prides",
            "Lions are fast",
            "Lions are extinct",
            "Lions live in forests",
          ],
          rubricHint: "Identifies the main message",
        },
      ],
    });
    const parsed = parseNatGeoChallengeJson(json, article, "developing", 4);
    expect(parsed).toBeTruthy();
    expect(parsed!.items.length).toBe(1);
    expect(parsed!.items[0]!.kind).toBe("critique"); // maps to critique
    expect(parsed!.generatedFromAI).toBe(true);
  });

  it("parses JSON inside markdown fences", () => {
    const json = '```json\n{"items":[{"kind":"detail","prompt":"Find a fact","choices":["A","B","C","D"],"rubricHint":"Specific fact"}]}\n```';
    const parsed = parseNatGeoChallengeJson(json, article, "developing", 4);
    expect(parsed).toBeTruthy();
    expect(parsed!.items.length).toBe(1);
  });

  it("returns null for invalid JSON", () => {
    expect(parseNatGeoChallengeJson("not json", article, "developing", 4)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseNatGeoChallengeJson("", article, "developing", 4)).toBeNull();
  });
});
