import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import {
  buildSessionOpener,
  localDateKey,
  markOpenerShown,
  openerDateStorageKey,
  wasOpenerShownToday,
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
});
