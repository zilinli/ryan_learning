import {
  deleteServerConversation,
  getServerConversation,
  listServerConversations,
  upsertServerConversation,
  upsertServerConversations,
} from "@/lib/history-store";
import type { ConversationRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — all chats on this server (global history). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (sessionId) {
    const one = await getServerConversation(sessionId);
    if (!one) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ conversation: one });
  }
  const conversations = await listServerConversations();
  return Response.json({
    version: 3,
    conversations,
  });
}

/** PUT — upsert one or many conversations into global history. */
export async function PUT(req: Request) {
  let body: {
    conversation?: ConversationRecord;
    conversations?: ConversationRecord[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.conversation) {
    const saved = await upsertServerConversation(body.conversation);
    if (!saved) {
      return Response.json(
        { error: "Nothing to save (empty chat or bad id)" },
        { status: 400 },
      );
    }
    return Response.json({ ok: true, conversation: saved });
  }

  if (Array.isArray(body.conversations)) {
    const saved = await upsertServerConversations(body.conversations);
    return Response.json({ ok: true, saved });
  }

  return Response.json(
    { error: "Provide conversation or conversations[]" },
    { status: 400 },
  );
}

/** DELETE — remove a chat from global history (?sessionId=). */
export async function DELETE(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const ok = await deleteServerConversation(sessionId);
  return Response.json({ ok });
}
