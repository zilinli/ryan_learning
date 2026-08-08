/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  lookupTeochew,
  searchTeochew,
  teochewLookup,
  TEOCHEW_DICT,
} from "./teochew-dict";

describe("Teochew dictionary dataset", () => {
  it("contains at least 100 entries", () => {
    expect(TEOCHEW_DICT.length).toBeGreaterThanOrEqual(100);
  });

  it("all entries have required fields", () => {
    for (const e of TEOCHEW_DICT) {
      expect(e.traditional).toBeTruthy();
      expect(e.simplified).toBeTruthy();
      expect(e.pengim).toBeTruthy();
      expect(typeof e.tone).toBe("number");
      expect(e.tone).toBeGreaterThanOrEqual(1);
      expect(e.tone).toBeLessThanOrEqual(8);
      expect(e.gloss).toBeTruthy();
    }
  });

  it("covers the core grammar particles from the design doc", () => {
    const trad = new Set(TEOCHEW_DICT.map((e) => e.traditional));
    expect(trad.has("个")).toBe(true); // possessive (的)
    expect(trad.has("唔")).toBe(true); // not
    expect(trad.has("勿")).toBe(true); // don't
    expect(trad.has("食")).toBe(true); // eat/drink
    expect(trad.has("睇")).toBe(true); // see/look
  });
});

describe("lookupTeochew", () => {
  it("finds by traditional character", () => {
    const res = lookupTeochew("个");
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0]!.traditional).toBe("个");
    expect(res[0]!.gloss).toMatch(/possessive/i);
  });

  it("finds 我 by pengim", () => {
    const res = lookupTeochew("ua2");
    expect(res.some((e) => e.traditional === "我")).toBe(true);
  });

  it("finds by partial pengim via search", () => {
    const res = searchTeochew("ua");
    expect(res.some((e) => e.traditional === "我")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(lookupTeochew("UA2").length).toBeGreaterThan(0);
    expect(lookupTeochew("Ziah8").length).toBeGreaterThan(0);
  });

  it("returns empty for non-matching query", () => {
    expect(lookupTeochew("zzzz")).toEqual([]);
    expect(lookupTeochew("")).toEqual([]);
  });
});

describe("searchTeochew", () => {
  it("finds by English gloss", () => {
    const res = searchTeochew("water");
    expect(res.some((e) => e.gloss.toLowerCase().includes("water"))).toBe(true);
  });

  it("finds 食饭 phrase by character", () => {
    const res = searchTeochew("食饭");
    expect(res.some((e) => e.traditional === "食饭")).toBe(true);
  });

  it("returns empty for nonsense input", () => {
    expect(searchTeochew("xyzzzznonexist")).toEqual([]);
  });
});

describe("teochewLookup", () => {
  it("returns a DictResponse tagged as Teochew", () => {
    const res = teochewLookup("汝好");
    expect(res.lang).toBe("teo");
    expect(res.entries.length).toBeGreaterThan(0);
    expect(res.entries[0]!.source).toBe("teochew-local");
  });
});
