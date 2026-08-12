import { describe, expect, it } from "vitest";
import {
  buildFallbackBbcChallenge,
  bbcChallengeSystemPrompt,
  parseBbcChallengeJson,
} from "./bbc-challenge";
import { findBbcClip } from "./bbc-catalog";

describe("bbc-challenge", () => {
  const clip = findBbcClip("cTQ3Ko9ZKg8");
  if (!clip) throw new Error("penguin clip not found");

  it("builds fallback challenge with no transcript", () => {
    const challenge = buildFallbackBbcChallenge(clip, null, {
      grade: 4,
      englishLevel: "developing",
    });
    expect(challenge.videoId).toBe("cTQ3Ko9ZKg8");
    expect(challenge.title).toContain("Penguin");
    expect(challenge.items.length).toBe(5);
    expect(challenge.generatedFromTranscript).toBe(false);
    expect(challenge.grade).toBe(4);
    expect(challenge.level).toBe("developing");
  });

  it("each item has required fields", () => {
    const challenge = buildFallbackBbcChallenge(clip, null, { grade: 6 });
    for (const item of challenge.items) {
      expect(item.id).toBeTruthy();
      expect(item.prompt.length).toBeGreaterThan(5);
      expect(item.rubricHint.length).toBeGreaterThan(5);
      expect(item.choices.length).toBe(4);
      expect(item.correctChoices.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("adapts for emerging level", () => {
    const challenge = buildFallbackBbcChallenge(clip, null, {
      grade: 3,
      englishLevel: "emerging",
    });
    expect(challenge.level).toBe("emerging");
  });

  it("adapts for advanced level", () => {
    const challenge = buildFallbackBbcChallenge(clip, null, {
      grade: 10,
      englishLevel: "advanced",
    });
    expect(challenge.level).toBe("advanced");
  });

  it("generates system prompt", () => {
    const prompt = bbcChallengeSystemPrompt(clip, null, {
      grade: 5,
      englishLevel: "developing",
    });
    expect(prompt).toContain("Penguin");
    expect(prompt).toContain("Grade 5");
  });

  it("parses valid JSON challenge", () => {
    const json = JSON.stringify({
      items: [
        {
          kind: "observation",
          prompt: "What did you see?",
          choices: ["Penguins huddling in winter", "A lion", "A fish", "A bird"],
          rubricHint: "Names a specific visual detail",
        },
      ],
    });
    const parsed = parseBbcChallengeJson(json, clip, "developing", 5);
    expect(parsed).toBeTruthy();
    expect(parsed!.items.length).toBe(1);
    expect(parsed!.generatedFromTranscript).toBe(true);
  });

  it("returns null for invalid JSON", () => {
    expect(
      parseBbcChallengeJson("not json", clip, "developing", 5),
    ).toBeNull();
  });
});
