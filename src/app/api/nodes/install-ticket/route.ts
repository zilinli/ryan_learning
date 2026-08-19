import { peekPair } from "@/lib/nodes/store";
import { installKeysFromEnv } from "@/lib/nodes/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Short-lived install ticket authenticated by pair code (not admin token). */
export async function POST(req: Request) {
  let body: { pairCode?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const pair = await peekPair(body.pairCode?.trim() || "");
  if (!pair) return Response.json({ error: "invalid or expired pair code" }, { status: 400 });
  return Response.json({
    pairCode: pair.code,
    expiresAt: pair.expiresAt,
    keys: installKeysFromEnv(),
    sparkUrl: process.env.SPARK_PUBLIC_URL || "https://spark-tutor-for-ryan.duckdns.org",
  });
}
