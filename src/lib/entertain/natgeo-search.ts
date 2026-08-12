/**
 * NatGeo Kids discovery — curated catalog + live search scrape + refresh batches.
 */

import type { NatGeoArticle, NatGeoTopic } from "./natgeo-catalog";
import {
  NATGEO_CATALOG,
  searchNatGeoCatalog,
} from "./natgeo-catalog";
import { fetchNatGeoArticle } from "./natgeo-scrape";

export type NatGeoSearchSource = "natgeo-live" | "curated-fallback";

export type NatGeoSearchResult = {
  articles: NatGeoArticle[];
  page: number;
  nbPages: number;
  nbHits: number;
  query: string;
  source: NatGeoSearchSource;
  cursor: string | null;
  hasNextPage: boolean;
};

const UA =
  "Mozilla/5.0 (compatible; SparkTutor/1.0; +https://github.com/zilinli/ryan_learning)";

async function scrapeSearchSlugs(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const url = `https://kids.nationalgeographic.com/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(15_000),
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const slugs = new Set<string>();
    const re = /\/animals\/article\/([a-z0-9-]+)/gi;
    let m;
    while ((m = re.exec(html))) {
      slugs.add(m[1]!);
    }
    return [...slugs].slice(0, 24);
  } catch {
    return [];
  }
}

function curatedFallback(
  query: string,
  topic: NatGeoTopic | "all",
  page: number,
  pageSize: number,
): NatGeoSearchResult {
  const all = searchNatGeoCatalog(
    query,
    topic === "all" ? undefined : topic,
  );
  const start = Math.max(0, page) * pageSize;
  const articles = all.slice(start, start + pageSize);
  const nbPages = Math.max(1, Math.ceil(all.length / pageSize));
  return {
    articles,
    page: Math.max(0, page),
    nbPages,
    nbHits: all.length,
    query,
    source: "curated-fallback",
    cursor: null,
    hasNextPage: page + 1 < nbPages,
  };
}

export async function searchNatGeoLive(opts: {
  query?: string;
  topic?: NatGeoTopic | "all";
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<NatGeoSearchResult> {
  const query = String(opts.query || "").trim().slice(0, 120);
  const topic = opts.topic || "all";
  const page = Math.max(0, Math.min(50, opts.page ?? 0));
  const pageSize = Math.max(6, Math.min(24, opts.pageSize ?? 18));

  // Empty query: always show curated catalog first (instant)
  if (!query) return curatedFallback("", topic, page, pageSize);

  // Query-based: try live search, merged with catalog
  let merged: NatGeoArticle[] = [];
  let usedLive = false;

  try {
    const slugs = await scrapeSearchSlugs(query, opts.signal);
    if (slugs.length) {
      usedLive = true;
      const seen = new Set<string>();
      for (const slug of slugs) {
        if (seen.has(slug)) continue;
        seen.add(slug);
        const cat = NATGEO_CATALOG.find((a) => a.slug === slug);
        const article = cat ?? (await fetchNatGeoArticle(slug));
        if (article && (topic === "all" || article.topic === topic)) {
          merged.push(article);
        }
      }
    }
  } catch { /* ignore */ }

  // Merge with catalog results (catalog-first, live-second for dedup)
  const catalogResults = searchNatGeoCatalog(query, topic === "all" ? undefined : topic);
  const seen = new Set(merged.map((a) => a.slug));
  for (const a of catalogResults) {
    if (!seen.has(a.slug)) {
      merged.push(a);
      seen.add(a.slug);
    }
  }

  if (!merged.length) return curatedFallback(query, topic, page, pageSize);

  const start = page * pageSize;
  const articles = merged.slice(start, start + pageSize);
  const nbPages = Math.max(1, Math.ceil(merged.length / pageSize));

  return {
    articles,
    page,
    nbPages,
    nbHits: merged.length,
    query,
    source: usedLive ? "natgeo-live" : "curated-fallback",
    cursor: String(page + 1),
    hasNextPage: page + 1 < nbPages,
  };
}

export async function refreshNatGeoBatch(opts: {
  cursor?: string | null;
  topic?: NatGeoTopic | "all";
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<NatGeoSearchResult> {
  const pageSize = Math.max(6, Math.min(24, opts.pageSize ?? 18));
  const topic = opts.topic || "all";

  const pool =
    topic === "all"
      ? [...NATGEO_CATALOG]
      : NATGEO_CATALOG.filter((a) => a.topic === topic);

  // Shuffle, but keep articles with videoId first in each batch
  const withVideo = shuffle([...pool.filter((a) => a.videoId)]);
  const withoutVideo = shuffle([...pool.filter((a) => !a.videoId)]);
  const sorted = [...withVideo, ...withoutVideo];

  const offset = (Number(opts.cursor) || 0) % Math.max(1, sorted.length);
  const cycled = [...sorted.slice(offset), ...sorted.slice(0, offset)];
  const articles = cycled.slice(0, pageSize);

  return {
    articles,
    page: 0,
    nbPages: Math.max(1, Math.ceil(pool.length / pageSize)),
    nbHits: pool.length,
    query: "",
    source: "curated-fallback",
    cursor: String((offset + pageSize) % sorted.length),
    hasNextPage: true,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
