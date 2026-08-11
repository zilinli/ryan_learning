/**
 * GET /api/creations?accountId=
 * POST /api/creations — body: Creation fields + accountId
 * DELETE /api/creations — body: { accountId, id }
 */

import {
  addCreation,
  deleteCreation,
  loadCreations,
  type CreationType,
} from "@/lib/entertain/creations-store";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeAccount(id: string | null | undefined): string {
  const s = (id || "acct_ryan").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return s || "acct_ryan";
}

export async function GET(req: Request) {
  const limited = checkApiRateLimit(req, "creations-get", RATE_PRESETS.entertain);
  if (limited) return limited;
  const url = new URL(req.url);
  const accountId = safeAccount(url.searchParams.get("accountId"));
  const store = await loadCreations(accountId);
  return Response.json({ ok: true, items: store.items });
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "creations-post", RATE_PRESETS.entertain);
  if (limited) return limited;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const accountId = safeAccount(String(body.accountId || ""));
  const type = body.type as CreationType;
  if (type !== "ted_challenge" && type !== "song") {
    return Response.json({ ok: false, error: "Invalid type" }, { status: 400 });
  }
  const title = String(body.title || "Untitled").slice(0, 160);
  const item = await addCreation(accountId, {
    type,
    title,
    talkSlug: body.talkSlug ? String(body.talkSlug).slice(0, 120) : undefined,
    notes: body.notes ? String(body.notes).slice(0, 4000) : undefined,
    lyrics: body.lyrics ? String(body.lyrics).slice(0, 8000) : undefined,
    caption: body.caption ? String(body.caption).slice(0, 500) : undefined,
    audioMediaId: body.audioMediaId
      ? String(body.audioMediaId).slice(0, 80)
      : undefined,
    challengeScore: body.challengeScore
      ? String(body.challengeScore).slice(0, 500)
      : undefined,
  });
  return Response.json({ ok: true, item });
}

export async function DELETE(req: Request) {
  const limited = checkApiRateLimit(req, "creations-del", RATE_PRESETS.entertain);
  if (limited) return limited;
  let body: { accountId?: string; id?: string } = {};
  try {
    body = (await req.json()) as { accountId?: string; id?: string };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const accountId = safeAccount(body.accountId);
  const id = String(body.id || "").slice(0, 80);
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const ok = await deleteCreation(accountId, id);
  return Response.json({ ok });
}
