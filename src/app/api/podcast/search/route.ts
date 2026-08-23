/**
 * GET /api/podcast/search
 * ?show=<id>        → { ok, show, episodes } (RSS feed, disk-cached 6h)
 * (no params)       → { ok, shows } catalog grid
 * ?q=<term>         → catalog filtered by title/host/topics
 */

import { findPodcastShow, PODCAST_CATALOG } from "@/lib/entertain/podcast-catalog";
import { fetchPodcastEpisodes } from "@/lib/entertain/podcast-rss";
import { resolveShowFeed } from "@/lib/entertain/podcast-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const showId = url.searchParams.get("show")?.trim().toLowerCase();
    const q = url.searchParams.get("q")?.trim().toLowerCase();

    if (showId) {
      const show = findPodcastShow(showId);
      if (!show) {
        return Response.json({ ok: false, error: "Unknown show" }, { status: 404 });
      }
      const feedUrl = await resolveShowFeed(show);
      const episodes = await fetchPodcastEpisodes(feedUrl);
      return Response.json({ ok: true, show, episodes, feedUrl });
    }

    const shows = q
      ? PODCAST_CATALOG.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.host.toLowerCase().includes(q) ||
            s.topics.some((t) => t.toLowerCase().includes(q)),
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
