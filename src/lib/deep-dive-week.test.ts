import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import {
  buildDeepDiveKickoff,
  buildDeepDiveOfferForAccount,
  deepDiveStorageKey,
  deepDiveWeekKey,
  loadDeepDiveStatus,
  markDeepDiveDone,
  pickDeepDiveAnchor,
} from "./deep-dive-week";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import { wrongAnswerStorageKey } from "./wrong-answer-store";

const ACCT = "acct_deepdive";

function mem(overrides: Partial<LearningMemory> = {}): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "algebra-equations",
        label: "Algebra equations",
        topicId: "algebra",
        pKnown: 0.92,
        mastery: 92,
        attempts: 10,
        correct: 9,
        incorrect: 1,
        lastSeen: now,
        sm2State: { ef: 2.5, interval: 8, reps: 5, prevReview: now - 2 * 86_400_000 },
        eloState: { rating: 1750, n: 10, lastUpdate: now },
      },
    ],
    updatedAt: now,
    ...overrides,
  });
}

afterEach(() => {
  kvClearMemory();
  const keys = [deepDiveStorageKey(ACCT), wrongAnswerStorageKey(ACCT)];
  for (const k of keys) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(k);
  }
});

describe("deep-dive-week", () => {
  it("prefers a recent wrong answer as the anchor", () => {
    const anchor = pickDeepDiveAnchor(mem(), [
      { skillLabel: "Fractions" } as never,
    ]);
    expect(anchor.label).toBe("Fractions");
    expect(anchor.source).toBe("wrongbook");
  });

  it("falls back to a mastered skill anchor", () => {
    const anchor = pickDeepDiveAnchor(mem(), []);
    expect(anchor.source).toBe("mastered");
    expect(anchor.label).toBe("Algebra equations");
  });

  it("builds a weekly offer and marks it done once started", () => {
    const offer = buildDeepDiveOfferForAccount(ACCT, mem());
    expect(offer).not.toBeNull();
    expect(offer!.weekOf).toBe(deepDiveWeekKey());
    expect(offer!.kickoff).toMatch(/ENGAGE/);
    expect(loadDeepDiveStatus(ACCT).done).toBe(false);

    markDeepDiveDone(ACCT);
    expect(loadDeepDiveStatus(ACCT).done).toBe(true);
    expect(buildDeepDiveOfferForAccount(ACCT, mem())).toBeNull();
  });

  it("5E kickoff ends with a product and a growth frame", () => {
    const msg = buildDeepDiveKickoff("fractions", "zpd");
    expect(msg).toMatch(/EXPLORE/);
    expect(msg).toMatch(/EXPLAIN/);
    expect(msg).toMatch(/ELABORATE/);
    expect(msg).toMatch(/EVALUATE/);
    expect(msg).toMatch(/poster|diagram|summary/);
  });

  it("marking done is scoped to the week", () => {
    markDeepDiveDone(ACCT);
    // A different week (Monday of an old week) should not be flagged done
    const oldMonday = new Date("2020-01-06T00:00:00Z").getTime();
    expect(deepDiveWeekKey(oldMonday)).not.toBe(deepDiveWeekKey());
    expect(loadDeepDiveStatus(ACCT, oldMonday).done).toBe(false);
  });
});
