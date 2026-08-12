/**
 * GET /api/natgeo/search
 * Query: q?, topic?, page?, pageSize?, mode?=search|refresh, grade?, cursor?
 */

import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  NATGEO_TOPICS,
  type NatGeoTopic,
} from "@/lib/entertain/natgeo-catalog";
import {
  refreshNatGeoBatch,
  searchNatGeoLive,
} from "@/lib/entertain/natgeo-search";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const TOPICS = new Set<NatGeoTopic>(NATGEO_TOPICS);

function parseTopic(raw: string | null): NatGeoTopic | "all" {
  const t = String(raw || "all").toLowerCase();
  if (t === "all") return "all";
  if (TOPICS.has(t as NatGeoTopic)) return t as NatGeoTopic;
  return "all";
}

export async function GET(req: Request) {
  const limited = checkApiRateLimit(req, "natgeo-search", RATE_PRESETS.entertain);
  if (limited) return limited;

  const url = new URL(req.url);
  const mode = String(url.searchParams.get("mode") || "search").toLowerCase();
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 120);
  const topic = parseTopic(url.searchParams.get("topic"));
  const page = Math.max(
    0,
    Math.min(50, Number(url.searchParams.get("page") || 0) || 0),
  );
  const pageSize = Math.max(
    6,
    Math.min(24, Number(url.searchParams.get("pageSize") || 18) || 18),
  );
  const cursor = url.searchParams.get("cursor");
  const gradeRaw = url.searchParams.get("grade") || "";
  const grade = gradeRaw ? Number(gradeRaw) : undefined;
  const g =
    typeof grade === "number" && Number.isFinite(grade)
      ? normalizeLearnerGrade(grade)
      : null;

  if (mode === "refresh") {
    const batch = await refreshNatGeoBatch({
      cursor,
      topic,
      pageSize,
      signal: req.signal,
    });
    let articles = batch.articles;
    if (g != null) {
      const filtered = articles.filter((a) => a.gradeMin <= g && a.gradeMax >= g);
      if (filtered.length > 0) articles = filtered;
      // else: keep all — never return empty from refresh
    }
    return Response.json({
      ok: true,
      mode: "refresh",
      articles: articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        topic: a.topic,
        gradeMin: a.gradeMin,
        gradeMax: a.gradeMax,
        readingTimeMin: a.readingTimeMin,
        blurb: a.blurb,
        imageUrl: a.imageUrl,
        videoId: a.videoId ?? undefined,
      })),
      cursor: batch.cursor,
      hasNextPage: batch.hasNextPage,
      page: 0,
      nbPages: batch.nbPages,
      nbHits: batch.nbHits,
      query: "",
      source: batch.source,
      topics: NATGEO_TOPICS,
    });
  }

  const result = await searchNatGeoLive({
    query: q,
    topic,
    page,
    pageSize,
    signal: req.signal,
  });

  let articles = result.articles;
  if (g != null) {
    const filtered = articles.filter((a) => a.gradeMin <= g && a.gradeMax >= g);
    if (filtered.length > 0) articles = filtered;
    // else: keep all — never return empty
  }

  return Response.json({
    ok: true,
    mode: "search",
    articles: articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      topic: a.topic,
      gradeMin: a.gradeMin,
      gradeMax: a.gradeMax,
      readingTimeMin: a.readingTimeMin,
      blurb: a.blurb,
      imageUrl: a.imageUrl,
      videoId: a.videoId ?? undefined,
    })),
    page: result.page,
    nbPages: result.nbPages,
    nbHits: result.nbHits,
    query: result.query,
    source: result.source,
    cursor: result.cursor,
    hasNextPage: result.hasNextPage,
    total: articles.length,
    topics: NATGEO_TOPICS,
  });
}
