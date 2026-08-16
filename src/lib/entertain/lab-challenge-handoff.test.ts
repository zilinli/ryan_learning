import { describe, expect, it } from "vitest";
import {
  buildLabChallengeKickoffMessage,
  consumeLabChallengeKickoff,
  detectLabCoherenceSignal,
  labChallengeLabel,
  labResumeHref,
  stashLabChallengeKickoff,
} from "./lab-challenge-handoff";

const base = {
  lab: "natgeo" as const,
  title: "Ocean Giants",
  speaker: "NatGeo",
  kind: "critique",
  prompt: "Why do whales migrate?",
  choices: ["A. Food", "B. Temp", "C. Predators", "D. All"],
  selected: [0, 3],
  essay: "They follow food and temperature.",
};

describe("labChallengeLabel + labResumeHref", () => {
  it("labels each lab", () => {
    expect(labChallengeLabel("bbc")).toBe("BBC Doc Lab");
    expect(labChallengeLabel("rsa")).toBe("RSA Lab");
    expect(labChallengeLabel("natgeo")).toBe("NatGeo Lab");
  });

  it("builds a resume href per lab", () => {
    expect(labResumeHref("natgeo")).toBe("/studio?game=natgeo-lab");
    expect(labResumeHref("bbc")).toBe("/studio?game=bbc-lab");
  });
});

describe("kickoff round trip", () => {
  it("builds a Socratic kickoff message with choice summary", () => {
    const msg = buildLabChallengeKickoffMessage(base);
    expect(msg).toContain("NatGeo Lab challenge discussion");
    expect(msg).toContain("Ocean Giants");
    expect(msg).toContain("Why do whales migrate?");
    expect(msg).toContain("A. Food");
    expect(msg).toContain("D. All");
    expect(msg).toContain("Socratic Q&A mode");
  });

  it("stash + consume round trips in the same session", () => {
    stashLabChallengeKickoff(base);
    const got = consumeLabChallengeKickoff();
    expect(got).toEqual({
      lab: "natgeo",
      title: "Ocean Giants",
      speaker: "NatGeo",
      kind: "critique",
      prompt: "Why do whales migrate?",
      choices: ["A. Food", "B. Temp", "C. Predators", "D. All"],
      selected: [0, 3],
      essay: "They follow food and temperature.",
      accountId: undefined,
    });
    // one-shot
    expect(consumeLabChallengeKickoff()).toBeNull();
  });

  it("rejects empty essay on consume", () => {
    stashLabChallengeKickoff({ ...base, essay: "  " });
    expect(consumeLabChallengeKickoff()).toBeNull();
  });
});

describe("detectLabCoherenceSignal", () => {
  it("detects completion cue", () => {
    expect(
      detectLabCoherenceSignal("Your thinking holds together well."),
    ).toBe(true);
    expect(
      detectLabCoherenceSignal("You are ready for the next challenge question."),
    ).toBe(true);
  });

  it("ignores normal tutor text", () => {
    expect(detectLabCoherenceSignal("Let's break this down step by step.")).toBe(
      false,
    );
    expect(detectLabCoherenceSignal("")).toBe(false);
  });
});
