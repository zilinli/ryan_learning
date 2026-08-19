import { checkAdmin } from "@/lib/nodes/auth";
import { createPair, PAIR_TTL_MS } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const pair = await createPair();
  return Response.json({
    code: pair.code,
    expiresAt: pair.expiresAt,
    ttlMs: PAIR_TTL_MS,
  });
}
