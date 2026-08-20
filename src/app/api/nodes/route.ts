import { listNodes } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Node roster is server-side; any PC can list. Pair/chat/alias still need admin. */
export async function GET() {
  const nodes = await listNodes();
  return Response.json(
    { nodes },
    { headers: { "cache-control": "no-store" } },
  );
}
