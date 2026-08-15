/**
 * UX-V4 P0 — single Hero Action rotation for the empty-chat state.
 * Only one primary card is shown; "Another suggestion" cycles the rest.
 * Priority: deepDive > practice > launchpad > challenge/opener > explore > connection > adjacent
 */

import { kvGet, kvSet } from "./browser-kv";

export type HeroKind =
  | "deepDive"
  | "practice"
  | "launchpad"
  | "challenge"
  | "opener"
  | "explore"
  | "connection"
  | "adjacent";

/** Lower number = higher priority when freshness is equal. */
export const HERO_PRIORITY: Record<HeroKind, number> = {
  deepDive: 10,
  practice: 20,
  launchpad: 30,
  challenge: 40,
  opener: 45,
  explore: 50,
  connection: 60,
  adjacent: 70,
};

export type HeroCandidate = {
  kind: HeroKind;
};

const LAST_KEY_PREFIX = "spark.heroAction.last.";

export function heroLastKey(accountId: string): string {
  return `${LAST_KEY_PREFIX}${accountId || "default"}`;
}

export function loadLastHeroKind(accountId: string): HeroKind | null {
  const raw = kvGet(heroLastKey(accountId));
  if (!raw) return null;
  if (raw in HERO_PRIORITY) return raw as HeroKind;
  return null;
}

export function saveLastHeroKind(accountId: string, kind: HeroKind): void {
  kvSet(heroLastKey(accountId), kind);
}

function sortByPriority(cands: HeroCandidate[]): HeroCandidate[] {
  return [...cands].sort(
    (a, b) => HERO_PRIORITY[a.kind] - HERO_PRIORITY[b.kind],
  );
}

/**
 * Pick one hero among available candidates.
 * Prefer highest priority that is not the last-shown kind (freshness).
 * If only one candidate, return it. If empty, null.
 */
export function pickHeroAction(
  candidates: HeroCandidate[],
  accountId: string,
  opts?: { preferKind?: HeroKind | null },
): HeroCandidate | null {
  const sorted = sortByPriority(candidates.filter((c) => c && c.kind));
  if (sorted.length === 0) return null;
  if (opts?.preferKind) {
    const hit = sorted.find((c) => c.kind === opts.preferKind);
    if (hit) return hit;
  }
  if (sorted.length === 1) return sorted[0]!;
  const last = loadLastHeroKind(accountId);
  const fresh = last ? sorted.find((c) => c.kind !== last) : null;
  return fresh ?? sorted[0]!;
}

/** Cycle to the next candidate after `current` in priority order (wrap). */
export function cycleHeroAction(
  candidates: HeroCandidate[],
  current: HeroKind | null,
): HeroCandidate | null {
  const sorted = sortByPriority(candidates.filter((c) => c && c.kind));
  if (sorted.length === 0) return null;
  if (!current) return sorted[0]!;
  const idx = sorted.findIndex((c) => c.kind === current);
  if (idx < 0) return sorted[0]!;
  return sorted[(idx + 1) % sorted.length]!;
}

/** Persist the shown kind so the next empty-state open prefers freshness. */
export function noteHeroShown(accountId: string, kind: HeroKind): void {
  saveLastHeroKind(accountId, kind);
}
