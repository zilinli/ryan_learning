/**
 * Resolve BBC clip from catalog or live search payload (TED-parity caption pipeline).
 */

import type { BbcClip, BbcTopic } from "./bbc-catalog";
import { findBbcClip, BBC_TOPICS } from "./bbc-catalog";

const TOPICS = new Set<BbcTopic>(BBC_TOPICS);

export function resolveBbcClip(
  videoId: string,
  raw?: unknown,
): BbcClip | null {
  const id = String(videoId || "").trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  const found = findBbcClip(id);
  if (found) return found;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const bodyId = String(c.videoId || "").trim();
  if (bodyId && bodyId !== id) return null;
  const topicRaw = String(c.topic || "science");
  const topic = TOPICS.has(topicRaw as BbcTopic)
    ? (topicRaw as BbcTopic)
    : "science";
  return {
    videoId: id,
    title: String(c.title || id).trim().slice(0, 200) || id,
    series: String(c.series || "YouTube").trim().slice(0, 80) || "YouTube",
    topic,
    durationSec: Math.max(
      30,
      Math.round(Number(c.durationSec) || 240),
    ),
    gradeMin: Math.max(1, Math.min(12, Math.round(Number(c.gradeMin) || 4))),
    gradeMax: Math.max(1, Math.min(12, Math.round(Number(c.gradeMax) || 10))),
    blurb: String(c.blurb || "").trim().slice(0, 400),
    channel: String(c.channel || "BBC").trim().slice(0, 80) || "BBC",
  };
}
