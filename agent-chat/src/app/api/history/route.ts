import { NextRequest, NextResponse } from "next/server";
import {
  listSessions,
  getConversation,
  upsertConversation,
  deleteConversation,
} from "@/lib/history-store";
import type { ConversationRecord } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    const conv = getConversation(sessionId);
    if (!conv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(conv);
  }

  const sessions = listSessions();
  return NextResponse.json(sessions);
}

export async function PUT(req: NextRequest) {
  try {
    const body: ConversationRecord = await req.json();
    if (!body.sessionId || !body.messages) {
      return NextResponse.json({ error: "Invalid record" }, { status: 400 });
    }
    upsertConversation(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  deleteConversation(sessionId);
  return NextResponse.json({ ok: true });
}
