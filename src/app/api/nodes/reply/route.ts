import { getNodeByToken, publishReply, touchNode } from "@/lib/nodes/store";
import type { NodeReplyEvent } from "@/lib/nodes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: NodeReplyEvent & { token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const node = await getNodeByToken(body.token?.trim() || "");
  if (!node) return Response.json({ error: "unknown node" }, { status: 401 });
  await touchNode(node.nodeId);
  if (!body.requestId || !body.type) {
    return Response.json({ error: "missing requestId/type" }, { status: 400 });
  }
  publishReply(body);
  return Response.json({ ok: true });
}
