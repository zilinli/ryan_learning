import { describe, expect, it } from "vitest";
import {
  normalizeMemory,
  recordLearningTurnMemory,
} from "./learning-memory";

describe("recordLearningTurnMemory outcome override", () => {
  it("honors explicit correct outcome even with neutral assistant text", () => {
    const prev = normalizeMemory({});
    const next = recordLearningTurnMemory(prev, {
      userText:
        "[TED Lab challenge]\nscience biology evidence\nStudent: The speaker claims oceans warm because of greenhouse gases.",
      assistantText: "Neutral coach note with no win keywords.",
      chatTitle: "TED · climate",
      outcome: "correct",
    });
    expect(next.skills.length).toBeGreaterThan(0);
    const touched = next.skills[0]!;
    expect(touched.correct).toBeGreaterThanOrEqual(1);
    expect(touched.attempts).toBeGreaterThanOrEqual(1);
  });

  it("honors incorrect outcome for short Studio answers", () => {
    const prev = normalizeMemory({});
    const next = recordLearningTurnMemory(prev, {
      userText:
        "[TED Lab challenge]\nreading comprehension argument\nStudent: ok",
      assistantText: "Short answers can be sharp — but this one needs more.",
      outcome: "incorrect",
    });
    expect(next.skills[0]?.incorrect).toBeGreaterThanOrEqual(1);
  });
});
