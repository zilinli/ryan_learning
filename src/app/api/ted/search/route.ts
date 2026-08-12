/**
 * GET /api/ted/search
 * Query: q?, topic?, page?, pageSize?, mode?=search|refresh, grade?, age?
 *
 * Live TED InstantSearch proxy (+ curated fallback). Metadata only.
 * Results are re-ranked by learner grade/age fit (never hidden).
 */

import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import type { TedTopic } from "@/lib/entertain/ted-catalog";
import { parseTedLearnerFit } from "@/lib/entertain/ted-fit";
import {
  browseTedNewest,
  officialTedBrowseUrl,
  officialTedSearchUrl,
  searchTedLive,
} from "@/lib/entertain/ted-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOPICS = new Set<TedTopic>([
  "ideas",
  "science",
  "society",
  "education",
  "creativity",
  "technology",
]);

function parseTopic(raw: string | null): TedTopic | "all" {
  const t = String(raw || "all").toLowerCase();
  if (t === "all") return "all";
  if (TOPICS.has(t as TedTopic)) return t as TedTopic;
  return "all";
}

export async function GET(req: Request) {
  const limited = checkApiRateLimit(req, "ted-search", RATE_PRESETS.entertain);
  if (limited) return limited;

  const url = new URL(req.url);
  const mode = String(url.searchParams.get("mode") || "search").toLowerCase();
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 120);
  const topic = parseTopic(url.searchParams.get("topic"));
  const page = Math.max(
    0,
    Math.min(200, Number(url.searchParams.get("page") || 0) || 0),
  );
  const pageSize = Math.max(
    6,
    Math.min(24, Number(url.searchParams.get("pageSize") || 18) || 18),
  );
  const after = url.searchParams.get("after");
  const learner = parseTedLearnerFit({
    grade: url.searchParams.get("grade"),
    age: url.searchParams.get("age"),
  });

  if (mode === "refresh") {
    const browse = await browseTedNewest({
      after,
      first: pageSize,
      signal: req.signal,
      learner,
    });
    return Response.json({
      ok: true,
      mode: "refresh",
      talks: browse.talks,
      endCursor: browse.endCursor,
      hasNextPage: browse.hasNextPage,
      page: 0,
      nbPages: browse.hasNextPage ? 2 : 1,
      nbHits: browse.talks.length,
      query: "",
      source: browse.source,
      officialSearchUrl: officialTedBrowseUrl(),
      officialBrowseUrl: officialTedBrowseUrl(),
    });
  }

  const result = await searchTedLive({
    query: q,
    topic,
    page,
    pageSize,
    signal: req.signal,
    learner,
  });

  return Response.json({
    ok: true,
    mode: "search",
    ...result,
    officialSearchUrl: officialTedSearchUrl(q, topic),
  });
}
