/**
 * A2.h — Shared session-close helper for practice-offer generation.
 * Triggers: New chat, switch conversation, visibility hidden (debounced),
 * missed-close recovery on load.
 */

import type { ConversationRecord } from "./types";
import type { LearningMemory } from "./learning-memory";
import {
  createPracticeOffer,
  savePracticeOffer,
  type PendingPracticeOffer,
} from "./session-practice";

export const PRACTICE_MIN_MESSAGES = 4;
export const MISSED_CLOSE_AGE_MS = 10 * 60_000;
export const VISIBILITY_CLOSE_DEBOUNCE_MS = 30_000;

export type CloseSessionResult = {
  conversation: ConversationRecord;
  offer: PendingPracticeOffer | null;
  closed: boolean;
};

/**
 * Idempotent: first successful close stamps practiceOfferEmittedAt.
 * Creates + persists a practice offer when messages ≥ 4 and memory has targets.
 */
export function maybeCloseSession(
  conversation: ConversationRecord | null | undefined,
  mem: LearningMemory | null | undefined,
  accountId: string,
  now = Date.now(),
): CloseSessionResult {
  if (!conversation) {
    return {
      conversation: {
        sessionId: "",
        title: "",
        messages: [],
        createdAt: 0,
        updatedAt: 0,
      },
      offer: null,
      closed: false,
    };
  }
  if (conversation.practiceOfferEmittedAt) {
    return { conversation, offer: null, closed: false };
  }
  if ((conversation.messages?.length || 0) < PRACTICE_MIN_MESSAGES) {
    return { conversation, offer: null, closed: false };
  }

  const stamped: ConversationRecord = {
    ...conversation,
    practiceOfferEmittedAt: now,
  };
  const offer = createPracticeOffer(accountId, mem, now);
  if (offer) savePracticeOffer(offer);
  return { conversation: stamped, offer, closed: true };
}

/** Patch one conversation inside a store-like list. */
export function stampConversationInList(
  conversations: ConversationRecord[],
  sessionId: string,
  patch: ConversationRecord,
): ConversationRecord[] {
  return conversations.map((c) => (c.sessionId === sessionId ? patch : c));
}

/**
 * Missed-close recovery: abandoned chats (≥4 msgs, no emit, updatedAt older
 * than ageMs). Returns the first closed conversation's offer (newest abandon).
 */
export function recoverMissedSessionCloses(
  conversations: ConversationRecord[],
  mem: LearningMemory | null | undefined,
  accountId: string,
  now = Date.now(),
  ageMs = MISSED_CLOSE_AGE_MS,
): {
  conversations: ConversationRecord[];
  offer: PendingPracticeOffer | null;
} {
  let offer: PendingPracticeOffer | null = null;
  const next = conversations.map((c) => {
    if (c.practiceOfferEmittedAt) return c;
    if ((c.messages?.length || 0) < PRACTICE_MIN_MESSAGES) return c;
    if (now - (c.updatedAt || 0) < ageMs) return c;
    const result = maybeCloseSession(c, mem, accountId, now);
    if (result.offer && !offer) offer = result.offer;
    return result.conversation;
  });
  return { conversations: next, offer };
}
