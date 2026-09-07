/**
 * Podcast Lab episode-first search.
 * Aggregates recent episodes across the curated catalog and filters by
 * episode title / description / categories + show topics — not show names alone.
 */

import {
  PODCAST_CATALOG,
  resolveShowFeed,
  type PodcastShow,
  type PodcastTopic,
} from "./podcast-catalog";
import {
  fetchPodcastEpisodes,
  type PodcastEpisode,
} from "./podcast-rss";

export type PodcastEpisodeHit = PodcastEpisode & {
  showId: string;
  showTitle: string;
  showHost: string;
  topics: PodcastTopic[];
  kidFriendly?: boolean;
};

export type PodcastSearchResult = {
  episodes: PodcastEpisodeHit[];
  page: number;
  nbPages: number;
  nbHits: number;
  query: string;
  topic: PodcastTopic | "all";
};

function pubMs(raw: string): number {
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function hitMatchesQuery(hit: PodcastEpisodeHit, q: string): boolean {
  if (!q) return true;
  if (hit.title.toLowerCase().includes(q)) return true;
  if (hit.description.toLowerCase().includes(q)) return true;
  if (hit.categories.some((c) => c.toLowerCase().includes(q))) return true;
  if (hit.topics.some((t) => t.toLowerCase().includes(q))) return true;
  // Allow finding an episode by typing part of the host (not the show title as primary).
  if (hit.showHost.toLowerCase().includes(q)) return true;
  return false;
}

function hitMatchesTopic(
  hit: PodcastEpisodeHit,
  topic: PodcastTopic | "all",
): boolean {
  if (topic === "all") return true;
  if (topic === "kids" && hit.kidFriendly) return true;
  if (hit.topics.includes(topic)) return true;
  return hit.categories.some((c) => c.toLowerCase().includes(topic));
}

function toHit(show: PodcastShow, ep: PodcastEpisode): PodcastEpisodeHit {
  return {
    ...ep,
    categories: ep.categories || [],
    showId: show.id,
    showTitle: show.title,
    showHost: show.host,
    topics: show.topics,
    kidFriendly: show.kidFriendly,
  };
}

/** Load episodes for one show; failed feeds return []. */
export async function loadShowEpisodeHits(
  show: PodcastShow,
): Promise<PodcastEpisodeHit[]> {
  try {
    const feedUrl = await resolveShowFeed(show);
    const eps = await fetchPodcastEpisodes(feedUrl);
    return eps.map((ep) => toHit(show, ep));
  } catch {
    return [];
  }
}

/**
 * Cross-catalog episode search. Empty query → newest-first browse.
 * Query matches episode title / description / categories / show topics / host.
 */
export async function searchPodcastEpisodes(opts: {
  query?: string;
  topic?: PodcastTopic | "all";
  page?: number;
  pageSize?: number;
  shows?: PodcastShow[];
}): Promise<PodcastSearchResult> {
  const query = String(opts.query || "").trim().toLowerCase().slice(0, 120);
  const topic = opts.topic || "all";
  const page = Math.max(0, Math.min(50, opts.page ?? 0));
  const pageSize = Math.max(6, Math.min(40, opts.pageSize ?? 24));
  const shows = opts.shows || PODCAST_CATALOG;

  const batches = await Promise.all(shows.map((s) => loadShowEpisodeHits(s)));
  let all = batches.flat();

  all = all.filter(
    (h) => hitMatchesTopic(h, topic) && hitMatchesQuery(h, query),
  );

  all.sort((a, b) => {
    const d = pubMs(b.pubDate) - pubMs(a.pubDate);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title);
  });

  const nbHits = all.length;
  const nbPages = Math.max(1, Math.ceil(nbHits / pageSize));
  const start = page * pageSize;
  const episodes = all.slice(start, start + pageSize);

  return {
    episodes,
    page,
    nbPages,
    nbHits,
    query: String(opts.query || "").trim().slice(0, 120),
    topic,
  };
}

/** Pure filter helper for unit tests (no network). */
export function filterPodcastHits(
  hits: PodcastEpisodeHit[],
  query: string,
  topic: PodcastTopic | "all" = "all",
): PodcastEpisodeHit[] {
  const q = query.trim().toLowerCase();
  return hits.filter(
    (h) => hitMatchesTopic(h, topic) && hitMatchesQuery(h, q),
  );
}
