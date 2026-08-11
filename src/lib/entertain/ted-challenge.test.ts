import { describe, expect, it } from "vitest";
import {
  appendVoiceTranscript,
  buildFallbackChallenge,
  parseChallengeJson,
} from "./ted-challenge";
import type { TedTalk } from "./ted-catalog";

const talk: TedTalk = {
  slug: "test_talk",
  title: "Test Talk",
  speaker: "Ada Example",
  durationSec: 600,
  topics: ["ideas"],
  blurb: "A short blurb about ideas.",
};

describe("ted-challenge", () => {
  it("buildFallbackChallenge mixes kinds", () => {
    const tx =
      "Hook sentence that is long enough for parsing into a challenge cue. ".repeat(
        8,
      ) +
      "Middle evidence appears here with enough length to matter. ".repeat(4) +
      "Closing implication wraps the arc for listeners.";
    const c = buildFallbackChallenge(talk, tx);
    expect(c.items.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(c.items.map((i) => i.kind));
    expect(kinds.has("literal")).toBe(true);
    expect(kinds.has("critique")).toBe(true);
    expect(kinds.has("retell")).toBe(true);
    expect(c.generatedFromTranscript).toBe(true);
  });

  it("parseChallengeJson accepts LLM JSON", () => {
    const raw = `Here you go
{"items":[
  {"kind":"literal","prompt":"What is the claim?","rubricHint":"Be precise"},
  {"kind":"structure","prompt":"Sketch the arc","rubricHint":"3 bullets"},
  {"kind":"critique","prompt":"Steelman an objection","rubricHint":"Trade-offs"}
]}`;
    const parsed = parseChallengeJson(raw, talk);
    expect(parsed?.items).toHaveLength(3);
    expect(parsed?.items[0].kind).toBe("literal");
  });

  it("parseChallengeJson rejects thin payloads", () => {
    expect(parseChallengeJson("{}", talk)).toBeNull();
    expect(
      parseChallengeJson('{"items":[{"kind":"literal","prompt":"x"}]}', talk),
    ).toBeNull();
  });

  it("appendVoiceTranscript TV1–TV3", () => {
    expect(appendVoiceTranscript("", "  Hello world  ")).toBe("Hello world");
    expect(appendVoiceTranscript("Claim one.", "Because evidence.")).toBe(
      "Claim one. Because evidence.",
    );
    expect(appendVoiceTranscript("Keep me", "   ")).toBe("Keep me");
  });
});
