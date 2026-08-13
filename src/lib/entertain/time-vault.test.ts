import { describe, expect, it } from "vitest";
import {
  FALLBACK_CASES,
  pickFallbackCase,
  validateTimeVault,
  splitPassageSentences,
  difficultyFromPKnown,
  caseSpecForDifficulty,
  timeVaultSystemPrompt,
  parseTimeVaultJson,
  vaultSkillSeed,
  type TimeVaultCase,
} from "./time-vault";

const NILE = FALLBACK_CASES[0]!;

describe("time-vault", () => {
  it("fallback bank cases are internally consistent", () => {
    for (const c of FALLBACK_CASES) {
      const ids = new Set(c.events.map((e) => e.id));
      expect(c.correctOrder).toHaveLength(c.events.length);
      expect(new Set(c.correctOrder).size).toBe(c.events.length);
      for (const id of c.correctOrder) {
        expect(ids.has(id)).toBe(true);
      }
      const sentences = splitPassageSentences(c.passage);
      for (const idx of Object.values(c.evidenceMap)) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(sentences.length);
      }
    }
  });

  it("validates a correct order + evidence", () => {
    const r = validateTimeVault(NILE, {
      order: NILE.correctOrder,
      evidence: NILE.evidenceMap,
    });
    expect(r.correct).toBe(true);
    expect(r.orderCorrect).toBe(true);
    expect(r.evidenceCorrect).toBe(true);
  });

  it("detects misplaced order", () => {
    const r = validateTimeVault(NILE, {
      order: ["d", "c", "a", "b"],
      evidence: NILE.evidenceMap,
    });
    expect(r.orderCorrect).toBe(false);
    expect(r.misplaced).toContain("a");
    expect(r.misplaced).toContain("b");
  });

  it("detects missing evidence", () => {
    const r = validateTimeVault(NILE, {
      order: NILE.correctOrder,
      evidence: { d: 1, c: 2 },
    });
    expect(r.evidenceCorrect).toBe(false);
    expect(r.badEvidence).toContain("b");
    expect(r.badEvidence).toContain("a");
  });

  it("difficultyFromPKnown maps bands", () => {
    expect(difficultyFromPKnown(0.2)).toBe(1);
    expect(difficultyFromPKnown(0.49)).toBe(2);
    expect(difficultyFromPKnown(0.5)).toBe(3);
    expect(difficultyFromPKnown(0.69)).toBe(3);
    expect(difficultyFromPKnown(0.7)).toBe(4);
    expect(difficultyFromPKnown(0.84)).toBe(4);
    expect(difficultyFromPKnown(0.85)).toBe(5);
  });

  it("caseSpecForDifficulty scales with tier", () => {
    const low = caseSpecForDifficulty(1);
    const high = caseSpecForDifficulty(5);
    expect(low.eventCount).toBeLessThan(high.eventCount);
    expect(low.passageLength).toBeLessThan(high.passageLength);
    expect(low.explicitEvidence).toBe(true);
    expect(high.crossCivilization).toBe(true);
  });

  it("system prompt contains event count and JSON contract", () => {
    const prompt = timeVaultSystemPrompt(caseSpecForDifficulty(2));
    expect(prompt).toContain("EXACTLY 4 events");
    expect(prompt).toContain("evidenceMap");
  });

  it("parses a valid AI JSON payload", () => {
    const raw = JSON.stringify({
      title: "Railways of Britain",
      civilization: "Industrial Revolution",
      intro: "Steam changed how Britain moved.",
      passage: "The first public railway opened in 1825. Steam locomotives linked cities by the 1840s. The railway boom peaked around 1900.",
      events: [
        { id: "a", label: "First public railway", year: 1825 },
        { id: "b", label: "Locomotives link cities", year: 1845 },
        { id: "c", label: "Railway boom peaks", year: 1900 },
      ],
      correctOrder: ["a", "b", "c"],
      evidenceMap: { a: 0, b: 1, c: 2 },
    });
    const parsed = parseTimeVaultJson(raw, NILE);
    expect(parsed).not.toBeNull();
    expect(parsed!.events).toHaveLength(3);
    expect(parsed!.correctOrder).toEqual(["a", "b", "c"]);
    expect(parsed!.evidenceMap.a).toBe(0);
  });

  it("rejects invalid JSON payloads", () => {
    expect(parseTimeVaultJson("", NILE)).toBeNull();
    expect(parseTimeVaultJson("not json", NILE)).toBeNull();
    expect(parseTimeVaultJson('{"passage":"x"}', NILE)).toBeNull();
  });

  it("vaultSkillSeed includes civilization and reading context", () => {
    const seed = vaultSkillSeed(NILE);
    expect(seed).toContain("Egypt");
    expect(seed).toContain("evidence");
  });

  it("pickFallbackCase returns a case from the bank", () => {
    const c = pickFallbackCase();
    expect(c).toBeDefined();
    expect(c.events.length).toBeGreaterThanOrEqual(3);
  });
});
