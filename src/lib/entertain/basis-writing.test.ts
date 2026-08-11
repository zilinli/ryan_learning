import { describe, expect, it } from "vitest";
import {
  buildBasisCoachLocal,
  mergeBasisCoachFromLlm,
  scoreToLevel,
} from "./basis-writing";

const VAGUE = [
  "Life is full of things and stuff.",
  "Things make me feel things again.",
  "Stuff happens and life goes on.",
  "Things keep happening until the end.",
].join("\n");

const RICH = [
  "Rain taps the cracked phone screen on the bus seat.",
  "The diesel smell sticks to my hoodie after school.",
  "One laugh from the back row lands at the wrong time.",
  "I pocket the silence and walk home alone.",
].join("\n");

describe("basis-writing", () => {
  it("scores vague drafts weak on detail + vocab focus", () => {
    const r = buildBasisCoachLocal(VAGUE);
    expect(r.dimensions).toHaveLength(4);
    expect(r.stats.words).toBeGreaterThan(10);
    const detail = r.dimensions.find((d) => d.id === "detail")!;
    const vocab = r.dimensions.find((d) => d.id === "vocab")!;
    expect(detail.score).toBeLessThanOrEqual(3);
    expect(vocab.score).toBeLessThanOrEqual(3);
    expect(r.focusIds.length).toBeGreaterThan(0);
    expect(r.headline.toLowerCase()).toMatch(/need|work|detail|vocab|topic|grammar/);
    expect(r.craftTip.length).toBeGreaterThan(10);
    expect(r.questions.length).toBeGreaterThan(0);
    expect(r.summary).toMatch(/Craft tip:/);
  });

  it("scores rich sensory drafts stronger overall", () => {
    const vague = buildBasisCoachLocal(VAGUE);
    const rich = buildBasisCoachLocal(RICH);
    expect(rich.overall).toBeGreaterThan(vague.overall);
    const detail = rich.dimensions.find((d) => d.id === "detail")!;
    expect(detail.score).toBeGreaterThanOrEqual(3);
    expect(scoreToLevel(5)).toBe("strong");
    expect(scoreToLevel(1)).toBe("weak");
  });

  it("mergeBasisCoachFromLlm patches tips and focus", () => {
    const base = buildBasisCoachLocal(VAGUE);
    const merged = mergeBasisCoachFromLlm(base, {
      headline: "Needs the most work: detail support.",
      focusIds: ["detail"],
      craftTip: "Ban the word thing for one draft.",
      questions: ["What scene is this really about?"],
      dimensions: [
        { id: "detail", score: 1, tip: "Plant one concrete object.", evidence: "thing" },
        { id: "topic", score: 4, tip: "Topic is clear enough." },
      ],
    });
    expect(merged.focusIds).toEqual(["detail"]);
    expect(merged.craftTip).toMatch(/Ban the word thing/);
    expect(merged.dimensions.find((d) => d.id === "detail")!.score).toBe(1);
    expect(merged.dimensions.find((d) => d.id === "topic")!.score).toBe(4);
    expect(merged.questions[0]).toMatch(/scene/);
  });
});
