/**
 * GET /api/podcast/search
 * ?mode=search&q=&topic=&page=  → { ok, episodes: PodcastEpisodeHit[] }  (episode-first)
 * ?show=<id>                    → { ok, show, episodes } (RSS feed, disk-cached 6h)
 * (no params / legacy ?q=)      → { ok, shows } catalog (compat)
 */

import {
  findPodcastShow,
  PODCAST_CATALOG,
  resolveShowFeed,
  type PodcastTopic,
} from "@/lib/entertain/podcast-catalog";
import { fetchPodcastEpisodes } from "@/lib/entertain/podcast-rss";
import { searchPodcastEpisodes } from "@/lib/entertain/podcast-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOPIC_SET = new Set<string>([
  "ideas",
  "science",
  "society",
  "education",
  "creativity",
  "technology",
  "history",
  "kids",
]);

function parseTopic(raw: string | null): PodcastTopic | "all" {
  const t = String(raw || "")
    .trim()
    .toLowerCase();
  if (!t || t === "all") return "all";
  return TOPIC_SET.has(t) ? (t as PodcastTopic) : "all";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const showId = url.searchParams.get("show")?.trim().toLowerCase();
    const mode = url.searchParams.get("mode")?.trim().toLowerCase();
    const q = url.searchParams.get("q")?.trim() || "";
    const topic = parseTopic(url.searchParams.get("topic"));
    const page = Math.max(0, Number(url.searchParams.get("page") || 0) || 0);
    const pageSize = Math.max(
      6,
      Math.min(40, Number(url.searchParams.get("pageSize") || 24) || 24),
    );

    if (showId) {
      const show = findPodcastShow(showId);
      if (!show) {
        return Response.json({ ok: false, error: "Unknown show" }, { status: 404 });
      }
      const feedUrl = await resolveShowFeed(show);
      const episodes = await fetchPodcastEpisodes(feedUrl);
      return Response.json({ ok: true, show, episodes, feedUrl });
    }

    // Episode-first browse/search (TED-parity). Default when mode=search or
    // when client asks for episodes explicitly.
    if (mode === "search" || mode === "episodes" || url.searchParams.has("episodes")) {
      const result = await searchPodcastEpisodes({ query: q, topic, page, pageSize });
      return Response.json({ ok: true, ...result });
    }

    // Legacy: catalog of shows (kept for smoke scripts / older clients).
    const qLower = q.toLowerCase();
    const shows = qLower
      ? PODCAST_CATALOG.filter(
          (s) =>
            s.title.toLowerCase().includes(qLower) ||
            s.host.toLowerCase().includes(qLower) ||
            s.topics.some((t) => t.toLowerCase().includes(qLower)),
        )
      : PODCAST_CATALOG;
    return Response.json({ ok: true, shows });
  } catch (err) {
    console.error("[podcast/search]", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not load podcast feed",
      },
      { status: 500 },
    );
  }
}
