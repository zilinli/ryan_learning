/**
 * POST /api/creations/share — { accountId, id } → { shareToken, url path }
 * Creates a public share token for song / video / image creations.
 */

import {
  ensureCreationShareToken,
  loadCreations,
} from "@/lib/entertain/creations-store";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { mediaExists } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeAccount(id: string | null | undefined): string {
  const s = (id || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return s || "acct_ryan";
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "creations-share", RATE_PRESETS.entertain);
  if (limited) return limited;

  let body: { accountId?: string; id?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = safeAccount(body.accountId);
  const id = String(body.id || "").slice(0, 80);
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const before = await loadCreations(accountId);
  const item = before.items.find((i) => i.id === id);
  if (!item) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (item.type !== "song" && item.type !== "video" && item.type !== "image") {
    return Response.json(
      { ok: false, error: "Only songs, videos, and images can be shared" },
      { status: 400 },
    );
  }
  if (item.type === "song") {
    if (!item.audioMediaId || !(await mediaExists(item.audioMediaId))) {
      return Response.json(
        { ok: false, error: "Song has no playable audio" },
        { status: 400 },
      );
    }
  }
  if (item.type === "video" || item.type === "image") {
    if (!item.mediaId || !(await mediaExists(item.mediaId))) {
      return Response.json(
        { ok: false, error: "Media file missing" },
        { status: 400 },
      );
    }
  }

  const shared = await ensureCreationShareToken(accountId, id);
  if (!shared?.shareToken) {
    return Response.json({ ok: false, error: "Share failed" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    shareToken: shared.shareToken,
    path: `/share/c/${encodeURIComponent(shared.shareToken)}`,
    item: shared,
  });
}
