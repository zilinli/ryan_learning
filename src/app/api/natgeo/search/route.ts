/**
 * GET /api/natgeo/search
 * Query: ?q=&topic=&grade=
 * Returns curated catalog filtered by query, topic, and grade range.
 */

import {
  NATGEO_CATALOG,
  NATGEO_TOPICS,
  searchNatGeoCatalog,
  type NatGeoTopic,
} from "@/lib/entertain/natgeo-catalog";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const topicRaw = url.searchParams.get("topic") || "";
  const gradeRaw = url.searchParams.get("grade") || "";
  const grade = gradeRaw ? Number(gradeRaw) : undefined;

  const topic: NatGeoTopic | undefined = NATGEO_TOPICS.includes(
    topicRaw as NatGeoTopic,
  )
    ? (topicRaw as NatGeoTopic)
    : undefined;

  let results = searchNatGeoCatalog(q, topic);

  if (typeof grade === "number" && Number.isFinite(grade)) {
    const g = normalizeLearnerGrade(grade);
    results = results.filter((a) => a.gradeMin <= g && a.gradeMax >= g);
  }

  return Response.json({
    ok: true,
    articles: results.map((a) => ({
      slug: a.slug,
      title: a.title,
      topic: a.topic,
      gradeMin: a.gradeMin,
      gradeMax: a.gradeMax,
      readingTimeMin: a.readingTimeMin,
      blurb: a.blurb,
      imageUrl: a.imageUrl,
    })),
    total: results.length,
    topics: NATGEO_TOPICS,
  });
}
