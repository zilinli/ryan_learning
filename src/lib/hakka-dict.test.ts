/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  HAKKA_DICT,
  hakkaLookup,
  lookupHakka,
  searchHakka,
} from "./hakka-dict";

describe("Hakka dictionary dataset", () => {
  it("contains at least 500 entries", () => {
    expect(HAKKA_DICT.length).toBeGreaterThanOrEqual(500);
  });

  it("all entries have required fields", () => {
    for (const e of HAKKA_DICT) {
      expect(e.traditional).toBeTruthy();
      expect(e.simplified).toBeTruthy();
      expect(e.roman).toBeTruthy();
      expect(e.gloss).toBeTruthy();
    }
  });

  it("grades every entry with source + confidence", () => {
    const validSources = ["moe-standard", "community-verified", "llm-suggested"];
    for (const e of HAKKA_DICT) {
      expect(validSources).toContain(e.source);
      expect(typeof e.confidence).toBe("number");
      expect(e.confidence).toBeGreaterThan(0);
      expect(e.confidence).toBeLessThanOrEqual(1);
    }
    // Taiwan MOE recommended characters should be tagged moe-standard
    expect(HAKKA_DICT.find((e) => e.traditional === "仰般")?.source).toBe(
      "moe-standard",
    );
  });

  it("contains no duplicate (traditional, roman) keys", () => {
    const seen = new Set<string>();
    for (const e of HAKKA_DICT) {
      const key = `${e.traditional}:${e.roman}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("covers the core grammar particles from the design doc", () => {
    const trad = new Set(HAKKA_DICT.map((e) => e.traditional));
    expect(trad.has("涯")).toBe(true); // I
    expect(trad.has("个")).toBe(true); // possessive (的)
    expect(trad.has("毋")).toBe(true); // not
    expect(trad.has("莫")).toBe(true); // don't
    expect(trad.has("食")).toBe(true); // eat/drink
    expect(trad.has("麼个")).toBe(true); // what
  });
});

describe("lookupHakka", () => {
  it("finds by traditional character", () => {
    const res = lookupHakka("涯");
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res[0]!.gloss).toMatch(/I|me/i);
  });

  it("finds 个 as possessive particle", () => {
    const res = lookupHakka("个");
    expect(res.some((e) => e.gloss.toLowerCase().includes("possessive"))).toBe(
      true,
    );
  });

  it("finds by romanization", () => {
    const res = lookupHakka("ngaiˇ");
    expect(res.some((e) => e.traditional === "涯")).toBe(true);
  });

  it("finds by partial romanization via search", () => {
    const res = searchHakka("ngai");
    expect(res.some((e) => e.traditional === "涯")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(lookupHakka("NGAI").length).toBeGreaterThan(0);
  });

  it("returns empty for non-matching query", () => {
    expect(lookupHakka("zzzz")).toEqual([]);
    expect(lookupHakka("")).toEqual([]);
  });
});

describe("searchHakka", () => {
  it("finds by English gloss", () => {
    const res = searchHakka("water");
    expect(res.some((e) => e.gloss.toLowerCase().includes("water"))).toBe(true);
  });

  it("finds 食饭 phrase by character", () => {
    const res = searchHakka("食饭");
    expect(res.some((e) => e.traditional === "食飯")).toBe(true);
  });

  it("returns empty for nonsense input", () => {
    expect(searchHakka("xyzzzznonexist")).toEqual([]);
  });
});

describe("hakkaLookup", () => {
  it("returns a DictResponse tagged as Hakka", () => {
    const res = hakkaLookup("你好");
    expect(res.lang).toBe("hak");
    expect(res.entries.length).toBeGreaterThan(0);
    expect(res.entries[0]!.source).toBe("hakka-local");
  });
});
