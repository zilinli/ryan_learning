import { describe, expect, it } from "vitest";
import {
  listSpanishLemmas,
  lookupSpanish,
  searchSpanish,
  SPANISH_DICT,
} from "./spanish-dict";

describe("lookupSpanish — the", () => {
  it("returns the definite-article paradigm for 'the'", () => {
    const entry = lookupSpanish("the");
    expect(entry).not.toBeNull();
    expect(entry!.en).toBe("the");
    const forms = entry!.senses.map((s) => s.es);
    expect(forms).toEqual(
      expect.arrayContaining(["el", "la", "los", "las", "lo", "al", "del"]),
    );
  });

  it("is case-insensitive", () => {
    expect(lookupSpanish("THE")?.en).toBe("the");
    expect(lookupSpanish(" The ")?.en).toBe("the");
  });

  it("includes masculine/feminine and singular/plural senses", () => {
    const entry = lookupSpanish("the")!;
    const el = entry.senses.find((s) => s.es === "el");
    const la = entry.senses.find((s) => s.es === "la");
    const los = entry.senses.find((s) => s.es === "los");
    const las = entry.senses.find((s) => s.es === "las");
    expect(el?.gender).toBe("m");
    expect(el?.number).toBe("sg");
    expect(la?.gender).toBe("f");
    expect(la?.number).toBe("sg");
    expect(los?.number).toBe("pl");
    expect(las?.number).toBe("pl");
  });

  it("documents a+el and de+el contractions", () => {
    const entry = lookupSpanish("the")!;
    const al = entry.senses.find((s) => s.es === "al");
    const del = entry.senses.find((s) => s.es === "del");
    expect(al?.gloss).toMatch(/a \+ el/i);
    expect(del?.gloss).toMatch(/de \+ el/i);
  });
});

describe("lookupSpanish — other seeds", () => {
  it("resolves aliases (an → a, hi → hello, thanks → thank you)", () => {
    expect(lookupSpanish("an")?.en).toBe("a");
    expect(lookupSpanish("hi")?.en).toBe("hello");
    expect(lookupSpanish("thanks")?.en).toBe("thank you");
  });

  it("returns null for unknown words", () => {
    expect(lookupSpanish("xyzzy")).toBeNull();
    expect(lookupSpanish("")).toBeNull();
  });
});

describe("searchSpanish", () => {
  it("returns seed list when query is empty", () => {
    const results = searchSpanish("");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.en).toBe(SPANISH_DICT[0]!.en);
  });

  it("finds 'the' by exact match", () => {
    expect(searchSpanish("the")).toHaveLength(1);
    expect(searchSpanish("the")[0]!.en).toBe("the");
  });

  it("finds entries by Spanish headword prefix", () => {
    const results = searchSpanish("graci");
    expect(results.some((e) => e.en === "thank you")).toBe(true);
  });

  it("finds by English prefix", () => {
    const results = searchSpanish("hel");
    expect(results.some((e) => e.en === "hello")).toBe(true);
  });
});

describe("listSpanishLemmas", () => {
  it("includes the", () => {
    expect(listSpanishLemmas()).toContain("the");
  });
});
