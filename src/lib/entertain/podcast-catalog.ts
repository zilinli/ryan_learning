/**
 * Podcast Lab — curated show catalog + feed resolution.
 *
 * Feed URLs are hardcoded (verified against Apple/iTunes Podcast on 2026-08-23)
 * and may be refreshed at runtime via the iTunes Lookup/Search API (no auth,
 * ~20 req/min) when a feed stops responding. Raw feed XML is disk-cached by
 * podcast-rss.ts so we rarely hit the network twice for the same show.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type PodcastTopic =
  | "ideas"
  | "science"
  | "society"
  | "education"
  | "creativity"
  | "technology"
  | "history"
  | "kids";

export type PodcastShow = {
  id: string;
  title: string;
  host: string;
  /** Verified RSS feed URL. Empty → resolve via iTunes by collectionId/title. */
  feedUrl?: string;
  /** Apple Podcasts collectionId (iTunes lookup fallback for feedUrl). */
  collectionId?: number;
  topics: PodcastTopic[];
  blurb: string;
  language?: string;
  kidFriendly?: boolean;
};

export const PODCAST_CATALOG: PodcastShow[] = [
  {
    id: "freakonomics-radio",
    title: "Freakonomics Radio",
    host: "Stephen Dubner",
    feedUrl: "https://feeds.simplecast.com/Y8lFbOT4",
    collectionId: 354668519,
    topics: ["ideas", "society", "science"],
    blurb:
      "The hidden side of everything — economics, human behavior, and everyday puzzles.",
  },
  {
    id: "stuff-you-should-know",
    title: "Stuff You Should Know",
    host: "Josh Clark & Chuck Bryant",
    feedUrl:
      "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/a91018a4-ea4f-4130-bf55-ae270180c327/44710ecc-10bb-48d1-93c7-ae270180c33e/podcast.rss",
    collectionId: 278981407,
    topics: ["ideas", "science", "society"],
    blurb:
      "Two friends explain how everyday things and strange phenomena actually work.",
  },
  {
    id: "ted-talks-daily",
    title: "TED Talks Daily",
    host: "TED",
    feedUrl: "https://feeds.acast.com/public/shows/67587e77c705e441797aff96",
    collectionId: 160904630,
    topics: ["ideas", "science", "education", "creativity", "technology", "society"],
    blurb:
      "Short, powerful talks from the world's best speakers — the audio version of TED Lab.",
  },
  {
    id: "radiolab",
    title: "Radiolab",
    host: "Lulu Miller & Latif Nasser",
    feedUrl: "https://feeds.simplecast.com/EmVW7VGp",
    collectionId: 152249110,
    topics: ["science", "ideas", "history"],
    blurb:
      "A narrative science show that turns big questions into stories.",
  },
  {
    id: "the-rest-is-history",
    title: "The Rest Is History",
    host: "Tom Holland & Dominic Sandbrook",
    feedUrl: "https://feeds.megaphone.fm/GLT4787413333",
    collectionId: 1537788786,
    topics: ["history", "ideas", "society"],
    blurb:
      "Two historians bring the past to life — wars, kings, and the stories behind them.",
  },
  {
    id: "wow-in-the-world",
    title: "Wow in the World",
    host: "Mindy Thomas & Guy Raz",
    feedUrl: "https://rss.art19.com/wow-in-the-world",
    collectionId: 1233834541,
    topics: ["kids", "science", "technology"],
    blurb:
      "A science podcast for curious kids and their grown-ups — wonders, inventions, and wows.",
    kidFriendly: true,
  },
  {
    id: "but-why",
    title: "But Why: A Podcast for Curious Kids",
    host: "Jane Lindholm",
    feedUrl: "https://podcasts.vpr.net/but-why",
    collectionId: 1103320303,
    topics: ["kids", "science", "society"],
    blurb:
      "Kids send in their biggest questions and we find the answers with experts.",
    kidFriendly: true,
  },
];

let FEED_DIR = path.join(process.cwd(), "data", "podcast-cache", "feeds");
const FEED_TTL_MS = 7 * 86_400_000;

