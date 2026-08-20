import { checkAdmin } from "@/lib/nodes/auth";
import { updateNodeAlias } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ nodeId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  if (!checkAdmin(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { nodeId } = await params;
  let body: { alias?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const ok = await updateNodeAlias(nodeId, String(body.alias ?? ""));
  if (!ok) return Response.json({ error: "node not found" }, { status: 404 });
  return Response.json({ ok: true, nodeId, alias: String(body.alias ?? "").trim() });
}
