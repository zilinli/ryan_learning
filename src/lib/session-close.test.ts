import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import { normalizeMemory } from "./learning-memory";
import { clearPracticeOffer, loadPracticeOffer } from "./session-practice";
import {
  maybeCloseSession,
  recoverMissedSessionCloses,
} from "./session-close";
import type { ConversationRecord } from "./types";

function weakMem() {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.3,
        mastery: 30,
        attempts: 6,
        correct: 2,
        incorrect: 4,
        lastSeen: now,
        sm2State: { ef: 2.2, interval: 1, reps: 1, prevReview: now },
        eloState: { rating: 1200, n: 6, lastUpdate: now },
      },
    ],
    updatedAt: now,
  });
}

function convo(
  id: string,
  msgCount: number,
  extra?: Partial<ConversationRecord>,
): ConversationRecord {
  const now = Date.now();
  return {
    sessionId: id,
    title: "Chat",
    messages: Array.from({ length: msgCount }, (_, i) => ({
      id: `${id}-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
      createdAt: now,
    })),
    createdAt: now - 60_000,
    updatedAt: now - 60_000,
    ...extra,
  };
}

afterEach(() => {
  clearPracticeOffer("acct_close");
  kvClearMemory();
});

describe("session-close (A2.h)", () => {
  it("SP8: ≥4 messages triggers offer and stamps emittedAt", () => {
    const c = convo("s1", 4);
    const result = maybeCloseSession(c, weakMem(), "acct_close");
    expect(result.closed).toBe(true);
    expect(result.conversation.practiceOfferEmittedAt).toBeTruthy();
    expect(result.offer?.targets.length).toBeGreaterThan(0);
    expect(loadPracticeOffer("acct_close")).not.toBeNull();
  });

  it("SP9: second close on same conversation is no-op", () => {
    const c = convo("s1", 5);
    const first = maybeCloseSession(c, weakMem(), "acct_close");
    const second = maybeCloseSession(
      first.conversation,
      weakMem(),
      "acct_close",
    );
    expect(second.closed).toBe(false);
    expect(second.offer).toBeNull();
  });

  it("SP10: missed-close recovery picks stale ≥4-msg chats", () => {
    const now = Date.now();
    const stale = convo("old", 6, {
      updatedAt: now - 20 * 60_000,
    });
    const fresh = convo("new", 6, { updatedAt: now - 1000 });
    const { conversations, offer } = recoverMissedSessionCloses(
      [stale, fresh],
      weakMem(),
      "acct_close",
      now,
    );
    expect(offer).not.toBeNull();
    expect(
      conversations.find((c) => c.sessionId === "old")?.practiceOfferEmittedAt,
    ).toBeTruthy();
    expect(
      conversations.find((c) => c.sessionId === "new")?.practiceOfferEmittedAt,
    ).toBeUndefined();
  });
});
