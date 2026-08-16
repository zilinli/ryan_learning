import { describe, expect, it } from "vitest";
import {
  detectIntentFromText,
  parseIntentFence,
  stripIntentFence,
} from "./intent-fence";

describe("parseIntentFence — block form", () => {
  it("parses a block fence with text", () => {
    const text = [
      "Let me read your draft!",
      "~~~intent",
      '{"kind":"writing","text":"My summer adventure"}',
      "~~~",
    ].join("\n");
    expect(parseIntentFence(text)).toEqual({
      kind: "writing",
      text: "My summer adventure",
    });
  });

  it("parses an inline fence (experiment style)", () => {
    const text = 'Looks great! ~~~intent {"kind":"media","text":"a cat poster"} ~~~';
    expect(parseIntentFence(text)).toEqual({
      kind: "media",
      text: "a cat poster",
    });
  });
});

describe("parseIntentFence — validation", () => {
  it("last fence wins", () => {
    const text = [
      "~~~intent",
      '{"kind":"writing","text":"draft one"}',
      "~~~",
      "~~~intent",
      '{"kind":"game","gameId":"fraction-voyager"}',
      "~~~",
    ].join("\n");
    expect(parseIntentFence(text)).toEqual({
      kind: "game",
      gameId: "fraction-voyager",
    });
  });

  it("ignores unknown kinds and bad JSON", () => {
    expect(parseIntentFence('~~~intent {"kind":"nope"} ~~~')).toBeNull();
    expect(parseIntentFence('~~~intent {bad json} ~~~')).toBeNull();
    expect(parseIntentFence("no fence here")).toBeNull();
  });

  it("returns empty intent when kind only", () => {
    expect(parseIntentFence('~~~intent {"kind":"lab"} ~~~')).toEqual({
      kind: "lab",
    });
  });

  it("parses coding fence with concept and scope", () => {
    const text =
      '~~~intent {"kind":"coding","concept":"loop","scope":"full"} ~~~';
    expect(parseIntentFence(text)).toEqual({
      kind: "coding",
      concept: "loop",
      scope: "full",
    });
    expect(
      parseIntentFence('~~~intent {"kind":"coding","concept":"sequence"} ~~~'),
    ).toEqual({ kind: "coding", concept: "sequence" });
  });
});

describe("stripIntentFence", () => {
  it("removes block fences and collapses blank lines", () => {
    const text = [
      "Some reply.",
      "~~~intent",
      '{"kind":"writing","text":"x"}',
      "~~~",
      "",
      "",
      "Next line.",
    ].join("\n");
    const stripped = stripIntentFence(text);
    expect(stripped).not.toContain("~~~");
    expect(stripped).not.toContain("intent");
    expect(stripped).toContain("Some reply.");
    expect(stripped).toContain("Next line.");
    expect(stripped).not.toMatch(/\n{3,}/);
  });

  it("removes inline fences", () => {
    expect(stripIntentFence('Hi ~~~intent {"kind":"game"} ~~~ there')).toBe(
      "Hi  there",
    );
  });
});

describe("detectIntentFromText — keyword fallback", () => {
  it("detects writing", () => {
    expect(detectIntentFromText("Can you help me write an essay?")).toEqual({
      kind: "writing",
    });
    expect(detectIntentFromText("帮我改一下这篇作文")).toEqual({
      kind: "writing",
    });
  });

  it("detects media", () => {
    expect(detectIntentFromText("Can you make a song about my cat?")).toEqual({
      kind: "media",
    });
    expect(detectIntentFromText("帮我生成一张恐龙图片")).toEqual({
      kind: "media",
    });
  });

  it("detects game", () => {
    expect(detectIntentFromText("I'm bored, let's play something")).toEqual({
      kind: "game",
    });
    expect(detectIntentFromText("我想玩会游戏放松一下")).toEqual({
      kind: "game",
    });
  });

  it("detects coding as a micro challenge", () => {
    expect(detectIntentFromText("Can you teach me Scratch coding?")).toEqual({
      kind: "coding",
      scope: "micro",
      concept: "sequence",
    });
    expect(detectIntentFromText("我想学编程写个循环")).toEqual({
      kind: "coding",
      scope: "micro",
      concept: "loop",
    });
  });

  it("maps coding concept from keywords", () => {
    expect(detectIntentFromText("循环怎么用")).toEqual({
      kind: "coding",
      scope: "micro",
      concept: "loop",
    });
    expect(detectIntentFromText("if 条件判断怎么写")).toEqual({
      kind: "coding",
      scope: "micro",
      concept: "conditional",
    });
  });

  it("detects explicit whole-lesson coding asks as full scope", () => {
    expect(detectIntentFromText("我想玩一关 Code Spark")).toEqual({
      kind: "coding",
      scope: "full",
      concept: "sequence",
    });
    expect(detectIntentFromText("open code spark game")).toEqual({
      kind: "coding",
      scope: "full",
      concept: "sequence",
    });
  });

  it("routes Brilliant-style CS phrases to a micro challenge", () => {
    expect(detectIntentFromText("Help me with computational thinking")).toEqual({
      kind: "coding",
      scope: "micro",
      concept: "sequence",
    });
    expect(detectIntentFromText("什么是计算思维和变量")).toEqual({
      kind: "coding",
      scope: "micro",
      concept: "sequence",
    });
    expect(detectIntentFromText("explain Python functions")).toEqual({
      kind: "coding",
      scope: "micro",
      concept: "sequence",
    });
  });

  it("detects lab", () => {
    expect(detectIntentFromText("Can you recommend a TED talk about space?")).toEqual({
      kind: "lab",
    });
    expect(detectIntentFromText("想看个科普视频")).toEqual({ kind: "lab" });
  });

  it("returns null for empty / unrelated text", () => {
    expect(detectIntentFromText("")).toBeNull();
    expect(detectIntentFromText("What is 7 times 8?")).toBeNull();
    expect(detectIntentFromText("   ")).toBeNull();
  });
});
