import { describe, expect, it } from "vitest";
import { rewriteEntertainStudioSearch, studioHref } from "./studio-path";

describe("studio-path", () => {
  it("studioHref is a direct /studio route", () => {
    expect(studioHref()).toBe("/studio");
    expect(studioHref({ game: "ted-lab" })).toBe("/studio?game=ted-lab");
    expect(studioHref({ game: "writing-studio", journal: "je_1" })).toBe(
      "/studio?game=writing-studio&journal=je_1",
    );
  });

  it("rewrites legacy entertain?hub=studio", () => {
    expect(rewriteEntertainStudioSearch("?hub=studio")).toBe("/studio");
    expect(
      rewriteEntertainStudioSearch("hub=studio&game=creations"),
    ).toBe("/studio?game=creations");
    expect(rewriteEntertainStudioSearch("?hub=games")).toBeNull();
    expect(rewriteEntertainStudioSearch("")).toBeNull();
  });
});
