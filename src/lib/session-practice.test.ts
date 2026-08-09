import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvGet } from "./browser-kv";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import {
  buildPracticeKickoffMessage,
  clearPracticeOffer,
  createPracticeOffer,
  deferPracticeOffer,
  loadPracticeOffer,
  pickPracticeTargets,
  practiceOfferStorageKey,
  savePracticeOffer,
} from "./session-practice";

function memWithSkills(): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.35,
        mastery: 35,
        attempts: 6,
        correct: 2,
        incorrect: 4,
        confidence: 1,
        lastSeen: now,
        sm2State: { ef: 2.2, interval: 3, reps: 2, prevReview: now - 10 * 86_400_000 },
        eloState: { rating: 1200, n: 6, lastUpdate: now },
      },
      {
        id: "place-value",
        label: "Place value",
        topicId: "place-value",
        pKnown: 0.4,
        mastery: 40,
        attempts: 4,
        correct: 1,
        incorrect: 3,
        lastSeen: now,
        sm2State: { ef: 2.5, interval: 2, reps: 1, prevReview: now - 5 * 86_400_000 },
        eloState: { rating: 1250, n: 4, lastUpdate: now },
      },
      {
        id: "multiplication-facts",
        label: "Multiplication facts",
        topicId: "multiplication",
        pKnown: 0.55,
        mastery: 55,
        attempts: 3,
        correct: 2,
        incorrect: 1,
        lastSeen: now,
        sm2State: { ef: 2.5, interval: 7, reps: 2, prevReview: now },
        eloState: { rating: 1400, n: 3, lastUpdate: now },
      },
    ],
    updatedAt: now,
  });
}

afterEach(() => {
  clearPracticeOffer("acct_a");
  clearPracticeOffer("acct_b");
  kvClearMemory();
});

describe("session-practice (CA-2)", () => {
  it("SP1: weak skills → up to 3 targets", () => {
    const targets = pickPracticeTargets(memWithSkills(), 3);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.length).toBeLessThanOrEqual(3);
    expect(targets.some((t) => t.label.includes("Fraction"))).toBe(true);
  });

  it("SP2: empty memory → no offer", () => {
    expect(pickPracticeTargets(null)).toEqual([]);
    expect(createPracticeOffer("acct_a", null)).toBeNull();
  });

  it("SP3: persist + load round-trip", () => {
    const offer = createPracticeOffer("acct_a", memWithSkills())!;
    savePracticeOffer(offer);
    const loaded = loadPracticeOffer("acct_a");
    expect(loaded?.targets).toEqual(offer.targets);
    expect(kvGet(practiceOfferStorageKey("acct_a"))).toBeTruthy();
  });

  it("SP4: clear removes storage", () => {
    const offer = createPracticeOffer("acct_a", memWithSkills())!;
    savePracticeOffer(offer);
    clearPracticeOffer("acct_a");
    expect(loadPracticeOffer("acct_a")).toBeNull();
  });

  it("SP5: Tomorrow sets deferredUntil next local day", () => {
    const offer = createPracticeOffer("acct_a", memWithSkills())!;
    const from = new Date("2026-08-09T12:00:00");
    const deferred = deferPracticeOffer(offer, from);
    expect(deferred.deferredUntil).toBe("2026-08-10");
  });

  it("SP6: deferred offer not shown before date", () => {
    const offer = deferPracticeOffer(
      createPracticeOffer("acct_a", memWithSkills())!,
      new Date("2026-08-09T12:00:00"),
    );
    savePracticeOffer(offer);
    expect(loadPracticeOffer("acct_a", new Date("2026-08-09T18:00:00"))).toBeNull();
    expect(loadPracticeOffer("acct_a", new Date("2026-08-10T08:00:00"))).not.toBeNull();
  });

  it("SP7: kickoff message includes labels + Socratic instruction", () => {
    const msg = buildPracticeKickoffMessage([
      { skillId: "a", label: "Fractions" },
      { skillId: "b", label: "Place value" },
    ]);
    expect(msg).toContain("Fractions");
    expect(msg).toContain("Place value");
    expect(msg.toLowerCase()).toMatch(/socratic|no spoilers/);
  });
});
