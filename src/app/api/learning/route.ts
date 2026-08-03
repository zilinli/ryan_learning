import {
  readServerLearningMemory,
  upsertServerLearningMemory,
} from "@/lib/learning-memory-store";
import { normalizeMemory, type LearningMemory } from "@/lib/learning-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — shared learning memory for Ryan across devices */
export async function GET() {
  const memory = await readServerLearningMemory();
  return Response.json({ memory });
}

/** PUT — merge client learning memory into the server snapshot */
export async function PUT(req: Request) {
  let body: { memory?: LearningMemory };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.memory || typeof body.memory !== "object") {
    return Response.json({ error: "Missing memory" }, { status: 400 });
  }
  const saved = await upsertServerLearningMemory(normalizeMemory(body.memory));
  return Response.json({ ok: true, memory: saved });
}
