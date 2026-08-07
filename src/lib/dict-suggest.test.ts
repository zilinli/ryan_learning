/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  levenshtein,
  maxEditDistance,
  pickAutoCorrect,
  stripAccents,
  suggestFromCandidates,
} from "./dict-suggest";
import { localSeedLookup, listSeedWords } from "./local-seeds";

describe("dict-suggest", () => {
  it("levenshtein distance for common typos", () => {
    expect(levenshtein("spainish", "spanish")).toBe(1);
    expect(levenshtein("beautifull", "beautiful")).toBe(1);
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  it("stripAccents normalizes French/Spanish", () => {
    expect(stripAccents("château")).toBe("chateau");
    expect(stripAccents("español")).toBe("espanol");
    expect(stripAccents("école")).toBe("ecole");
  });

  it("suggestFromCandidates ranks spanish above distant words", () => {
    const hits = suggestFromCandidates("spainish", [
      "swainish",
      "spanish",
      "sparkish",
      "hello",
    ]);
    expect(hits[0]).toBe("spanish");
  });

  it("pickAutoCorrect accepts distance-1 typos", () => {
    expect(pickAutoCorrect("spainish", ["spanish", "swainish"])).toBe("spanish");
    expect(pickAutoCorrect("xyzabc", ["hello", "water"])).toBeNull();
  });

  it("maxEditDistance scales with length", () => {
    expect(maxEditDistance("hi")).toBe(1);
    expect(maxEditDistance("spainish")).toBe(3);
  });
});

describe("local seeds EN/ES/FR", () => {
  it("resolves English typo aliases via seed index", () => {
    const r = localSeedLookup("spainish", "en");
    expect(r).not.toBeNull();
    expect(r!.entries[0]!.headword.toLowerCase()).toBe("spanish");
  });

  it("resolves Spanish without accents", () => {
    expect(localSeedLookup("espanol", "es")).not.toBeNull();
    expect(localSeedLookup("adios", "es")).not.toBeNull();
  });

  it("resolves French livre and accentless chateau", () => {
    expect(localSeedLookup("livre", "fr")).not.toBeNull();
    expect(localSeedLookup("amour", "fr")).not.toBeNull();
    expect(localSeedLookup("chateau", "fr")).not.toBeNull();
    expect(localSeedLookup("château", "fr")).not.toBeNull();
  });

  it("lists seed words for fuzzy ranking", () => {
    expect(listSeedWords("en").length).toBeGreaterThan(40);
    expect(listSeedWords("es").length).toBeGreaterThan(40);
    expect(listSeedWords("fr").length).toBeGreaterThan(40);
  });
});
