import { NextResponse } from "next/server";
import {
  appendDialectFeedback,
  type DialectFeedback,
} from "@/lib/dialect-feedback";

/** POST — append one dialect feedback record to data/dialect-feedback.jsonl. */
export async function POST(req: Request) {
  let body: DialectFeedback;
  try {
    body = (await req.json()) as DialectFeedback;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (body.dialect !== "teo" && body.dialect !== "hak") {
    return NextResponse.json({ error: "Unsupported dialect" }, { status: 400 });
  }

  try {
    await appendDialectFeedback(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to write feedback" }, { status: 500 });
  }
}
