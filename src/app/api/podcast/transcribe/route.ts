/**
 * POST /api/podcast/transcribe   { show, episode } → start job (or cached done)
 * GET  /api/podcast/transcribe?id=<jobId>         → poll job progress
 *
 * The heavy work (DashScope filetrans / local whisper) runs in the background;
 * the client polls GET every ~5s and unlocks the challenge when status=done.
 */

import { findPodcastShow } from "@/lib/entertain/podcast-catalog";
import {
  getPodcastTranscriptJob,
  requestPodcastTranscript,
} from "@/lib/entertain/podcast-transcript";
import type { PodcastEpisode } from "@/lib/entertain/podcast-rss";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sanitizeEpisode(raw: unknown): PodcastEpisode | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const guid = String(e.guid || "").trim();
  const title = String(e.title || "").trim();
  const audioUrl = String(e.audioUrl || "").trim();
  if (!guid || !audioUrl || !/^https?:\/\//i.test(audioUrl)) return null;
  return {
    guid: guid.slice(0, 240),
    title: title || guid,
    description: String(e.description || "").slice(0, 1200),
    audioUrl,
    durationSec: Number(e.durationSec) || 0,
    pubDate: String(e.pubDate || ""),
    categories: Array.isArray(e.categories)
      ? e.categories.map((c) => String(c).slice(0, 80)).filter(Boolean).slice(0, 12)
      : [],
  };
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "podcast-transcribe", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: { show?: unknown; episode?: unknown } = {};
  try {
    body = (await req.json()) as { show?: unknown; episode?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const show = findPodcastShow(
    (body.show as { id?: string } | null | undefined)?.id,
  );
  const episode = sanitizeEpisode(body.episode);
  if (!show || !episode) {
    return Response.json(
      { ok: false, error: "showId or episode missing" },
      { status: 400 },
    );
  }

  try {
    const job = await requestPodcastTranscript(show, episode);
    return Response.json({ ok: true, job });
  } catch (err) {
    console.error("[podcast/transcribe]", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not start transcription",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const job = await getPodcastTranscriptJob(id);
    if (!job) {
      return Response.json({ ok: false, error: "Unknown job" }, { status: 404 });
    }
    return Response.json({ ok: true, job });
  } catch (err) {
    console.error("[podcast/transcribe]", err);
    return Response.json(
      { ok: false, error: "Could not read transcript job" },
      { status: 500 },
    );
  }
}
