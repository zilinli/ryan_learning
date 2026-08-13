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

// ── Server sync (V3) — cross-device interest continuity ─────────────

/**
 * Union two interest lists by topicId: newest label/emoji wins, counts and
 * exploredAt take the max. Used for local ↔ server merge.
 */
export function mergeInterests(
  a: InterestRecord[],
  b: InterestRecord[],
): InterestRecord[] {
  const map = new Map<string, InterestRecord>();
  for (const r of [...a, ...b]) {
    const prev = map.get(r.topicId);
    if (!prev) {
      map.set(r.topicId, r);
      continue;
    }
    const newer = prev.exploredAt >= r.exploredAt ? prev : r;
    map.set(r.topicId, {
      ...newer,
      exploredAt: Math.max(prev.exploredAt, r.exploredAt),
      count: Math.max(prev.count, r.count),
    });
  }
  return [...map.values()]
    .sort((x, y) => y.exploredAt - x.exploredAt)
    .slice(0, MAX_INTERESTS);
}

/** Pull interests from the server and merge with local (writes back). */
export async function hydrateInterestsFromServer(
  accountId: string,
): Promise<InterestRecord[]> {
  if (typeof window === "undefined") return loadInterests(accountId);
  const local = loadInterests(accountId);
  try {
    const res = await fetch(
      `/api/interest?accountId=${encodeURIComponent(accountId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return local;
    const data = (await res.json()) as { interests?: InterestRecord[] };
    const merged = mergeInterests(local, data.interests || []);
    saveInterests(accountId, merged);
    return merged;
  } catch {
    return local;
  }
}

/** Push the current local interest profile to the server (best-effort). */
export async function pushInterestsToServer(accountId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/interest", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        interests: loadInterests(accountId),
      }),
    });
  } catch {
    /* local-only ok */
  }
}
