import { checkAdmin } from "@/lib/nodes/auth";
import { listNodes } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const nodes = await listNodes();
  return Response.json({ nodes });
}
