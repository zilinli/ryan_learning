import { beforeEach, describe, expect, it } from "vitest";
import {
  emotionPromptLines,
  emotionUiLine,
  noteEmotionOutcome,
  resetEmotionStreakForTests,
} from "./emotion-rhythm";
import { softSendErrorLine } from "./error-guides";

describe("emotion-rhythm", () => {
  beforeEach(() => {
    resetEmotionStreakForTests();
  });

  it("stacks struggle copy after two struggles", () => {
    noteEmotionOutcome("win");
    noteEmotionOutcome("struggle");
    const s = noteEmotionOutcome("struggle");
    expect(s.count).toBe(2);
    expect(emotionUiLine(s)).toMatch(/No worries/i);
    expect(emotionPromptLines(s).join("\n")).toMatch(/struggled/i);
  });
});

describe("error-guides", () => {
  it("softens network and key errors", () => {
    expect(softSendErrorLine("Failed to fetch")).toMatch(/Wi/);
    expect(softSendErrorLine("CURSOR_API_KEY missing")).toMatch(/parent/i);
    expect(softSendErrorLine("weird")).toMatch(/together/i);
  });
});
