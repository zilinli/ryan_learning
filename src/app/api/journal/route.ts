/**
 * GET /api/journal?accountId=&month=&id=
 * POST /api/journal — new entry
 * PUT /api/journal — update prose
 * DELETE /api/journal — { accountId, id }
 */

import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  loadAllJournals,
  loadJournal,
  praiseJournalEntry,
  removeJournalMadeBlock,
  updateJournalEntry,
} from "@/lib/entertain/journal-store";
import { readServerAccounts } from "@/lib/accounts-store";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeAccount(id: string | null | undefined): string {
  const s = (id || "acct_ryan").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return s || "acct_ryan";
}

export async function GET(req: Request) {
  const limited = checkApiRateLimit(req, "journal-get", RATE_PRESETS.entertain);
  if (limited) return limited;
  const url = new URL(req.url);
  const accountId = safeAccount(url.searchParams.get("accountId"));
  const id = String(url.searchParams.get("id") || "").slice(0, 80);
  if (id) {
    const item = await getJournalEntry(accountId, id);
    if (!item) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return Response.json({ ok: true, item });
  }
  // Everyone view: aggregate every account's journal and attach each row's
  // author display name (fallback: the raw accountId).
  const scope = String(url.searchParams.get("scope") || "").slice(0, 8);
  if (scope === "all") {
    const [items, accts] = await Promise.all([
      loadAllJournals(),
      readServerAccounts().catch(() => null),
    ]);
    const names = new Map<string, string>();
    for (const a of accts?.accounts || []) {
      names.set(a.id, a.profile.name || a.id);
    }
    const withAuthor = items.map((e) => ({
      ...e,
      authorName: names.get(e.accountId) || e.accountId,
    }));
    return Response.json({ ok: true, items: withAuthor });
  }
  const month = String(url.searchParams.get("month") || "").slice(0, 7);
  const store = await loadJournal(accountId);
  const items = month
    ? store.items.filter((e) => e.date.startsWith(month))
    : store.items;
  return Response.json({ ok: true, items });
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "journal-post", RATE_PRESETS.entertain);
  if (limited) return limited;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const accountId = safeAccount(String(body.accountId || ""));
  const item = await createJournalEntry(accountId, {
    date: body.date ? String(body.date).slice(0, 10) : undefined,
    body: body.body ? String(body.body) : undefined,
    title: body.title ? String(body.title) : undefined,
    prompt: body.prompt ? String(body.prompt) : undefined,
    writingType: body.writingType ? String(body.writingType).slice(0, 32) : "journal",
  });
  return Response.json({ ok: true, item });
}

export async function PUT(req: Request) {
  const limited = checkApiRateLimit(req, "journal-put", RATE_PRESETS.entertain);
  if (limited) return limited;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const accountId = safeAccount(String(body.accountId || ""));
  const id = String(body.id || "").slice(0, 80);
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const item = await updateJournalEntry(accountId, id, {
    body: body.body !== undefined ? String(body.body) : undefined,
    title: body.title !== undefined ? String(body.title) : undefined,
    date: body.date !== undefined ? String(body.date).slice(0, 10) : undefined,
    prompt: body.prompt !== undefined ? String(body.prompt) : undefined,
  });
  if (!item) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true, item });
}

export async function DELETE(req: Request) {
  const limited = checkApiRateLimit(req, "journal-del", RATE_PRESETS.entertain);
  if (limited) return limited;
  let body: { accountId?: string; id?: string; creationId?: string } = {};
  try {
    body = (await req.json()) as {
      accountId?: string;
      id?: string;
      creationId?: string;
    };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const accountId = safeAccount(body.accountId);
  const id = String(body.id || "").slice(0, 80);
  if (!id) {
    return Response.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const creationId = String(body.creationId || "").slice(0, 80);
  const ok = creationId
    ? await removeJournalMadeBlock(accountId, id, creationId)
    : await deleteJournalEntry(accountId, id);
  return Response.json({ ok });
}

/**
 * PATCH /api/journal — V2 §9.4.3 praise write-back on the Everyone wall.
 * Body: { targetAccountId, id, fromAccountId, note? }. Toggles the like for
 * `fromAccountId`; a non-empty note attaches a one-line encouragement.
 * Self-praise is rejected.
 */
export async function PATCH(req: Request) {
  const limited = checkApiRateLimit(req, "journal-patch", RATE_PRESETS.entertain);
  if (limited) return limited;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const targetAccountId = safeAccount(String(body.targetAccountId || ""));
  const fromAccountId = safeAccount(String(body.fromAccountId || ""));
  const id = String(body.id || "").slice(0, 80);
  if (!id || !targetAccountId || !fromAccountId) {
    return Response.json({ ok: false, error: "Missing id/account" }, { status: 400 });
  }
  if (targetAccountId === fromAccountId) {
    return Response.json({ ok: false, error: "No self-praise" }, { status: 400 });
  }
  let name: string | undefined;
  const accts = await readServerAccounts().catch(() => null);
  const fromProfile = accts?.accounts.find((a) => a.id === fromAccountId);
  if (fromProfile) name = fromProfile.profile.name || fromAccountId;
  const item = await praiseJournalEntry(targetAccountId, id, {
    accountId: fromAccountId,
    name,
    note: body.note !== undefined ? String(body.note) : undefined,
  });
  if (!item) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true, item });
}
