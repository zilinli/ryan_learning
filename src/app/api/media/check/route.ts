import { existsSync } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEDIA_DIR = path.join(process.cwd(), "data", "media");

/** GET /api/media/check?ids=id1,id2,... — which media files exist on disk */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("ids");
  if (!raw) {
    return Response.json({ missing: [], ok: true }, { status: 200 });
  }

  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 120 && /^[A-Za-z0-9_-]+$/.test(s));

  if (!ids.length) {
    return Response.json({ missing: [], ok: true }, { status: 200 });
  }

  // Deduplicate and cap at 500 ids
  const unique = [...new Set(ids)].slice(0, 500);
  const missing: string[] = [];

  for (const id of unique) {
    const bin = path.join(MEDIA_DIR, `${id}.bin`);
    if (!existsSync(bin)) {
      missing.push(id);
    }
  }

  return Response.json({
    ok: true,
    total: unique.length,
    present: unique.length - missing.length,
    missing,
  });
}
