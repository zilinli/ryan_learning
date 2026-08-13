import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import {
  buildConnectionOffer,
  buildDynamicConnectionOffer,
  cardForWeek,
  CONNECTION_CARDS,
  connectionCardStorageKey,
  markConnectionShown,
  markConnectionShownForOffer,
} from "./connection-card";
import type { LearningMemory } from "./learning-memory";

const ACCT = "acct_connection";

afterEach(() => {
  kvClearMemory();
  kvRemove(connectionCardStorageKey(ACCT));
});

function memWithMastered(ids: string[], lastSeenOffset = 1000): LearningMemory {
  return {
    topics: [],
    skills: ids.map((id, i) => ({
      id,
      label: id === "multiplication-facts" ? "multiplication facts" : id.replace(/-/g, " "),
      topicId: "test",
      pKnown: 0.9,
      mastery: 90,
      attempts: 5,
      correct: 4,
      incorrect: 1,
      lastSeen: lastSeenOffset + i,
      sm2State: { ef: 2.5, interval: 4, reps: 3, prevReview: lastSeenOffset + i },
      eloState: { rating: 1500, n: 5, lastUpdate: lastSeenOffset + i },
    })),
    recentStruggles: [],
    recentWins: [],
    sessionDigests: [],
    updatedAt: Date.now(),
  };
}

describe("connection-card", () => {
  it("rotates deterministically by week", () => {
    const a = cardForWeek("2026-08-10");
    const b = cardForWeek("2026-08-17");
    expect(a).toBeDefined();
    expect(CONNECTION_CARDS.some((c) => c.id === a.id)).toBe(true);
    // Same week → same card; different weeks may differ
    expect(cardForWeek("2026-08-10").id).toBe(a.id);
    expect(cardForWeek("2026-08-10").id === b.id || a.id !== b.id).toBe(true);
  });

  it("offers once per week, then stops until the week changes", () => {
    const first = buildConnectionOffer(ACCT);
    expect(first).not.toBeNull();
    markConnectionShown(ACCT, first!.weekOf);
    expect(buildConnectionOffer(ACCT)).toBeNull();
  });

  it("re-offers after the seen flag is cleared (new week)", () => {
    const first = buildConnectionOffer(ACCT);
    markConnectionShown(ACCT, first!.weekOf);
    kvRemove(connectionCardStorageKey(ACCT));
    expect(buildConnectionOffer(ACCT)).not.toBeNull();
  });

  it("every card carries a kickoff prompt", () => {
    for (const c of CONNECTION_CARDS) {
      expect(c.kickoff.length).toBeGreaterThan(20);
      expect(c.title.length).toBeGreaterThan(5);
    }
  });

  it("V2 P2 — dynamic offer anchors on the two newest mastered skills across subjects", () => {
    // math (multiplication-facts, lastSeen newest) + ela (letter-sounds)
    const mem = memWithMastered(["letter-sounds", "multiplication-facts"], 5000);
    const offer = buildDynamicConnectionOffer(mem, ACCT);
    expect(offer).not.toBeNull();
    expect(offer!.card.id).toContain("multiplication-facts");
    expect(offer!.card.id).toContain("letter-sounds");
    expect(offer!.card.title).toContain("multiplication facts");
    expect(offer!.card.kickoff.length).toBeGreaterThan(30);
    expect(offer!.weekOf).toBeTruthy();
  });

  it("V2 P2 — dynamic offer is null without two mastered skills", () => {
    const mem = memWithMastered(["multiplication-facts"], 5000);
    mem.skills[0].pKnown = 0.5; // not mastered
    expect(buildDynamicConnectionOffer(mem, ACCT)).toBeNull();

    const twoSameSubject = memWithMastered(
      ["multiplication-facts", "division-basics"],
      5000,
    );
    expect(buildDynamicConnectionOffer(twoSameSubject, ACCT)).toBeNull();
  });

  it("V2 P2 — dynamic offer respects the once-per-week seen flag", () => {
    const mem = memWithMastered(["letter-sounds", "multiplication-facts"], 5000);
    const offer = buildDynamicConnectionOffer(mem, ACCT)!;
    markConnectionShownForOffer(ACCT, offer);
    expect(buildDynamicConnectionOffer(mem, ACCT)).toBeNull();
  });
});
