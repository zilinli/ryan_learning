import { readMedia } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ mediaId: string }> };

function safeDownloadName(name: string | undefined, mimeType: string): string {
  const raw = (name || "").replace(/[/\\?%*:|"<>]/g, "_").trim();
  if (raw) return raw.slice(0, 120);
  if (mimeType.includes("pdf")) return "homework.pdf";
  if (mimeType.startsWith("image/")) return "photo.jpg";
  if (mimeType.startsWith("text/")) return "notes.txt";
  return "attachment.bin";
}

/** GET /api/media/:mediaId — homework photo/file for history chats */
export async function GET(req: Request, ctx: Ctx) {
  const { mediaId: raw } = await ctx.params;
  const mediaId = (raw || "").trim();
  if (!mediaId || mediaId.length > 120 || !/^[A-Za-z0-9_-]+$/.test(mediaId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const hit = await readMedia(mediaId);
  if (!hit) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const forceDownload = url.searchParams.get("download") === "1";
  const isImage = (hit.mimeType || "").startsWith("image/");
  const filename = safeDownloadName(hit.name, hit.mimeType);
  const disposition =
    forceDownload || !isImage
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

  return new Response(new Uint8Array(hit.buf), {
    status: 200,
    headers: {
      "Content-Type": hit.mimeType || "application/octet-stream",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=86400",
      "Content-Length": String(hit.buf.length),
    },
  });
}
