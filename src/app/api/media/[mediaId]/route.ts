import { readMedia } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ mediaId: string }> };

function fallbackDownloadName(mimeType: string): string {
  if (mimeType.includes("pdf")) return "homework.pdf";
  if (mimeType.startsWith("image/")) return "photo.jpg";
  if (mimeType.startsWith("text/")) return "notes.txt";
  return "attachment.bin";
}

/**
 * Build Content-Disposition. HTTP headers are ByteStrings — non-ASCII names
 * (e.g. Chinese homework screenshots) must use RFC 5987 filename*, or the
 * Response constructor throws and /api/media returns 500 (broken history imgs).
 */
export function buildContentDisposition(
  name: string | undefined,
  mimeType: string,
  opts: { download: boolean; inlineImage: boolean },
): string {
  const type =
    opts.download || !opts.inlineImage ? "attachment" : "inline";
  const raw = (name || "").replace(/[/\\?%*:|"<>]/g, "_").trim().slice(0, 120);
  const ascii = (
    raw.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_") ||
    fallbackDownloadName(mimeType)
  ).slice(0, 120);
  if (!raw || raw === ascii) {
    return `${type}; filename="${ascii}"`;
  }
  // RFC 5987 — preserve original Unicode name for download UIs
  const encoded = encodeURIComponent(raw).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
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
  const mime = hit.mimeType || "application/octet-stream";
  const isImage = mime.startsWith("image/");
  const isAudio = mime.startsWith("audio/");
  // Inline <img>/<audio> skip Content-Disposition (ByteString crashes on
  // Chinese names; attachment also breaks <audio> playback).
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Cache-Control": "private, max-age=86400",
    "Content-Length": String(hit.buf.length),
  };
  if (forceDownload || (!isImage && !isAudio)) {
    headers["Content-Disposition"] = buildContentDisposition(
      hit.name,
      mime,
      { download: forceDownload, inlineImage: isImage },
    );
  }

  return new Response(new Uint8Array(hit.buf), {
    status: 200,
    headers,
  });
}
