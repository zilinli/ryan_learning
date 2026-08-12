import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  BBC_TOPICS,
  type BbcTopic,
} from "@/lib/entertain/bbc-catalog";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";
import {
  refreshBbcBatch,
  searchBbcLive,
} from "@/lib/entertain/bbc-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPICS = new Set<BbcTopic>(BBC_TOPICS);

function parseTopic(raw: string | null): BbcTopic | "all" {
  const t = String(raw || "all").toLowerCase();
  if (t === "all") return "all";
  if (TOPICS.has(t as BbcTopic)) return t as BbcTopic;
  return "all";
}

export async function GET(req: Request) {
  const limited = checkApiRateLimit(req, "bbc-search", RATE_PRESETS.entertain);
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
    const batch = await refreshBbcBatch({
      cursor,
      pageSize,
      signal: req.signal,
    });
    let clips = batch.clips;
    if (g != null) {
      const filtered = clips.filter((c) => c.gradeMin <= g && c.gradeMax >= g);
      if (filtered.length > 0) clips = filtered;
      // else: keep all — never return empty from refresh
    }
    return Response.json({
      ok: true,
      mode: "refresh",
      clips,
      cursor: batch.cursor,
      hasNextPage: batch.hasNextPage,
      page: 0,
      nbPages: batch.nbPages,
      nbHits: batch.nbHits,
      query: "",
      source: batch.source,
      topics: BBC_TOPICS,
    });
  }

  const result = await searchBbcLive({
    query: q,
    topic,
    page,
    pageSize,
    signal: req.signal,
  });

  let clips = result.clips;
  if (g != null) {
    const filtered = clips.filter((c) => c.gradeMin <= g && c.gradeMax >= g);
    if (filtered.length > 0) clips = filtered;
    // else: keep all — never return empty
  }

  return Response.json({
    ok: true,
    mode: "search",
    clips,
    page: result.page,
    nbPages: result.nbPages,
    nbHits: result.nbHits,
    query: result.query,
    source: result.source,
    cursor: result.cursor,
    hasNextPage: result.hasNextPage,
    total: clips.length,
    topics: BBC_TOPICS,
  });
}
