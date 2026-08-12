/**
 * GET /api/messages?accountId=&countOnly=1
 * POST /api/messages — send
 * PATCH /api/messages — mark read
 * DELETE /api/messages — { accountId, messageId }
 */

import {
  loadMessages,
  addMessage,
  markRead,
  unreadCount,
  deleteMessage,
} from "@/lib/parent-messages";

function newId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId");
    const countOnly = url.searchParams.get("countOnly") === "1";
    if (!accountId) {
      return Response.json({ error: "accountId required" }, { status: 400 });
    }
    if (countOnly) {
      const count = await unreadCount(accountId);
      return Response.json({ unreadCount: count });
    }
    const store = await loadMessages(accountId);
    return Response.json({
      messages: store.messages,
      unreadCount: store.messages.filter((m) => !m.publicReadAt).length,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const toAccountId = String(body.toAccountId || "");
    const fromAccountId = String(body.fromAccountId || "");
    const title = String(body.title || "");
    const msgBody = String(body.body || "");
    if (!toAccountId || !fromAccountId || !title || !msgBody) {
      return Response.json(
        { error: "toAccountId, fromAccountId, title, body required" },
        { status: 400 },
      );
    }
    const urgencyRaw = String(body.urgency || "routine");
    const msg = {
      id: newId(),
      fromAccountId,
      fromName: String(body.fromName || "Parent"),
      toAccountId,
      title: title.slice(0, 200),
      body: msgBody,
      urgency: (["routine", "important", "urgent"].includes(urgencyRaw)
        ? urgencyRaw
        : "routine") as "routine" | "important" | "urgent",
      createdAt: Date.now(),
      attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
    };
    await addMessage(toAccountId, msg as never);
    return Response.json({ ok: true, message: msg });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      accountId?: string;
      messageId?: string;
      silent?: boolean;
    };
    if (!body.accountId || !body.messageId) {
      return Response.json(
        { error: "accountId and messageId required" },
        { status: 400 },
      );
    }
    await markRead(body.accountId, body.messageId, body.silent === true);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as {
      accountId?: string;
      messageId?: string;
    };
    const accountId = String(body.accountId || "").slice(0, 64);
    const messageId = String(body.messageId || "").slice(0, 80);
    if (!accountId || !messageId) {
      return Response.json(
        { error: "accountId and messageId required" },
        { status: 400 },
      );
    }
    const ok = await deleteMessage(accountId, messageId);
    return Response.json({ ok });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
