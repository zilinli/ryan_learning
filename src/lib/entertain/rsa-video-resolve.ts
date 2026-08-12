/**
 * Resolve RSA video from catalog or live search payload.
 */

import type { RsaTopic, RsaVideo } from "./rsa-catalog";
import { findRsaVideo, RSA_TOPICS } from "./rsa-catalog";

const TOPICS = new Set<RsaTopic>(RSA_TOPICS);
const SERIES = new Set(["Animate", "Shorts", "Minimate"]);

export function resolveRsaVideo(
  videoId: string,
  raw?: unknown,
): RsaVideo | null {
  const id = String(videoId || "").trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  const found = findRsaVideo(id);
  if (found) return found;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const bodyId = String(c.videoId || "").trim();
  if (bodyId && bodyId !== id) return null;
  const topicRaw = String(c.topic || "ideas");
  const topic = TOPICS.has(topicRaw as RsaTopic)
    ? (topicRaw as RsaTopic)
    : "ideas";
  const seriesRaw = String(c.series || "Shorts");
  const series = SERIES.has(seriesRaw)
    ? (seriesRaw as RsaVideo["series"])
    : "Shorts";
  return {
    videoId: id,
    title: String(c.title || id).trim().slice(0, 200) || id,
    speaker: String(c.speaker || "RSA").trim().slice(0, 80) || "RSA",
    series,
    topic,
    durationSec: Math.max(30, Math.round(Number(c.durationSec) || 360)),
    gradeMin: Math.max(1, Math.min(12, Math.round(Number(c.gradeMin) || 6))),
    gradeMax: Math.max(1, Math.min(12, Math.round(Number(c.gradeMax) || 12))),
    blurb: String(c.blurb || "").trim().slice(0, 400),
  };
}
