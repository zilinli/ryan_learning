import { getNodeByToken, touchNode } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { token?: string; openclawVersion?: string; hostname?: string; bridgeVersion?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const node = await getNodeByToken(body.token?.trim() || "");
  if (!node) return Response.json({ error: "unknown node" }, { status: 401 });
  await touchNode(node.nodeId, {
    openclawVersion: body.openclawVersion,
    hostname: body.hostname,
    bridgeVersion: body.bridgeVersion,
  });
  return Response.json({ ok: true, nodeId: node.nodeId });
}
