import {
  readServerLearningMemory,
  upsertServerLearningMemory,
} from "@/lib/learning-memory-store";
import { normalizeMemory, type LearningMemory } from "@/lib/learning-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — account-scoped learning memory */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") || "default";
  const memory = await readServerLearningMemory(accountId);
  return Response.json({ memory });
}

/** PUT — merge client learning memory into the server snapshot */
export async function PUT(req: Request) {
  let body: { memory?: LearningMemory; accountId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.memory || typeof body.memory !== "object") {
    return Response.json({ error: "Missing memory" }, { status: 400 });
  }
  const accountId = body.accountId || "default";
  const saved = await upsertServerLearningMemory(normalizeMemory(body.memory), accountId);
  return Response.json({ ok: true, memory: saved });
}
