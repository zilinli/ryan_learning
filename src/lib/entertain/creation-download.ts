import type { CreationItem } from "./creations-store";

/** Media blob id that can be downloaded for this creation, if any. */
export function creationDownloadMediaId(
  item: Pick<
    CreationItem,
    "type" | "audioMediaId" | "mediaId" | "audioMissing" | "mediaMissing"
  >,
): string | null {
  if (item.type === "song") {
    if (!item.audioMediaId || item.audioMissing) return null;
    return item.audioMediaId;
  }
  if (item.type === "video" || item.type === "image") {
    if (!item.mediaId || item.mediaMissing) return null;
    return item.mediaId;
  }
  return null;
}

/** Same-origin download URL with Content-Disposition attachment. */
export function creationDownloadUrl(
  item: Pick<
    CreationItem,
    "type" | "audioMediaId" | "mediaId" | "audioMissing" | "mediaMissing"
  >,
): string | null {
  const id = creationDownloadMediaId(item);
  if (!id) return null;
  return `/api/media/${encodeURIComponent(id)}?download=1`;
}

/** Append download=1 to an existing /api/media URL (e.g. public share mediaUrl). */
export function withMediaDownloadParam(mediaUrl: string): string {
  const base = mediaUrl.trim();
  if (!base) return base;
  if (/[?&]download=1(?:&|$)/.test(base)) return base;
  return base.includes("?") ? `${base}&download=1` : `${base}?download=1`;
}