export function findPodcastShow(id: string | null | undefined): PodcastShow | null {
  const s = String(id || "").trim().toLowerCase();
  if (!s) return null;
  return (
    PODCAST_CATALOG.find((p) => p.id === s) ||
    PODCAST_CATALOG.find((p) => p.title.toLowerCase() === s) ||
    null
  );
}

export function parsePodcastShowId(raw: unknown): string | null {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return null;
  return findPodcastShow(s)?.id ?? null;
}

function resolveJsonPath(showId: string): string {
  const safe = showId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return path.join(FEED_DIR, `${safe}.json`);
}

async function readFeedCache(showId: string): Promise<string | null> {
  try {
    const st = await fs.stat(resolveJsonPath(showId));
    if (Date.now() - st.mtimeMs > FEED_TTL_MS) return null;
    const raw = await fs.readFile(resolveJsonPath(showId), "utf8");
    const data = JSON.parse(raw) as { feedUrl?: string };
    if (typeof data.feedUrl === "string" && data.feedUrl.trim()) {
      return data.feedUrl.trim();
    }
  } catch {
    /* no cache */
  }
  return null;
}

async function writeFeedCache(showId: string, feedUrl: string): Promise<void> {
  try {
    await fs.mkdir(FEED_DIR, { recursive: true });
    await fs.writeFile(
      resolveJsonPath(showId),
      JSON.stringify({ feedUrl, cachedAt: Date.now() }),
      "utf8",
    );
  } catch {
    /* cache is best-effort */
  }
}

const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";
const ITUNES_SEARCH = "https://itunes.apple.com/search";

/** iTunes lookup by collectionId → feedUrl. Throws on network / no result. */
export async function fetchFeedFromItunesLookup(
  show: PodcastShow,
): Promise<string> {
  if (!show.collectionId) throw new Error(`No collectionId for ${show.id}`);
  const res = await fetch(`${ITUNES_LOOKUP}?id=${show.collectionId}&entity=podcast`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`iTunes lookup HTTP ${res.status}`);
  const data = (await res.json()) as {
    resultCount?: number;
    results?: Array<{ feedUrl?: string }>;
  };
  const feed = data.results?.[0]?.feedUrl?.trim();
  if (!feed) throw new Error(`iTunes lookup returned no feedUrl for ${show.id}`);
  return feed;
}

/** iTunes search by title → best-match feedUrl. Throws on no match. */
export async function fetchFeedFromItunesSearch(
  show: PodcastShow,
): Promise<string> {
  const term = encodeURIComponent(show.title);
  const res = await fetch(
    `${ITUNES_SEARCH}?term=${term}&entity=podcast&limit=8`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) },
  );
  if (!res.ok) throw new Error(`iTunes search HTTP ${res.status}`);
  const data = (await res.json()) as {
    resultCount?: number;
    results?: Array<{ collectionName?: string; feedUrl?: string }>;
  };
  const results = data.results || [];
  const want = show.title.toLowerCase();
  const exact =
    results.find((r) => (r.collectionName || "").toLowerCase() === want) ||
    results[0];
  const feed = exact?.feedUrl?.trim();
  if (!feed) throw new Error(`iTunes search found no feedUrl for ${show.id}`);
  return feed;
}

/**
 * Resolve a show's RSS feed URL. Order: catalog.feedUrl → iTunes lookup
 * (collectionId) → iTunes search (title). Disk cache short-circuits iTunes.
 * Result is cached so we only hit Apple once per week per show.
 */
export async function resolveShowFeed(show: PodcastShow): Promise<string> {
  if (show.feedUrl?.trim()) return show.feedUrl.trim();
  const cached = await readFeedCache(show.id);
  if (cached) return cached;
  try {
    const feed = show.collectionId
      ? await fetchFeedFromItunesLookup(show)
      : await fetchFeedFromItunesSearch(show);
    await writeFeedCache(show.id, feed);
    return feed;
  } catch {
    if (show.feedUrl?.trim()) return show.feedUrl.trim();
    throw new Error(`Could not resolve feed for ${show.title}`);
  }
}

/** Test helper — point the feed-resolution cache at a temp dir. */
export function setPodcastFeedCacheDirForTests(dir: string): void {
  FEED_DIR = dir;
}
