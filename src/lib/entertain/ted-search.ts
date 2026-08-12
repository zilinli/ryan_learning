/**
 * Live TED discovery via TED.com InstantSearch proxy + GraphQL.
 * Metadata / search only — never download video files (TED usage policy).
 */

import type { TedTalk, TedTopic } from "./ted-catalog";
import {
  mergeTedBrowseForLearner,
  searchTedCatalogForLearner,
  sortTedTalksByLearnerFit,
  type TedLearnerFit,
} from "./ted-fit";

const TED_SEARCH_URL = "https://www.ted.com/api/search";
const TED_GRAPHQL_URL = "https://www.ted.com/graphql";
/** InstantSearch index used by TED talks browse page */
export const TED_SEARCH_INDEX =
  "coyote_models_acme_videos_alias_38ce41d1f97ca56a38068f613af166da";

const UA =
  "Mozilla/5.0 (compatible; SparkTutor/1.0; +https://github.com/zilinli/ryan_learning)";

/** Map Studio topic chips → TED Algolia `tags` facet values */
export const TED_TOPIC_TAG: Record<TedTopic, string> = {
  ideas: "ideas",
  science: "science",
  society: "society",
  education: "education",
  creativity: "creativity",
  technology: "technology",
};

export type TedSearchSource = "ted-live" | "curated-fallback";

export type TedSearchResult = {
  talks: TedTalk[];
  page: number;
  nbPages: number;
  nbHits: number;
  query: string;
  source: TedSearchSource;
  officialSearchUrl: string;
  officialBrowseUrl: string;
};

type AlgoliaHit = {
  slug?: string;
  title?: string;
  speakers?: string | string[];
  duration?: string | number;
  objectID?: string;
};

function tedHeaders(): HeadersInit {
  return {
    "User-Agent": UA,
    Accept: "application/json",
    "Content-Type": "application/json",
    Referer: "https://www.ted.com/talks",
    Origin: "https://www.ted.com",
  };
}

export function officialTedSearchUrl(
  query: string,
  topic: TedTopic | "all" = "all",
): string {
  const u = new URL("https://www.ted.com/talks");
  const q = query.trim();
  if (q) u.searchParams.set("q", q);
  u.searchParams.set("sort", q ? "relevance" : "newest");
  if (topic !== "all") {
    u.searchParams.append("topics[]", TED_TOPIC_TAG[topic]);
  }
  return u.toString();
}

export function officialTedBrowseUrl(): string {
  return "https://www.ted.com/talks?sort=newest";
}

function hitToTalk(hit: AlgoliaHit, topicHint?: TedTopic | "all"): TedTalk | null {
  const slug = String(hit.slug || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_]+$/.test(slug)) return null;
  const title = String(hit.title || slug.replace(/_/g, " ")).trim();
  let speaker = "TED speaker";
  if (typeof hit.speakers === "string" && hit.speakers.trim()) {
    speaker = hit.speakers.trim();
  } else if (Array.isArray(hit.speakers) && hit.speakers.length) {
    speaker = hit.speakers.map(String).join(", ");
  }
  const durationRaw = Number(hit.duration);
  const durationSec =
    Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.round(durationRaw)
      : 0;
  const topics: TedTopic[] =
    topicHint && topicHint !== "all" ? [topicHint] : ["ideas"];
  return {
    slug,
    title: title.slice(0, 200),
    speaker: speaker.slice(0, 160),
    durationSec,
    topics,
    blurb: "From TED.com live search",
  };
}

function curatedFallback(
  query: string,
  topic: TedTopic | "all",
  page: number,
  pageSize: number,
  learner?: TedLearnerFit | null,
): TedSearchResult {
  const all = searchTedCatalogForLearner(query, topic, learner);
  const start = Math.max(0, page) * pageSize;
  const talks = all.slice(start, start + pageSize);
  const nbPages = Math.max(1, Math.ceil(all.length / pageSize));
  return {
    talks,
    page: Math.max(0, page),
    nbPages,
    nbHits: all.length,
    query,
    source: "curated-fallback",
    officialSearchUrl: officialTedSearchUrl(query, topic),
    officialBrowseUrl: officialTedBrowseUrl(),
  };
}

/**
 * Full-catalog search via TED InstantSearch proxy (`POST /api/search`).
 * Supports empty query (browse) + topic facet + pagination.
 */
