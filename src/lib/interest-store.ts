/**
 * P0 — interest profile (report §9.1.1 / 9.1.3).
 * Records which exploration topics the student chose, so the interest
 * "grows visibly" on the Me hub and exploration stays student-led.
 * Stored per-account in localStorage via browser-kv (server tests safe).
 */

import { kvGet, kvSet } from "./browser-kv";

export type InterestRecord = {
  topicId: string;
  label: string;
  emoji: string;
  exploredAt: number;
  count: number;
};

const KEY_PREFIX = "spark.interests.";
const MAX_INTERESTS = 12;

export function interestStorageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId || "default"}`;
}

export function loadInterests(accountId: string): InterestRecord[] {
  const raw = kvGet(interestStorageKey(accountId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<Partial<InterestRecord>>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((i) => i && i.topicId)
      .map((i) => ({
        topicId: String(i.topicId).slice(0, 48),
        label: String(i.label || i.topicId).slice(0, 64),
        emoji: String(i.emoji || "✨").slice(0, 4),
        exploredAt: Number(i.exploredAt) || 0,
        count: Math.max(1, Math.floor(Number(i.count) || 1)),
      }))
      .sort((a, b) => b.exploredAt - a.exploredAt)
      .slice(0, MAX_INTERESTS);
  } catch {
    return [];
  }
}

function saveInterests(accountId: string, items: InterestRecord[]): void {
  kvSet(interestStorageKey(accountId), JSON.stringify(items.slice(0, MAX_INTERESTS)));
}

/** Record that the student chose to explore a topic (upsert, bumps count). */
export function recordInterest(
  accountId: string,
  topic: { topicId: string; label: string; emoji: string },
): InterestRecord {
  const items = loadInterests(accountId);
  const existing = items.find((i) => i.topicId === topic.topicId);
  if (existing) {
    const updated: InterestRecord = {
      ...existing,
      label: topic.label || existing.label,
      emoji: topic.emoji || existing.emoji,
      exploredAt: Date.now(),
      count: existing.count + 1,
    };
    saveInterests(accountId, [
      updated,
      ...items.filter((i) => i.topicId !== topic.topicId),
    ]);
    return updated;
  }
  const row: InterestRecord = {
    topicId: String(topic.topicId).slice(0, 48),
    label: String(topic.label || topic.topicId).slice(0, 64),
    emoji: String(topic.emoji || "✨").slice(0, 4),
    exploredAt: Date.now(),
    count: 1,
  };
  saveInterests(accountId, [row, ...items]);
  return row;
}

/** Most recent interests (for the Me-hub footprint line). */
export function recentInterests(accountId: string, limit = 5): InterestRecord[] {
  return loadInterests(accountId).slice(0, Math.max(1, limit));
}
