import { describe, expect, it } from "vitest";
import {
  emptyLearningMemory,
  inferTopicsFromText,
  learningMemoryPromptLines,
  mergeLearningMemory,
  recordLearningTurnMemory,
} from "./learning-memory";

describe("learning-memory", () => {
  it("infers fraction and space topics", () => {
    expect(inferTopicsFromText("Help with 3/4 + 2/8 fractions").map((t) => t.id)).toContain(
      "fractions",
    );
    expect(inferTopicsFromText("Why does the Moon change phases?").map((t) => t.id)).toContain(
      "science-space",
    );
  });

  it("records struggle and win notes with mastery shifts", () => {
    let mem = emptyLearningMemory();
    mem = recordLearningTurnMemory(mem, {
      userText: "I'm stuck on this fraction problem",
    });
    expect(mem.topics.some((t) => t.id === "fractions")).toBe(true);
    expect(mem.recentStruggles[0]).toMatch(/fraction/i);
    const before = mem.topics.find((t) => t.id === "fractions")!.mastery;

    mem = recordLearningTurnMemory(mem, {
      userText: "got it!",
      assistantText: "Yes, that's right — nice work on equivalent fractions.",
      chatTitle: "Fractions homework",
    });
    const after = mem.topics.find((t) => t.id === "fractions")!.mastery;
    expect(after).toBeGreaterThan(before);
    expect(mem.recentWins[0]).toMatch(/fraction/i);
  });

  it("merges remote and local by max mastery", () => {
    const a = recordLearningTurnMemory(emptyLearningMemory(), {
      userText: "moon phases diagram",
    });
    const b = {
      ...emptyLearningMemory(),
      topics: [
        {
          id: "science-space",
          label: "Earth–Moon–Sun / space",
          mastery: 90,
          solves: 5,
          lastSeen: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    };
    const merged = mergeLearningMemory(a, b);
    expect(merged.topics.find((t) => t.id === "science-space")!.mastery).toBe(90);
  });

  it("renders prompt continuity lines", () => {
    const mem = recordLearningTurnMemory(emptyLearningMemory(), {
      userText: "fractions worksheet",
    });
    const text = learningMemoryPromptLines(mem).join("\n");
    expect(text).toContain("Learning memory");
    expect(text).toMatch(/fraction/i);
    expect(text).toMatch(/Adaptive difficulty/);
    expect(text).toMatch(/Self-assessment|confidence/i);
  });
});
