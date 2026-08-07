/**
 * Client-side dictionary lookup helper.
 * Debounces input, calls /api/dict, and manages recent searches in localStorage.
 */

import type { DictLang, DictResponse, RecentSearch } from "./dict-types";

const RECENT_KEY = "spark.dict.recent.v1";
const MAX_RECENT = 20;

export function loadRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(word: string, lang: DictLang): RecentSearch[] {
  if (typeof window === "undefined") return [];
  const recents = loadRecentSearches();
  const filtered = recents.filter(
    (r) => !(r.word.toLowerCase() === word.toLowerCase() && r.lang === lang),
  );
  const next = [{ word, lang, ts: Date.now() }, ...filtered].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export async function dictLookup(
  word: string,
  lang: DictLang,
  signal?: AbortSignal,
): Promise<DictResponse | null> {
  try {
    const url = `/api/dict?word=${encodeURIComponent(word)}&lang=${encodeURIComponent(lang)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as DictResponse;
  } catch {
    return null;
  }
}
