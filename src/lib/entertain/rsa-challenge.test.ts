import { describe, expect, it } from "vitest";
import {
  buildFallbackRsaChallenge,
  rsaChallengeSystemPrompt,
  parseRsaChallengeJson,
} from "./rsa-challenge";
import { findRsaVideo } from "./rsa-catalog";

describe("rsa-challenge", () => {
  const video = findRsaVideo("zDZFcDGpL4U");
  if (!video) throw new Error("Drive video not found");

  it("builds fallback challenge with no transcript", () => {
    const challenge = buildFallbackRsaChallenge(video, null, {
      grade: 8,
      englishLevel: "confident",
    });
    expect(challenge.videoId).toBe("zDZFcDGpL4U");
    expect(challenge.title).toContain("Drive");
    expect(challenge.items.length).toBe(4);
    expect(challenge.generatedFromTranscript).toBe(false);
    expect(challenge.grade).toBe(8);
    expect(challenge.level).toBe("confident");
  });

  it("each item has required fields", () => {
    const challenge = buildFallbackRsaChallenge(video, null, { grade: 8 });
    for (const item of challenge.items) {
      expect(item.id).toBeTruthy();
      expect(item.prompt.length).toBeGreaterThan(5);
      expect(item.rubricHint.length).toBeGreaterThan(5);
      expect(item.choices.length).toBe(4);
      expect(item.correctChoices.length).toBeGreaterThanOrEqual(1);
      const kinds = ["literal", "structure", "critique", "retell"];
      expect(kinds).toContain(item.kind);
    }
  });

  it("defaults grade to 7 for RSA", () => {
    // RSA content is more abstract, defaults higher than TED's 4
    const challenge = buildFallbackRsaChallenge(video, null);
    expect(challenge.grade).toBe(7);
  });

  it("adapts for emerging level", () => {
    const challenge = buildFallbackRsaChallenge(video, null, {
      grade: 5,
      englishLevel: "emerging",
    });
    expect(challenge.level).toBe("emerging");
  });

  it("generates system prompt", () => {
    const prompt = rsaChallengeSystemPrompt(video, null, {
      grade: 8,
      englishLevel: "confident",
    });
    expect(prompt).toContain("Drive");
    expect(prompt).toContain("Grade 8");
    expect(prompt).toContain("Dan Pink");
  });

  it("parses valid JSON challenge", () => {
    const json = JSON.stringify({
      items: [
        {
          kind: "literal",
          prompt: "What is the main claim?",
          choices: [
            "Autonomy drives motivation",
            "Money is everything",
            "People are lazy",
            "Goals don't matter",
          ],
          rubricHint: "States the central claim",
        },
      ],
    });
    const parsed = parseRsaChallengeJson(json, video, "confident", 8);
    expect(parsed).toBeTruthy();
    expect(parsed!.items.length).toBe(1);
    expect(parsed!.generatedFromTranscript).toBe(true);
    expect(parsed!.items[0]!.kind).toBe("literal");
  });

  it("returns null for invalid JSON", () => {
    expect(
      parseRsaChallengeJson("not json", video, "confident", 8),
    ).toBeNull();
  });
});
