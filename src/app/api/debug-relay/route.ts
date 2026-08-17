import { NextResponse } from "next/server";

/**
 * TEMPORARY debug relay (DEBUG MODE session 753d74).
 * Forwards client-side debug logs to the local ingest endpoint. Remove after
 * the debug session closes.
 */
const INGEST = "http://localhost:7381/ingest/21db5bcf-6623-4161-87dd-3095ab447d79";
const SESSION_ID = "753d74";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { message: "unparseable body", raw: raw.slice(0, 500) };
    }
    await fetch(INGEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": SESSION_ID,
      },
      body: JSON.stringify({ sessionId: SESSION_ID, ...payload }),
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
