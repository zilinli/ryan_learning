import {
  deleteServerConversation,
  findSessionOwner,
  getServerConversation,
  historyStats,
  listServerConversations,
  searchServerConversations,
  upsertServerConversation,
  upsertServerConversations,
} from "@/lib/history-store";
import { readDeletionLog } from "@/lib/deletion-log";
import type { ConversationRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAccountId(req: Request): string {
  const url = new URL(req.url);
  return url.searchParams.get("accountId") || "default";
}

/** GET — all chats, optional ?q= keyword search, ?sessionId=, ?stats=1, ?accountId=, ?lookupSession= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = getAccountId(req);

  // Cross-account deep-link: which student owns this session?
  const lookupSession = url.searchParams.get("lookupSession");
  if (lookupSession) {
    const hit = await findSessionOwner(lookupSession);
    if (!hit) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({
      accountId: hit.accountId,
      conversation: hit.conversation,
    });
  }

  const sessionId = url.searchParams.get("sessionId");
  if (sessionId) {
    const one = await getServerConversation(sessionId, accountId);
    if (!one) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ conversation: one });
  }

  if (url.searchParams.get("stats") === "1") {
    const stats = await historyStats(accountId);
    return Response.json({ stats });
  }

  const q = (url.searchParams.get("q") || "").trim();
  if (q) {
    const hits = await searchServerConversations(q, accountId);
    return Response.json({
      version: 3,
      query: q,
      conversations: hits.map((h) => h.conversation),
      hits: hits.map((h) => ({
        sessionId: h.conversation.sessionId,
        matchedTitle: h.matchedTitle,
        snippet: h.snippet,
      })),
    });
  }

  const conversations = await listServerConversations(accountId);
  const stats = await historyStats(accountId);
  const deletions = await readDeletionLog(accountId);
  return Response.json({
    version: 3,
    conversations,
    deletions,
    stats,
  });
}

/** PUT — upsert one or many conversations into account-scoped history. */
export async function PUT(req: Request) {
  let body: {
    conversation?: ConversationRecord;
    conversations?: ConversationRecord[];
    accountId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = body.accountId || "default";

  if (body.conversation) {
    const saved = await upsertServerConversation(body.conversation, accountId);
    if (!saved) {
      return Response.json(
        { error: "Nothing to save (empty chat or bad id)" },
        { status: 400 },
      );
    }
    return Response.json({ ok: true, conversation: saved });
  }

  if (Array.isArray(body.conversations)) {
    const saved = await upsertServerConversations(body.conversations, accountId);
    return Response.json({ ok: true, saved: saved.length, conversations: saved });
  }

  return Response.json(
    { error: "Provide conversation or conversations[]" },
    { status: 400 },
  );
}

/** DELETE — remove a chat from account-scoped history (?sessionId=&accountId=). */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const accountId = getAccountId(req);
  const ok = await deleteServerConversation(sessionId, accountId);
  return Response.json({ ok });
}
