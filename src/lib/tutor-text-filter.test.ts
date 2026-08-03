import { describe, expect, it } from "vitest";
import {
  filterTutorDelta,
  isToolMetaNarration,
  preferCompleteTutorText,
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

  it("preserves English streaming spaces and punctuation", () => {
    const chunks = ["Hello", ",", " world", "!", " Nice", " day", "."];
    let visible = "";
    for (const c of chunks) {
      visible += filterTutorDelta(c);
    }
    expect(visible).toBe("Hello, world! Nice day.");
  });

  it("preserves markdown image data URIs across deltas", () => {
    const chunks = [
      "![t]",
      "(",
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org",
      "%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E",
      ")",
      "\nOK",
    ];
    let visible = "";
    for (const c of chunks) {
      visible += filterTutorDelta(c);
    }
    expect(visible).toContain("data:image/svg+xml");
    expect(visible).toContain("%3Csvg");
    expect(visible).toContain("![t](");
  });

  it("prefers final SDK text when stream lost spaces", () => {
    expect(
      preferCompleteTutorText("Helloworld", "Hello, world!"),
    ).toBe("Hello, world!");
    expect(preferCompleteTutorText("Hello, world!", "Hello, world!")).toBe(
      "Hello, world!",
    );
  });

  it("prefers final when English is glued but Chinese has no spaces", () => {
    const glued =
      "Youpicked13I'lltranslate.15选B方法先划掉不符选项.Andyourmapsofar11D";
    const good =
      "You picked 13. I'll translate. 15选B方法先划掉不符选项. And your map so far 11D";
    expect(preferCompleteTutorText(glued, good)).toBe(good);
  });

  it("keeps streamed diagram when final text omits the SVG", () => {
    const withFig =
      "睇吓呢个直角三角形：\n![直角三角形 ABC](data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E)\n你注意到咩？";
    const noFig =
      "睇吓呢个直角三角形 ABC。直角喺 C。你注意到边度最长？边度系直角？";
    const out = preferCompleteTutorText(withFig, noFig);
    expect(out).toContain("data:image/svg+xml");
    expect(out).toContain("你注意到");
  });
});
