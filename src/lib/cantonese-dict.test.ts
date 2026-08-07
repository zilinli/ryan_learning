/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { lookupCantonese, searchCantonese, CANTONESE_DICT } from "./cantonese-dict";

describe("Cantonese dictionary dataset", () => {
  it("contains at least 50 entries", () => {
    expect(CANTONESE_DICT.length).toBeGreaterThanOrEqual(50);
  });

  it("all entries have required fields", () => {
    for (const e of CANTONESE_DICT) {
      expect(e.traditional).toBeTruthy();
      expect(e.simplified).toBeTruthy();
      expect(e.jyutping).toBeTruthy();
      expect(typeof e.tone).toBe("number");
      expect(e.tone).toBeGreaterThanOrEqual(1);
      expect(e.tone).toBeLessThanOrEqual(6);
      expect(e.gloss).toBeTruthy();
    }
  });
});

describe("lookupCantonese", () => {
  it("finds by traditional character", () => {
    const res = lookupCantonese("我");
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0]!.traditional).toBe("我");
    expect(res[0]!.jyutping).toBe("ngo5");
    expect(res[0]!.gloss).toMatch(/I|me/i);
  });

  it("finds by jyutping", () => {
    const res = lookupCantonese("ngo5");
    expect(res.some((e) => e.traditional === "我")).toBe(true);
  });

  it("finds by partial jyutping via search", () => {
    const res = searchCantonese("ngo");
    expect(res.some((e) => e.traditional === "我")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(lookupCantonese("NGO5").length).toBeGreaterThan(0);
    expect(lookupCantonese("Sik6").length).toBeGreaterThan(0);
    expect(lookupCantonese("Gam1Jat6").length).toBeGreaterThan(0);
  });

  it("returns empty for non-matching query", () => {
    expect(lookupCantonese("zzzz")).toEqual([]);
    expect(lookupCantonese("")).toEqual([]);
  });
});

describe("searchCantonese", () => {
  it("returns entries sorted by relevance", () => {
    const res = searchCantonese("ngo");
    expect(res.length).toBeGreaterThan(0);
  });

  it("finds by English gloss", () => {
    const res = searchCantonese("water");
    expect(res.some((e) => e.gloss.toLowerCase().includes("water"))).toBe(true);
  });

  it("finds by partial jyutping", () => {
    const res = searchCantonese("sik");
    expect(res.some((e) => e.jyutping.includes("sik"))).toBe(true);
  });

  it("returns empty for nonsense input", () => {
    expect(searchCantonese("xyzzzznonexist")).toEqual([]);
  });
});
