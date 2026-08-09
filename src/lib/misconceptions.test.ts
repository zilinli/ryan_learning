import { describe, expect, it } from "vitest";
import { SKILL_CATALOG } from "./skill-catalog";
import {
  MISCONCEPTION_SEED,
  misconceptionIds,
  parseMisconceptionFence,
  stripMisconceptionFence,
} from "./misconceptions";

describe("misconceptions (CA-6)", () => {
  it("MC1: seed ids unique", () => {
    const ids = misconceptionIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(20);
  });

  it("MC2: skillIds map into catalog (or known early ids)", () => {
    const catalog = new Set(SKILL_CATALOG.map((s) => s.id));
    for (const tag of MISCONCEPTION_SEED) {
      expect(tag.skillIds.length).toBeGreaterThan(0);
      for (const sid of tag.skillIds) {
        expect(catalog.has(sid)).toBe(true);
      }
    }
  });

  it("MC3: parse + strip fence", () => {
    const text = `Hmm.\n~~~misconception\n{"id":"frac-add-denom"}\n~~~\nTry again?`;
    const hit = parseMisconceptionFence(text, 1000);
    expect(hit?.id).toBe("frac-add-denom");
    const stripped = stripMisconceptionFence(text);
    expect(stripped).toContain("Hmm");
    expect(stripped).toContain("Try again");
    expect(stripped).not.toContain("misconception");
  });
});
