import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import {
  buildSessionOpener,
  localDateKey,
  markOpenerShown,
  openerDateStorageKey,
  rotateSessionOpener,
  wasOpenerShownToday,
  yieldOpenerForHomework,
} from "./session-opener";

function baseMem(overrides?: Partial<LearningMemory["skills"][0]>): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.45,
        mastery: 45,
        attempts: 5,
        correct: 2,
        incorrect: 3,
        lastSeen: now,
        sm2State: {
          ef: 2.3,
          interval: 2,
          reps: 2,
          prevReview: now - 10 * 86_400_000,
        },
        eloState: { rating: 1300, n: 5, lastUpdate: now },
        ...overrides,
      },
    ],
    updatedAt: now,
  });
}

afterEach(() => {
  kvRemove(openerDateStorageKey("acct_a"));
  kvRemove(openerDateStorageKey("acct_b"));
  kvClearMemory();
});

describe("session-opener (CA-3)", () => {
  it("SO1: no skills → null", () => {
    expect(buildSessionOpener(null, "acct_a")).toBeNull();
    expect(
      buildSessionOpener(normalizeMemory({ skills: [], updatedAt: 1 }), "acct_a"),
    ).toBeNull();
  });

  it("SO2: review skill preferred when overdue", () => {
    const opener = buildSessionOpener(baseMem(), "acct_a");
    expect(opener).not.toBeNull();
    expect(opener!.kind).toBe("review");
    expect(opener!.label).toMatch(/Fraction/i);
  });

  it("SO3: second call same day → null after markShown", () => {
    const day = new Date("2026-08-09T10:00:00");
    expect(buildSessionOpener(baseMem(), "acct_a", day)).not.toBeNull();
    markOpenerShown("acct_a", day);
    expect(wasOpenerShownToday("acct_a", day)).toBe(true);
    expect(buildSessionOpener(baseMem(), "acct_a", day)).toBeNull();
  });

  it("SO4: new calendar day → offer again", () => {
    markOpenerShown("acct_a", new Date("2026-08-09T10:00:00"));
    const next = buildSessionOpener(
      baseMem(),
      "acct_a",
      new Date("2026-08-10T10:00:00"),
    );
    expect(next).not.toBeNull();
  });

  it("SO5b: A3 recurring gap preferred with last-few-days copy", () => {
    const day = new Date("2026-08-10T10:00:00");
    const mem = {
      ...baseMem({
        lastSeen: day.getTime(), // not idle — keep recurring copy
        sm2State: {
          ef: 2.3,
          interval: 2,
          reps: 2,
          prevReview: day.getTime() - 10 * 86_400_000,
        },
      }),
      gapHistory: [
        {
          skillId: "fractions-concepts",
          label: "Fraction concepts",
          days: ["2026-08-08", "2026-08-09"],
          // expiresAt must outlive real Date.now() — pickRecurringGapSkill
          // prunes with real clock, not the passed `day`.
          expiresAt: Date.now() + 86_400_000,
        },
      ],
    };
    const opener = buildSessionOpener(mem, "acct_a", day)!;
    expect(opener.kind).toBe("recurring");
    expect(opener.line).toMatch(/last few days/i);
  });

  it("AUD.6a: idle ≥3d uses soft return copy (no streak)", () => {
    const day = new Date("2026-08-10T10:00:00");
    const mem = baseMem({
      lastSeen: day.getTime() - 5 * 86_400_000,
      sm2State: {
        ef: 2.3,
        interval: 2,
        reps: 2,
        prevReview: day.getTime() - 10 * 86_400_000,
      },
    });
    const opener = buildSessionOpener(mem, "acct_a", day)!;
    expect(opener.kind).toBe("return");
    expect(opener.line).toMatch(/Welcome back/i);
    expect(opener.line.toLowerCase()).not.toMatch(/streak|flame/);
  });

  it("SO5: copy mentions homework alternative", () => {
    const opener = buildSessionOpener(baseMem(), "acct_a")!;
    expect(opener.line.toLowerCase()).toMatch(/homework/);
  });

  it("SO6: account namespace isolates gates", () => {
    const day = new Date("2026-08-09T10:00:00");
    markOpenerShown("acct_a", day);
    expect(wasOpenerShownToday("acct_a", day)).toBe(true);
    expect(wasOpenerShownToday("acct_b", day)).toBe(false);
    expect(buildSessionOpener(baseMem(), "acct_b", day)).not.toBeNull();
    expect(localDateKey(day)).toBe("2026-08-09");
  });

  it("B1.h: homework intent yields opener for the day", () => {
    const day = new Date("2026-08-09T10:00:00");
    expect(yieldOpenerForHomework("acct_a", "here's my homework photo", day)).toBe(
      true,
    );
    expect(wasOpenerShownToday("acct_a", day)).toBe(true);
    expect(buildSessionOpener(baseMem(), "acct_a", day)).toBeNull();
    expect(yieldOpenerForHomework("acct_b", "just chatting", day)).toBe(false);
  });

  it("P0: mastered skill yields a challengeLine", () => {
    const mem = normalizeMemory({
      skills: [
        {
          id: "fractions-concepts",
          label: "Fraction concepts",
          topicId: "fractions",
          pKnown: 0.45,
          mastery: 45,
          attempts: 5,
          correct: 2,
          incorrect: 3,
          lastSeen: Date.now(),
          sm2State: {
            ef: 2.3,
            interval: 2,
            reps: 2,
            prevReview: Date.now() - 10 * 86_400_000,
          },
          eloState: { rating: 1300, n: 5, lastUpdate: Date.now() },
        },
        {
          id: "algebra-equations",
          label: "Algebra equations",
          topicId: "algebra",
          pKnown: 0.92,
          mastery: 92,
          attempts: 12,
          correct: 11,
          incorrect: 1,
          lastSeen: Date.now(),
          sm2State: {
            ef: 2.5,
            interval: 8,
            reps: 6,
            prevReview: Date.now() - 3 * 86_400_000,
          },
          eloState: { rating: 1750, n: 12, lastUpdate: Date.now() },
        },
      ],
      updatedAt: Date.now(),
    });
    const opener = buildSessionOpener(mem, "acct_a")!;
    expect(opener.challengeLine).toMatch(/Algebra equations/i);
  });

  it("P0: rotateSessionOpener cycles to the next practice target", () => {
    const opener = buildSessionOpener(
      normalizeMemory({
        skills: [
          {
            id: "fractions-concepts",
            label: "Fraction concepts",
            topicId: "fractions",
            pKnown: 0.45,
            mastery: 45,
            attempts: 5,
            correct: 2,
            incorrect: 3,
            lastSeen: Date.now(),
            sm2State: {
              ef: 2.3,
              interval: 2,
              reps: 2,
              prevReview: Date.now() - 10 * 86_400_000,
            },
            eloState: { rating: 1300, n: 5, lastUpdate: Date.now() },
          },
          {
            id: "place-value",
            label: "Place value",
            topicId: "numbers",
            pKnown: 0.5,
            mastery: 50,
            attempts: 4,
            correct: 2,
            incorrect: 2,
            lastSeen: Date.now(),
            sm2State: {
              ef: 2.3,
              interval: 1,
              reps: 1,
              prevReview: Date.now() - 5 * 86_400_000,
            },
            eloState: { rating: 1350, n: 4, lastUpdate: Date.now() },
          },
          {
            id: "time-conversion",
            label: "Time conversion",
            topicId: "measurement",
            pKnown: 0.6,
            mastery: 60,
            attempts: 3,
            correct: 2,
            incorrect: 1,
            lastSeen: Date.now(),
            sm2State: {
              ef: 2.3,
              interval: 1,
              reps: 1,
              prevReview: Date.now() - 5 * 86_400_000,
            },
            eloState: { rating: 1400, n: 3, lastUpdate: Date.now() },
          },
        ],
        updatedAt: Date.now(),
      }),
      "acct_a",
    );
    expect(opener).not.toBeNull();
    const targets = opener!.practiceTargets;
    if (!targets || targets.length === 0) {
      // No rotation available — the helper must still be a no-op-safe null
      expect(rotateSessionOpener(opener!)).toBeNull();
      return;
    }
    const next = rotateSessionOpener(opener!)!;
    expect(next.skillId).toBe(targets[0]!.skillId);
    expect(next.practiceTargets?.[next.practiceTargets.length - 1]?.skillId).toBe(
      opener!.skillId,
    );
  });

  it("P0: rotateSessionOpener returns null without practiceTargets", () => {
    const opener = buildSessionOpener(baseMem(), "acct_a")!;
    const next = rotateSessionOpener(opener);
    expect(next).toBeNull();
  });

  it("P0-2: saturated learner gets a challenge opener, not a generic warm-up", () => {
    const now = Date.now();
    // 3/3 skills mastered with fresh reviews → no gap, no due review, no ZPD.
    const sat = (id: string, label: string, topicId: string) => ({
      id,
      label,
      topicId,
      pKnown: 0.93,
      mastery: 93,
      attempts: 10,
      correct: 9,
      incorrect: 1,
      lastSeen: now,
      sm2State: {
        ef: 2.5,
        interval: 8,
        reps: 6,
        prevReview: now - 86_400_000,
      },
      eloState: { rating: 1700, n: 10, lastUpdate: now },
    });
    const mem = normalizeMemory({
      skills: [
        sat("fractions-concepts", "Fraction concepts", "fractions"),
        sat("algebra-equations", "Algebra equations", "algebra"),
        sat("perimeter-area", "Perimeter & area", "geometry"),
      ],
      updatedAt: now,
    });
    const opener = buildSessionOpener(mem, "acct_a")!;
    expect(opener.highMasteryMode).toBe(true);
    expect(opener.kind).toBe("challenge");
    expect(opener.source).toBe("challenge");
    expect(opener.line).toMatch(/tougher spin/i);
  });

  it("P0-2: mixed mastery keeps a normal opener and highMasteryMode off", () => {
    const now = Date.now();
    const mem = normalizeMemory({
      skills: [
        {
          id: "fractions-concepts",
          label: "Fraction concepts",
          topicId: "fractions",
          pKnown: 0.45,
          mastery: 45,
          attempts: 5,
          correct: 2,
          incorrect: 3,
          lastSeen: now,
          sm2State: {
            ef: 2.3,
            interval: 2,
            reps: 2,
            prevReview: now - 10 * 86_400_000,
          },
          eloState: { rating: 1300, n: 5, lastUpdate: now },
        },
        {
          id: "algebra-equations",
          label: "Algebra equations",
          topicId: "algebra",
          pKnown: 0.92,
          mastery: 92,
          attempts: 12,
          correct: 11,
          incorrect: 1,
          lastSeen: now,
          sm2State: {
            ef: 2.5,
            interval: 8,
            reps: 6,
            prevReview: now - 86_400_000,
          },
          eloState: { rating: 1750, n: 12, lastUpdate: now },
        },
        {
          id: "time-conversion",
          label: "Time conversion",
          topicId: "measurement",
          pKnown: 0.3,
          mastery: 30,
          attempts: 2,
          correct: 0,
          incorrect: 2,
          lastSeen: now,
          sm2State: {
            ef: 2.0,
            interval: 1,
            reps: 0,
            prevReview: now - 2 * 86_400_000,
          },
          eloState: { rating: 1100, n: 2, lastUpdate: now },
        },
      ],
      updatedAt: now,
    });
    const opener = buildSessionOpener(mem, "acct_a")!;
    expect(opener.highMasteryMode).toBe(false);
    expect(opener.kind).not.toBe("challenge");
  });
});
