import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  RSA_TOPICS,
  type RsaTopic,
} from "@/lib/entertain/rsa-catalog";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";
import {
  refreshRsaBatch,
  searchRsaLive,
} from "@/lib/entertain/rsa-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPICS = new Set<RsaTopic>(RSA_TOPICS);

function parseTopic(raw: string | null): RsaTopic | "all" {
  const t = String(raw || "all").toLowerCase();
  if (t === "all") return "all";
  if (TOPICS.has(t as RsaTopic)) return t as RsaTopic;
  return "all";
}

export async function GET(req: Request) {
  const limited = checkApiRateLimit(req, "rsa-search", RATE_PRESETS.entertain);
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
    const batch = await refreshRsaBatch({
      cursor,
      pageSize,
      signal: req.signal,
    });
    let videos = batch.videos;
    if (g != null) {
      const filtered = videos.filter((v) => v.gradeMin <= g && v.gradeMax >= g);
      if (filtered.length > 0) videos = filtered;
      // else: keep all videos — never return empty from refresh
    }
    return Response.json({
      ok: true,
      mode: "refresh",
      videos,
      cursor: batch.cursor,
      hasNextPage: batch.hasNextPage,
      page: 0,
      nbPages: batch.nbPages,
      nbHits: batch.nbHits,
      query: "",
      source: batch.source,
      topics: RSA_TOPICS,
    });
  }

  const result = await searchRsaLive({
    query: q,
    topic,
    page,
    pageSize,
    signal: req.signal,
  });

  let videos = result.videos;
  if (g != null) {
    const filtered = videos.filter((v) => v.gradeMin <= g && v.gradeMax >= g);
    if (filtered.length > 0) videos = filtered;
    // else: keep all — never return empty
  }

  return Response.json({
    ok: true,
    mode: "search",
    videos,
    page: result.page,
    nbPages: result.nbPages,
    nbHits: result.nbHits,
    query: result.query,
    source: result.source,
    cursor: result.cursor,
    hasNextPage: result.hasNextPage,
    total: videos.length,
    topics: RSA_TOPICS,
  });
}
