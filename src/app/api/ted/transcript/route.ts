/**
 * GET /api/ted/transcript?slug=
 * Fetches English transcript for challenge generation (cached). Does not expose a transcript browser UI.
 */

import { fetchTedTranscript } from "@/lib/entertain/ted-transcript";
import { findTedTalk, parseTedSlug } from "@/lib/entertain/ted-catalog";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = checkApiRateLimit(req, "ted-transcript", RATE_PRESETS.entertain);
  if (limited) return limited;

  const url = new URL(req.url);
  const slug = parseTedSlug(url.searchParams.get("slug") || "");
  if (!slug) {
    return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
  }

  const talk = findTedTalk(slug);
  const { text, source } = await fetchTedTranscript(slug);
  return Response.json({
    ok: true,
    slug,
    title: talk?.title,
    speaker: talk?.speaker,
    source,
    chars: text.length,
    /** Truncated preview only — full text stays server-side for challenge API */
    preview: text.slice(0, 280),
    hasTranscript: text.length > 80,
  });
}
