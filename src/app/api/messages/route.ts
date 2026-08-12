import { NextRequest, NextResponse } from "next/server";
import { loadMessages, addMessage, markRead, unreadCount } from "@/lib/parent-messages";

function newId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get("accountId");
    const countOnly = req.nextUrl.searchParams.get("countOnly") === "1";
    if (!accountId) {
      return NextResponse.json({ error: "accountId required" }, { status: 400 });
    }
    if (countOnly) {
      const count = await unreadCount(accountId);
      return NextResponse.json({ unreadCount: count });
    }
    const store = await loadMessages(accountId);
    return NextResponse.json({
      messages: store.messages,
      unreadCount: store.messages.filter((m) => !m.publicReadAt).length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { toAccountId, fromAccountId, fromName, title, body: msgBody, urgency, attachments } = body;
    if (!toAccountId || !fromAccountId || !title || !msgBody) {
      return NextResponse.json({ error: "toAccountId, fromAccountId, title, body required" }, { status: 400 });
    }
    const msg = {
      id: newId(),
      fromAccountId: String(fromAccountId),
      fromName: String(fromName || "Parent"),
      toAccountId: String(toAccountId),
      title: String(title).slice(0, 200),
      body: String(msgBody),
      urgency: (["routine", "important", "urgent"].includes(urgency) ? urgency : "routine") as "routine" | "important" | "urgent",
      createdAt: Date.now(),
      attachments: Array.isArray(attachments) ? attachments : undefined,
    };
    await addMessage(toAccountId, msg);
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, messageId, silent } = body;
    if (!accountId || !messageId) {
      return NextResponse.json({ error: "accountId and messageId required" }, { status: 400 });
    }
    await markRead(accountId, messageId, silent === true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
