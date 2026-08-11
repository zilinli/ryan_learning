import { describe, expect, it } from "vitest";
import {
  applyGrammarReplacement,
  localHeuristicGrammarCheck,
  parseLanguageToolResponse,
} from "./languagetool";

describe("languagetool", () => {
  it("parses LanguageTool JSON matches", () => {
    const matches = parseLanguageToolResponse({
      matches: [
        {
          offset: 5,
          length: 2,
          message: "Did you mean an?",
          replacements: [{ value: "an" }],
          rule: {
            id: "EN_A_VS_AN",
            category: { id: "GRAMMAR", name: "Grammar" },
          },
        },
      ],
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.replacements[0]).toBe("an");
    expect(matches[0]!.category).toBe("grammar");
    expect(matches[0]!.ruleId).toBe("EN_A_VS_AN");
  });

  it("local heuristics catch a/an and repeated words", () => {
    const text = "I saw a apple and the the bus.";
    const matches = localHeuristicGrammarCheck(text);
    expect(matches.some((m) => m.ruleId === "LOCAL_A_AN")).toBe(true);
    expect(matches.some((m) => m.ruleId === "LOCAL_REPEATED_WORD")).toBe(true);
  });

  it("returns empty for blank draft", () => {
    expect(localHeuristicGrammarCheck("   ")).toEqual([]);
  });

  it("applyGrammarReplacement splices cleanly", () => {
    const draft = "This is an test.";
    // offset of "an" = 8, length 2 → "a"
    expect(applyGrammarReplacement(draft, { offset: 8, length: 2 }, "a")).toBe(
      "This is a test.",
    );
  });
});
