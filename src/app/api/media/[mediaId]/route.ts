import { readMedia } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ mediaId: string }> };

/** GET /api/media/:mediaId — homework photo for history chats */
export async function GET(_req: Request, ctx: Ctx) {
  const { mediaId: raw } = await ctx.params;
  const mediaId = (raw || "").trim();
  if (!mediaId || mediaId.length > 120 || !/^[A-Za-z0-9_-]+$/.test(mediaId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const hit = await readMedia(mediaId);
  if (!hit) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(new Uint8Array(hit.buf), {
    status: 200,
    headers: {
      "Content-Type": hit.mimeType || "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": String(hit.buf.length),
    },
  });
}
