import { describe, expect, it, beforeEach } from "vitest";
import {
  appendVoiceTranscript,
  buildFallbackChallenge,
  buildChoiceSoftFeedback,
  buildEssaySoftFeedback,
  buildHybridSoftFeedback,
  challengePromptSpeechText,
  challengeSystemPrompt,
  enrichChallengeItem,
  formatHybridAnswerNotes,
  formatTedDifficultyLabel,
  loadTedPromptListenEnabled,
  parseChallengeJson,
  resolveTedChallengeLevel,
  saveTedPromptListenEnabled,
  scoreChoiceSelection,
  tedPromptListenText,
  type ChallengeItem,
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

const richTx =
  "Hook sentence that is long enough for parsing into a challenge cue. ".repeat(
    8,
  ) +
  "Middle evidence appears here with enough length to matter. ".repeat(4) +
  "Closing implication wraps the arc for listeners.";

describe("resolveTedChallengeLevel (grade grain)", () => {
  it("TD1: grade 4 + unset english → developing", () => {
    expect(resolveTedChallengeLevel({ grade: 4 })).toBe("developing");
  });

  it("TD1b: grade 3 → emerging; grade 5 → developing", () => {
    expect(resolveTedChallengeLevel({ grade: 3 })).toBe("emerging");
    expect(resolveTedChallengeLevel({ grade: 5 })).toBe("developing");
  });

  it("TD2: englishLevel advanced overrides grade 3", () => {
    expect(
      resolveTedChallengeLevel({ grade: 3, englishLevel: "advanced" }),
    ).toBe("advanced");
  });

  it("TD3: young age vs high grade softens one step", () => {
    // grade 10 → advanced; age much younger than typical (~15) softens
    expect(
      resolveTedChallengeLevel({ grade: 10, age: 11, englishLevel: "advanced" }),
    ).toBe("confident");
  });

  it("defaults missing learner to G4 developing", () => {
    expect(resolveTedChallengeLevel(null)).toBe("developing");
    expect(resolveTedChallengeLevel({})).toBe("developing");
  });

  it("formatTedDifficultyLabel shows G10 · advanced", () => {
    expect(formatTedDifficultyLabel({ grade: 10 })).toBe("G10 · advanced");
    expect(formatTedDifficultyLabel({ grade: 4 })).toBe("G4 · developing");
  });
});

describe("banded + grade-cued fallbacks", () => {
  it("TD4: emerging fallback has no steelman / rhetoric jargon", () => {
    const c = buildFallbackChallenge(talk, richTx, { grade: 3 });
    expect(c.level).toBe("emerging");
    const blob = c.items.map((i) => i.prompt + i.rubricHint).join("\n");
    expect(blob.toLowerCase()).not.toMatch(/steelman|rhetoric/);
  });

  it("TD5: advanced fallback still includes critique + retell", () => {
    const c = buildFallbackChallenge(talk, richTx, {
      grade: 10,
      englishLevel: "advanced",
    });
    const kinds = new Set(c.items.map((i) => i.kind));
    expect(kinds.has("critique")).toBe(true);
    expect(kinds.has("retell")).toBe(true);
    expect(c.items.some((i) => /steelman/i.test(i.prompt))).toBe(true);
  });

  it("TD7: G4 fallback friendlier than advanced / G10", () => {
    const g4 = buildFallbackChallenge(talk, richTx, { grade: 4 });
    const g10 = buildFallbackChallenge(talk, richTx, {
      grade: 10,
      englishLevel: "advanced",
    });
    expect(g4.level).toBe("developing");
    expect(g4.items.some((i) => /steelman/i.test(i.prompt))).toBe(false);
    expect(g10.items.some((i) => /steelman/i.test(i.prompt))).toBe(true);
  });

  it("G9 vs G10 advanced cues differ", () => {
    const g9 = buildFallbackChallenge(talk, richTx, { grade: 9 });
    const g10 = buildFallbackChallenge(talk, richTx, { grade: 10 });
    expect(g9.level).toBe("advanced");
    expect(g10.level).toBe("advanced");
    const g9Retell = g9.items.find((i) => i.kind === "retell")!.prompt;
    const g10Retell = g10.items.find((i) => i.kind === "retell")!.prompt;
    expect(g9Retell).toMatch(/max 4 sentences/);
    expect(g10Retell).toMatch(/about 5 sentences/);
    expect(g10.items.some((i) => /Grade 10/.test(i.prompt))).toBe(true);
  });

  it("G4 vs G5 developing cues differ", () => {
    const g4 = buildFallbackChallenge(talk, richTx, { grade: 4 });
    const g5 = buildFallbackChallenge(talk, richTx, { grade: 5 });
    expect(g4.level).toBe("developing");
    expect(g5.level).toBe("developing");
    const g4Retell = g4.items.find((i) => i.kind === "retell")!.prompt;
    const g5Retell = g5.items.find((i) => i.kind === "retell")!.prompt;
    expect(g4Retell).toMatch(/about 3 sentences/);
    expect(g5Retell).toMatch(/about 4 sentences/);
  });

  it("buildFallbackChallenge mixes kinds (legacy)", () => {
    const c = buildFallbackChallenge(talk, richTx, { grade: 4 });
    expect(c.items.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(c.items.map((i) => i.kind));
    expect(kinds.has("literal")).toBe(true);
    expect(kinds.has("retell")).toBe(true);
    expect(c.generatedFromTranscript).toBe(true);
    expect(c.grade).toBe(4);
  });
});

describe("challengeSystemPrompt", () => {
  it("TD6: mentions resolved band and Grade N", () => {
    const p4 = challengeSystemPrompt(talk, { grade: 4 });
    expect(p4).toMatch(/developing/i);
    expect(p4).toMatch(/Grade 4/);
    expect(p4).toMatch(/G4 grain/);

    const p10 = challengeSystemPrompt(talk, { grade: 10 });
    expect(p10).toMatch(/advanced/i);
    expect(p10).toMatch(/Grade 10/);
    expect(p10).toMatch(/G10 grain/);
    expect(p10).not.toMatch(/G4 grain/);
  });
});

describe("parse + voice", () => {
  it("parseChallengeJson accepts LLM JSON", () => {
    const raw = `Here you go
{"items":[
  {"kind":"literal","prompt":"What is the claim?","rubricHint":"Be precise"},
  {"kind":"structure","prompt":"Sketch the arc","rubricHint":"3 bullets"},
  {"kind":"critique","prompt":"Steelman an objection","rubricHint":"Trade-offs"}
]}`;
    const parsed = parseChallengeJson(raw, talk, "advanced", 10);
    expect(parsed?.items).toHaveLength(3);
    expect(parsed?.items[0].kind).toBe("literal");
    expect(parsed?.level).toBe("advanced");
    expect(parsed?.grade).toBe(10);
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

  it("tedPromptListenText trims", () => {
    expect(tedPromptListenText("  Hello  ")).toBe("Hello");
    expect(tedPromptListenText("   ")).toBe("");
  });
});

describe("TED prompt Listen preference (TL1–TL3)", () => {
  const ACCT_A = "acct_ted_listen_a";
  const ACCT_B = "acct_ted_listen_b";
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };

  beforeEach(() => {
    store.clear();
    (globalThis as Record<string, unknown>).localStorage = ls;
    (globalThis as Record<string, unknown>).window = { localStorage: ls };
  });

  it("TL1: default load → true", () => {
    expect(loadTedPromptListenEnabled(ACCT_A)).toBe(true);
  });

  it("TL2: save false then load → false", () => {
    saveTedPromptListenEnabled(false, ACCT_A);
    expect(loadTedPromptListenEnabled(ACCT_A)).toBe(false);
    saveTedPromptListenEnabled(true, ACCT_A);
    expect(loadTedPromptListenEnabled(ACCT_A)).toBe(true);
  });

  it("TL3: account A off does not affect B default", () => {
    saveTedPromptListenEnabled(false, ACCT_A);
    expect(loadTedPromptListenEnabled(ACCT_A)).toBe(false);
    expect(loadTedPromptListenEnabled(ACCT_B)).toBe(true);
  });
});

describe("challenge prompt speech text (TS1–TS2)", () => {
  const base: ChallengeItem = {
    id: "q1",
    kind: "literal",
    prompt: "  What is the main idea?  ",
    rubricHint: "Be clear",
    choices: ["A story", "Only jokes", "Random facts", "A game"],
    choiceMode: "single",
    correctChoices: [0],
  };

  it("TS1: prompt only → trimmed speech text when choices empty after trim", () => {
    expect(challengePromptSpeechText({ ...base, choices: [] })).toBe(
      "What is the main idea?",
    );
    expect(
      challengePromptSpeechText({
        ...base,
        choices: ["", "  ", "", ""],
      }),
    ).toBe("What is the main idea?");
  });

  it("TS2: prompt + choices → numbered Choices suffix", () => {
    const withChoices: ChallengeItem = {
      ...base,
      choices: ["A story", "Only jokes", "  ", "Extra"],
    };
    expect(challengePromptSpeechText(withChoices)).toBe(
      "What is the main idea? Choices: 1. A story. 2. Only jokes. 3. Extra.",
    );
  });
});

describe("hybrid MCQ + essay (TMH1–TMH6)", () => {
  it("TMH1: every fallback item (all bands) has 4 choices + mode + corrects", () => {
    for (const grade of [3, 4, 7, 10]) {
      const c = buildFallbackChallenge(talk, richTx, { grade });
      expect(c.items.length).toBeGreaterThanOrEqual(4);
      for (const item of c.items) {
        expect(item.choices).toHaveLength(4);
        expect(["single", "multi"]).toContain(item.choiceMode);
        expect(item.correctChoices.length).toBeGreaterThan(0);
      }
    }
  });

  it("TMH2: scoreChoiceSelection exact / partial / miss", () => {
    const item = enrichChallengeItem(
      {
        kind: "structure",
        prompt: "Arc?",
        choiceMode: "multi",
        choices: ["Hook", "Evidence", "Takeaway", "Ad"],
        correctChoices: [0, 1, 2],
      },
      0,
    );
    expect(scoreChoiceSelection(item, [0, 1, 2])).toBe("exact");
    expect(scoreChoiceSelection(item, [0, 1])).toBe("partial");
    expect(scoreChoiceSelection(item, [3])).toBe("miss");
    expect(scoreChoiceSelection(item, [])).toBe("empty");
  });

  it("TMH3: enrichChallengeItem pads <4 choices and defaults mode", () => {
    const item = enrichChallengeItem(
      { kind: "literal", prompt: "Main idea?", choices: ["Only one"] },
      2,
    );
    expect(item.id).toBe("q3");
    expect(item.choices).toHaveLength(4);
    expect(item.choiceMode).toBe("single");
    expect(item.correctChoices).toEqual([0]);
  });

  it("TMH4: parseChallengeJson keeps hybrid fields", () => {
    const raw = `{"items":[
      {"kind":"literal","prompt":"Claim?","rubricHint":"Be precise","choiceMode":"single","choices":["A","B","C","D"],"correctChoices":[1]},
      {"kind":"structure","prompt":"Arc","rubricHint":"3 bullets","choiceMode":"multi","choices":["H","E","T","X"],"correctChoices":[0,1,2]},
      {"kind":"critique","prompt":"Gap?","rubricHint":"Trade-offs","choices":["Gap","Accent","Color","Noise"]}
    ]}`;
    const parsed = parseChallengeJson(raw, talk, "developing", 4);
    expect(parsed?.items).toHaveLength(3);
    expect(parsed?.items[0].correctChoices).toEqual([1]);
    expect(parsed?.items[1].choiceMode).toBe("multi");
    expect(parsed?.items[2].choices).toHaveLength(4);
    expect(parsed?.items[2].correctChoices.length).toBeGreaterThan(0);
  });

  it("TMH5: system prompt requires 4 choices + single|multi on every item", () => {
    const p = challengeSystemPrompt(talk, { grade: 4 });
    expect(p).toMatch(/EVERY item/i);
    expect(p).toMatch(/choiceMode/);
    expect(p).toMatch(/correctChoices/);
    expect(p).toMatch(/single\|multi/);
  });

  it("TMH6: formatHybridAnswerNotes + soft feedback", () => {
    const item = enrichChallengeItem(
      {
        kind: "literal",
        prompt: "Main idea",
        choiceMode: "single",
        choices: ["Idea", "Joke", "List", "Game"],
        correctChoices: [0],
      },
      0,
    );
    expect(
      formatHybridAnswerNotes(item, [0], "The talk is about kindness."),
    ).toBe("Choices: A\nEssay: The talk is about kindness.");
    const fb = buildHybridSoftFeedback(
      item,
      [0],
      "The talk is about kindness because the speaker shares a clear idea.",
      "developing",
    );
    expect(fb).toMatch(/lines up with the talk/i);
  });

  it("TMH7: buildChoiceSoftFeedback independent of essay", () => {
    const item = enrichChallengeItem(
      {
        kind: "literal",
        prompt: "Main idea",
        choiceMode: "single",
        choices: ["Idea", "Joke", "List", "Game"],
        correctChoices: [0],
      },
      0,
    );
    const exact = buildChoiceSoftFeedback(item, [0]);
    const miss = buildChoiceSoftFeedback(item, [1]);
    const empty = buildChoiceSoftFeedback(item, []);
    expect(exact).toMatch(/lines up with the talk/i);
    expect(miss).toMatch(/may miss the talk/i);
    expect(empty).toMatch(/Pick at least one option/i);
    expect(exact).not.toMatch(/write-up|essay|retell/i);
  });

  it("TMH8: buildEssaySoftFeedback independent of selection", () => {
    const item = enrichChallengeItem(
      {
        kind: "literal",
        prompt: "Main idea",
        choiceMode: "single",
        choices: ["Idea", "Joke", "List", "Game"],
        correctChoices: [0],
      },
      0,
    );
    const short = buildEssaySoftFeedback(item, "ok", "developing");
    const solid = buildEssaySoftFeedback(
      item,
      "The talk is about kindness because the speaker shares a clear idea.",
      "developing",
    );
    expect(short).toMatch(/more evidence|clearer claim/i);
    expect(solid).toMatch(/Solid draft|Rubric nudge/i);
    expect(solid).not.toMatch(/selection|Pick at least/i);
  });
});
