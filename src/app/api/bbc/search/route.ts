import {
  BBC_CATALOG,
  BBC_TOPICS,
  searchBbcCatalog,
  type BbcTopic,
} from "@/lib/entertain/bbc-catalog";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const topicRaw = url.searchParams.get("topic") || "";
  const gradeRaw = url.searchParams.get("grade") || "";

  const topic: BbcTopic | undefined = BBC_TOPICS.includes(
    topicRaw as BbcTopic,
  )
    ? (topicRaw as BbcTopic)
    : undefined;

  let results = searchBbcCatalog(q, topic);

  const grade = gradeRaw ? Number(gradeRaw) : undefined;
  if (typeof grade === "number" && Number.isFinite(grade)) {
    const g = normalizeLearnerGrade(grade);
    results = results.filter((c) => c.gradeMin <= g && c.gradeMax >= g);
  }

  return Response.json({
    ok: true,
    clips: results.map((c) => ({
      videoId: c.videoId,
      title: c.title,
      series: c.series,
      topic: c.topic,
      durationSec: c.durationSec,
      gradeMin: c.gradeMin,
      gradeMax: c.gradeMax,
      blurb: c.blurb,
      channel: c.channel,
    })),
    total: results.length,
    topics: BBC_TOPICS,
  });
}
