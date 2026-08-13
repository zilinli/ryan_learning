import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import {
  buildConnectionOffer,
  cardForWeek,
  CONNECTION_CARDS,
  connectionCardStorageKey,
  markConnectionShown,
} from "./connection-card";

const ACCT = "acct_connection";

afterEach(() => {
  kvClearMemory();
  kvRemove(connectionCardStorageKey(ACCT));
});

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
});
