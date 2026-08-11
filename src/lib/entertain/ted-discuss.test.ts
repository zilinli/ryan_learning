import { describe, expect, it } from "vitest";
import {
  buildTedDiscussOpenerLocal,
  buildTedDiscussReplyLocal,
  buildTedDiscussSeedMessage,
  contextFromKickoff,
  discussOpenAgentPrompt,
} from "./ted-discuss";

const CTX = contextFromKickoff({
  talkTitle: "The power of introverts",
  speaker: "Susan Cain",
  kind: "critique",
  prompt: "What surprised you most?",
  choices: ["Quiet strength", "Loud rooms", "Clothes", "Unrelated"],
  selected: [0],
  essay: "I think quiet focus is a strength because the talk shows deep work.",
});

describe("ted-discuss (TD1–TD3)", () => {
  it("TD1: local opener references prompt context and essay; no correct-letter spoiler", () => {
    const open = buildTedDiscussOpenerLocal(CTX);
    expect(open).toMatch(/quiet focus|essay|strength/i);
    expect(open.toLowerCase()).not.toMatch(/correct (is|answer)|answer is [a-d]/);
    expect(open).toMatch(/\?/);
  });

  it("TD2: local reply can emit coherence cue on reasoned affirmation", () => {
    const reply = buildTedDiscussReplyLocal(
      CTX,
      "Yes because the evidence about solitude and deep work holds together with my claim.",
    );
    expect(reply.toLowerCase()).toMatch(/holds together|ready for the next/);
  });

  it("TD3: seed + open prompts include selection and forbid spoilers", () => {
    const seed = buildTedDiscussSeedMessage(CTX);
    expect(seed).toContain("The power of introverts");
    expect(seed).toContain("Quiet strength");
    expect(seed.toLowerCase()).toMatch(/socratic/);
    const open = discussOpenAgentPrompt(CTX);
    expect(open).toMatch(/Do NOT reveal/i);
    expect(open).toContain(CTX.essay.slice(0, 20));
  });

  it("opener for empty selection asks about own view", () => {
    const empty = buildTedDiscussOpenerLocal({
      ...CTX,
      selected: [],
      essay: "My own take is about trade-offs in the claim.",
    });
    expect(empty.toLowerCase()).toMatch(/skipped|own|push/);
  });
});
