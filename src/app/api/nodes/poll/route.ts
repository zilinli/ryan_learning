import { getNodeByToken, touchNode, waitCommand } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim() || "";
  const node = await getNodeByToken(token);
  if (!node) return Response.json({ error: "unknown node" }, { status: 401 });
  await touchNode(node.nodeId);
  const cmd = await waitCommand(node.nodeId, 25_000);
  return Response.json({ command: cmd });
}
