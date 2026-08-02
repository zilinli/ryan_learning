import type { AttachmentKind, ChatAttachmentPayload } from "./types";

export const MAX_ATTACHMENTS = 9;
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif)$/i;
const TEXT_EXT = /\.(txt|md|csv|json|log|text)$/i;
const PDF_EXT = /\.pdf$/i;

export function guessKind(mimeType: string, name: string): AttachmentKind {
  if (mimeType.startsWith("image/") || IMAGE_EXT.test(name)) return "image";
  return "file";
}

export function isAllowedAttachment(mimeType: string, name: string): boolean {
  if (mimeType.startsWith("image/")) return true;
  if (IMAGE_EXT.test(name) || PDF_EXT.test(name) || TEXT_EXT.test(name)) {
    return true;
  }
  if (
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    mimeType === "application/json"
  ) {
    return true;
  }
  return false;
}

export function normalizeMime(mimeType: string, name: string): string {
  let mime = mimeType || "";
  if (!mime || mime === "application/octet-stream") {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) mime = "image/png";
    else if (lower.endsWith(".webp")) mime = "image/webp";
    else if (lower.endsWith(".gif")) mime = "image/gif";
    else if (lower.endsWith(".pdf")) mime = "application/pdf";
    else if (lower.endsWith(".txt") || lower.endsWith(".md")) mime = "text/plain";
    else if (lower.endsWith(".csv")) mime = "text/csv";
    else if (IMAGE_EXT.test(lower)) mime = "image/jpeg";
    else mime = "application/octet-stream";
  }
  if (mime === "image/jpg") mime = "image/jpeg";
  return mime;
}

export function stripDataUrlPrefix(data: string): string {
  return data.replace(/^data:[^;]+;base64,/, "");
}

/** Normalize request body: prefer attachments[], fall back to legacy image */
export function normalizeIncomingAttachments(body: {
  attachments?: ChatAttachmentPayload[];
  image?: { data: string; mimeType: string; name?: string };
}): ChatAttachmentPayload[] {
  if (body.attachments?.length) {
    return body.attachments.slice(0, MAX_ATTACHMENTS).map((a, i) => ({
      ...a,
      name: a.name || `attachment-${i + 1}`,
      kind: a.kind || guessKind(a.mimeType, a.name || ""),
    }));
  }
  if (body.image?.data) {
    return [
      {
        name: body.image.name || "photo.jpg",
        mimeType: body.image.mimeType || "image/jpeg",
        kind: "image",
        data: stripDataUrlPrefix(body.image.data),
      },
    ];
  }
  return [];
}
