import {
  readServerInterests,
  upsertServerInterests,
} from "@/lib/interest-store-server";
import type { InterestRecord } from "@/lib/interest-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — account-scoped interest profile */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") || "default";
  const interests = await readServerInterests(accountId);
  return Response.json({ interests });
}

/** PUT — merge client interests into the server snapshot */
export async function PUT(req: Request) {
  let body: { accountId?: string; interests?: InterestRecord[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.interests)) {
    return Response.json({ error: "Missing interests" }, { status: 400 });
  }
  const accountId = body.accountId || "default";
  const saved = await upsertServerInterests(body.interests, accountId);
  return Response.json({ ok: true, interests: saved });
}
