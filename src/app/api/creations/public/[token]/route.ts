/**
 * GET /api/creations/public/[token]
 * Public metadata for a shared Studio creation (no account required).
 */

import { findCreationByShareToken } from "@/lib/entertain/creations-store";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { mediaExists } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const limited = checkApiRateLimit(_req, "creations-public", RATE_PRESETS.entertain);
  if (limited) return limited;

  const { token: raw } = await ctx.params;
  const token = decodeURIComponent(raw || "").trim();
  const item = await findCreationByShareToken(token);
  if (!item) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const mediaId =
    item.type === "song" ? item.audioMediaId : item.mediaId;
  if (!mediaId || !(await mediaExists(mediaId))) {
    return Response.json(
      { ok: false, error: "Media missing" },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    creation: {
      id: item.id,
      type: item.type,
      title: item.title,
      createdAt: item.createdAt,
      caption: item.caption?.slice(0, 280),
      lyrics:
        item.type === "song" && item.lyrics
          ? item.lyrics.slice(0, 2000)
          : undefined,
      mediaUrl: `/api/media/${encodeURIComponent(mediaId)}`,
    },
  });
}
