import {
  RSA_CATALOG,
  RSA_TOPICS,
  searchRsaCatalog,
  type RsaTopic,
} from "@/lib/entertain/rsa-catalog";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const topicRaw = url.searchParams.get("topic") || "";
  const gradeRaw = url.searchParams.get("grade") || "";

  const topic: RsaTopic | undefined = RSA_TOPICS.includes(
    topicRaw as RsaTopic,
  )
    ? (topicRaw as RsaTopic)
    : undefined;

  let results = searchRsaCatalog(q, topic);

  const grade = gradeRaw ? Number(gradeRaw) : undefined;
  if (typeof grade === "number" && Number.isFinite(grade)) {
    const g = normalizeLearnerGrade(grade);
    results = results.filter((v) => v.gradeMin <= g && v.gradeMax >= g);
  }

  return Response.json({
    ok: true,
    videos: results.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      speaker: v.speaker,
      series: v.series,
      topic: v.topic,
      durationSec: v.durationSec,
      gradeMin: v.gradeMin,
      gradeMax: v.gradeMax,
      blurb: v.blurb,
    })),
    total: results.length,
    topics: RSA_TOPICS,
  });
}
