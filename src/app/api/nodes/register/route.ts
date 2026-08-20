import { consumePair, registerNode } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    pairCode?: string;
    hostname?: string;
    platform?: string;
    openclawVersion?: string;
    bridgeVersion?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const code = body.pairCode?.trim();
  if (!code) return Response.json({ error: "missing pairCode" }, { status: 400 });
  const ok = await consumePair(code);
  if (!ok) return Response.json({ error: "invalid or expired pair code" }, { status: 400 });
  const node = await registerNode({
    hostname: body.hostname || "pc",
    platform: body.platform || "win32",
    openclawVersion: body.openclawVersion || "",
    bridgeVersion: body.bridgeVersion || "",
  });
  return Response.json({
    nodeId: node.nodeId,
    token: node.token,
  });
}