export async function searchTedLive(opts: {
  query?: string;
  topic?: TedTopic | "all";
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
  learner?: TedLearnerFit | null;
}): Promise<TedSearchResult> {
  const query = String(opts.query || "").trim().slice(0, 120);
  const topic = opts.topic || "all";
  const page = Math.max(0, Math.min(200, opts.page ?? 0));
  const pageSize = Math.max(6, Math.min(24, opts.pageSize ?? 18));
  const learner = opts.learner || null;

  const params: Record<string, unknown> = {
    query,
    hitsPerPage: pageSize,
    page,
    distinct: 1,
    attributesToRetrieve: ["slug", "title", "speakers", "duration", "objectID"],
  };
  if (topic !== "all") {
    params.facetFilters = [[`tags:${TED_TOPIC_TAG[topic]}`]];
  }

  try {
    const res = await fetch(TED_SEARCH_URL, {
      method: "POST",
      headers: tedHeaders(),
      body: JSON.stringify([
        {
          indexName: TED_SEARCH_INDEX,
          params,
        },
      ]),
      signal: opts.signal ?? AbortSignal.timeout(18_000),
    });
    if (!res.ok) throw new Error(`TED search HTTP ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        hits?: AlgoliaHit[];
        page?: number;
        nbPages?: number;
        nbHits?: number;
        query?: string;
      }>;
    };
    const block = data.results?.[0];
    if (!block) throw new Error("TED search empty results");
    const talks = (block.hits || [])
      .map((h) => hitToTalk(h, topic))
      .filter((t): t is TedTalk => Boolean(t));
    if (!talks.length && query) {
      // Rare empty page — still prefer curated over lying about live hits
      return curatedFallback(query, topic, page, pageSize, learner);
    }
    const ranked =
      !query && page === 0
        ? mergeTedBrowseForLearner(talks, learner, topic).slice(0, pageSize)
        : sortTedTalksByLearnerFit(talks, learner);
    return {
      talks: ranked,
      page: block.page ?? page,
      nbPages: Math.max(1, block.nbPages ?? 1),
      nbHits: block.nbHits ?? talks.length,
      query: block.query ?? query,
      source: "ted-live",
      officialSearchUrl: officialTedSearchUrl(query, topic),
      officialBrowseUrl: officialTedBrowseUrl(),
    };
  } catch {
    return curatedFallback(query, topic, page, pageSize, learner);
  }
}

/**
 * Newest talks via TED GraphQL `videos` connection (cursor refresh pool).
 */
export async function browseTedNewest(opts: {
  after?: string | null;
  first?: number;
  signal?: AbortSignal;
  learner?: TedLearnerFit | null;
}): Promise<{
  talks: TedTalk[];
  endCursor: string | null;
  hasNextPage: boolean;
  source: TedSearchSource;
}> {
  const first = Math.max(6, Math.min(24, opts.first ?? 18));
  const learner = opts.learner || null;
  const query = `
    query($first: Int, $after: String) {
      videos(first: $first, after: $after) {
        edges {
          node {
            slug
            title
            duration
            presenterDisplayName
            topics { nodes { name } }
          }
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  `;
  try {
    const res = await fetch(TED_GRAPHQL_URL, {
      method: "POST",
      headers: {
        ...tedHeaders(),
        "client-id": "Zenith production",
      },
      body: JSON.stringify({
        query,
        variables: { first, after: opts.after || null },
      }),
      signal: opts.signal ?? AbortSignal.timeout(18_000),
    });
    if (!res.ok) throw new Error(`TED graphql HTTP ${res.status}`);
    const data = (await res.json()) as {
      data?: {
        videos?: {
          edges?: Array<{
            node?: {
              slug?: string;
              title?: string;
              duration?: number;
              presenterDisplayName?: string;
              topics?: { nodes?: Array<{ name?: string }> };
            };
          }>;
          pageInfo?: { endCursor?: string; hasNextPage?: boolean };
        };
      };
    };
    const edges = data.data?.videos?.edges || [];
    const talks: TedTalk[] = [];
    for (const e of edges) {
      const n = e.node;
      if (!n?.slug) continue;
      const topicNames = (n.topics?.nodes || [])
        .map((t) => String(t.name || "").toLowerCase())
        .filter(Boolean);
      const mapped: TedTopic[] = (
        [
          "science",
          "education",
          "creativity",
          "technology",
          "society",
          "ideas",
        ] as TedTopic[]
      ).filter((t) => topicNames.some((name) => name.includes(t)));
      talks.push({
        slug: n.slug.toLowerCase(),
        title: String(n.title || n.slug).slice(0, 200),
        speaker: String(n.presenterDisplayName || "TED speaker").slice(0, 160),
        durationSec: Math.round(Number(n.duration) || 0),
        topics: mapped.length ? mapped : ["ideas"],
        blurb: "Fresh from TED.com",
      });
    }
    if (!talks.length) throw new Error("empty graphql page");
    return {
      talks: sortTedTalksByLearnerFit(talks, learner),
      endCursor: data.data?.videos?.pageInfo?.endCursor || null,
      hasNextPage: Boolean(data.data?.videos?.pageInfo?.hasNextPage),
      source: "ted-live",
    };
  } catch {
    const ranked = searchTedCatalogForLearner("", "all", learner);
    return {
      talks: ranked.slice(0, first),
      endCursor: null,
      hasNextPage: false,
      source: "curated-fallback",
    };
  }
}
