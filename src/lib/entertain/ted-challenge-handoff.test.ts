import { afterEach, describe, expect, it } from "vitest";
import {
  buildFallbackChallenge,
  type ChallengeItem,
} from "./ted-challenge";
import { findTedTalk } from "./ted-catalog";
import {
  buildTedChallengeKickoffMessage,
  canSubmitHybrid,
  clearTedChallengeResume,
  consumeTedChallengeKickoff,
  consumeTedChallengeResume,
  detectTedCoherenceSignal,
  formatSelectedChoiceSummary,
  prepareTedChallengeHandoff,
  stashTedChallengeKickoff,
  stashTedChallengeResume,
} from "./ted-challenge-handoff";
import { buildChoiceSoftFeedback } from "./ted-challenge";

function sampleItem(): ChallengeItem {
  return {
    id: "q1",
    kind: "critique",
    prompt: "What surprised you?",
    rubricHint: "Because…",
    choices: ["A surprise", "Nothing", "Clothes", "Unrelated"],
    choiceMode: "single",
    correctChoices: [0],
  };
}

afterEach(() => {
  consumeTedChallengeKickoff();
  clearTedChallengeResume();
});

describe("ted-challenge-handoff (TH1–TH6)", () => {
  it("TH1: canSubmitHybrid requires essay; empty selection OK", () => {
    expect(canSubmitHybrid("", []).ok).toBe(false);
    expect(canSubmitHybrid("ab", []).ok).toBe(false);
    expect(canSubmitHybrid("Yes because…", []).ok).toBe(true);
    expect(canSubmitHybrid("Yes because…", [0, 2]).ok).toBe(true);
  });

  it("TH2: kickoff message includes prompt, none/choices, essay, Socratic + coherence", () => {
    const msg = buildTedChallengeKickoffMessage({
      talkSlug: "demo",
      talkTitle: "Demo Talk",
      speaker: "Ada",
      itemId: "q1",
      kind: "critique",
      prompt: "What surprised you?",
      choices: ["A", "B", "C", "D"],
      selected: [],
      essay: "I think the claim needs a trade-off.",
      qi: 0,
      nextQi: 1,
    });
    expect(msg).toContain("Demo Talk");
    expect(msg).toContain("What surprised you?");
    expect(msg).toMatch(/none of the listed|own view/i);
    expect(msg).toContain("trade-off");
    expect(msg.toLowerCase()).toMatch(/socratic/);
    expect(msg.toLowerCase()).toMatch(/self-consistent|holds together|next ted/);

    const withSel = buildTedChallengeKickoffMessage({
      talkSlug: "demo",
      talkTitle: "Demo Talk",
      speaker: "Ada",
      itemId: "q1",
      kind: "literal",
      prompt: "Main idea?",
      choices: ["Claim", "Joke", "List", "Game"],
      selected: [0, 2],
      essay: "Both the claim and the list matter because…",
      qi: 1,
      nextQi: 2,
    });
    expect(withSel).toContain("A. Claim");
    expect(formatSelectedChoiceSummary(["Claim", "Joke"], [0])).toContain("A.");
  });

  it("TH3: stash/consume kickoff is one-shot", () => {
    stashTedChallengeKickoff({
      talkSlug: "susan_cain_the_power_of_introverts",
      talkTitle: "The power of introverts",
      speaker: "Susan Cain",
      itemId: "q1",
      kind: "literal",
      prompt: "Main idea?",
      choices: ["A", "B", "C", "D"],
      selected: [0],
      essay: "Introverts bring quiet strength.",
      qi: 0,
      nextQi: 1,
    });
    const a = consumeTedChallengeKickoff();
    expect(a?.talkSlug).toContain("susan_cain");
    expect(a?.essay).toMatch(/quiet strength/);
    expect(consumeTedChallengeKickoff()).toBeNull();
  });

  it("TH4: stash/consume resume round-trips talkSlug + qi + items", () => {
    const talk = findTedTalk("susan_cain_the_power_of_introverts");
    expect(talk).toBeTruthy();
    const challenge = buildFallbackChallenge(talk!, "Hook. Middle. End. Enough text for fallback. ".repeat(20), {
      grade: 4,
      englishLevel: "developing",
    });
    stashTedChallengeResume({
      talkSlug: talk!.slug,
      talkTitle: talk!.title,
      speaker: talk!.speaker,
      challenge,
      qi: 2,
      answers: { q1: { selected: [0], essay: "hi there" } },
    });
    const r = consumeTedChallengeResume();
    expect(r?.talkSlug).toBe(talk!.slug);
    expect(r?.qi).toBe(2);
    expect(r?.challenge.items.length).toBeGreaterThanOrEqual(4);
    expect(consumeTedChallengeResume()).toBeNull();
  });

  it("TH5: detectTedCoherenceSignal true on cue; false on generic praise", () => {
    expect(
      detectTedCoherenceSignal(
        "Your thinking holds together — ready for the next TED Challenge question.",
      ),
    ).toBe(true);
    expect(
      detectTedCoherenceSignal("Nice try — what evidence supports that?"),
    ).toBe(false);
  });

  it("TH6: empty selection soft feedback is advisory", () => {
    const fb = buildChoiceSoftFeedback(sampleItem(), []);
    expect(fb.toLowerCase()).not.toMatch(/pick at least one.*before locking/);
    expect(fb.toLowerCase()).toMatch(/essay|own view|optional/);
  });

  it("prepareTedChallengeHandoff advances qi", () => {
    const talk = findTedTalk("susan_cain_the_power_of_introverts")!;
    const challenge = buildFallbackChallenge(talk, "x ".repeat(80), {
      grade: 4,
    });
    const item = challenge.items[0]!;
    const { kickoff, resume } = prepareTedChallengeHandoff({
      talkSlug: talk.slug,
      talkTitle: talk.title,
      speaker: talk.speaker,
      item,
      selected: [],
      essay: "My own take because…",
      qi: 0,
      challenge,
      answers: { [item.id]: { selected: [], essay: "My own take because…" } },
    });
    expect(kickoff.nextQi).toBe(1);
    expect(resume.qi).toBe(1);
  });
});
