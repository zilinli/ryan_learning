import { describe, expect, it } from "vitest";
import {
  filterTutorDelta,
  isToolMetaNarration,
  scrubTutorVisibleText,
} from "./tutor-text-filter";

describe("tutor-text-filter", () => {
  it("flags tool meta narration chunks", () => {
    expect(isToolMetaNarration("Let me check what diagram tools we have")).toBe(
      true,
    );
    expect(isToolMetaNarration("I'll use web_search quickly")).toBe(true);
    expect(isToolMetaNarration("What is 7 times 8?")).toBe(false);
  });

  it("scrubs meta phrases from mixed replies", () => {
    const raw =
      "Let me check what diagram tools we have. Here's a simple Earth–Moon sketch to look at.";
    const out = scrubTutorVisibleText(raw);
    expect(out.toLowerCase()).not.toContain("diagram tools");
    expect(out.toLowerCase()).toContain("earth");
  });

  it("filters streaming deltas", () => {
    expect(filterTutorDelta("Let me check what diagram tools we have")).toBe(
      "",
    );
    expect(filterTutorDelta("Nice try — what do you notice?")).toContain(
      "notice",
    );
  });
});
