/**
 * Spelling suggestions for dictionary lookups (EN / ES / FR).
 * Combines Levenshtein against local seeds + Datamuse (English-friendly).
 */

import type { DictLang } from "./dict-types";
import { listSeedWords } from "./local-seeds";

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Classic Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array<number>(t.length + 1);
  const cur = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= t.length; j++) prev[j] = cur[j] ?? 0;
  }
  return prev[t.length] ?? 0;
}

/** Max edit distance worth suggesting, scaled by query length. */
export function maxEditDistance(query: string): number {
  const n = query.trim().length;
  if (n <= 3) return 1;
  if (n <= 6) return 2;
  return 3;
}

/**
 * Rank candidate words by edit distance (accent-insensitive).
 * Prefers exact accent-stripped matches, then low distance.
 */
export function suggestFromCandidates(
  query: string,
  candidates: string[],
  limit = 5,
): string[] {
  const q = query.toLowerCase().trim();
  const qBare = stripAccents(q);
  if (!q) return [];

  const scored: { word: string; dist: number }[] = [];
  const maxDist = maxEditDistance(q);
  const seen = new Set<string>();

  for (const raw of candidates) {
    const w = raw.toLowerCase().trim();
    if (!w || seen.has(w) || w === q) continue;
    const wBare = stripAccents(w);
    let dist = levenshtein(q, w);
    const bareDist = levenshtein(qBare, wBare);
    if (bareDist < dist) dist = bareDist;
    if (qBare === wBare) dist = 0;
    if (dist > maxDist) continue;
    // Prefer prefix-ish typos for short queries
    if (dist === 0 && w !== q) {
      // accent-only difference — still a useful suggestion
    }
    seen.add(w);
    scored.push({ word: raw, dist });
  }

  scored.sort((a, b) => a.dist - b.dist || a.word.length - b.word.length);
  return scored.slice(0, limit).map((s) => s.word);
}

/** Datamuse spelling suggestions (best for English; sometimes helps ES/FR). */
export async function datamuseSuggest(
  query: string,
  limit = 5,
): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(q)}&max=${limit + 3}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { word?: string }[];
    if (!Array.isArray(data)) return [];
    const qLower = q.toLowerCase();
    return data
      .map((d) => (d.word || "").toLowerCase().trim())
      .filter((w) => w && w !== qLower)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Build ranked suggestions for a misspelled / missing query.
 * Local seeds first (fast, offline), then Datamuse for EN (and as extra for ES/FR).
 */
export async function buildSuggestions(
  query: string,
  lang: DictLang,
  limit = 5,
): Promise<string[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const seedWords = listSeedWords(lang);
  const fromSeeds = suggestFromCandidates(q, seedWords, limit);

  let fromRemote: string[] = [];
  if (lang === "en" || lang === "es" || lang === "fr") {
    fromRemote = await datamuseSuggest(q, limit);
  }

  // Merge: seed hits first, then remote, de-dupe, re-rank by distance
  const merged = [...new Set([...fromSeeds, ...fromRemote])];
  return suggestFromCandidates(q, merged, limit);
}

/**
 * Pick an auto-correct target when confidence is high.
 * Returns null if we should only show "Did you mean?" chips.
 */
export function pickAutoCorrect(
  query: string,
  suggestions: string[],
): string | null {
  if (!suggestions.length) return null;
  const q = query.toLowerCase().trim();
  const best = suggestions[0]!;
  const dist = Math.min(
    levenshtein(q, best.toLowerCase()),
    levenshtein(stripAccents(q), stripAccents(best.toLowerCase())),
  );
  // Auto-apply only for close typos (distance 1, or 2 when query is long)
  if (dist === 0) return best; // accent-only / casing
  if (dist === 1) return best;
  if (dist === 2 && q.length >= 6) return best;
  return null;
}
