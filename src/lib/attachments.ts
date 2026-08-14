import type { AttachmentKind, ChatAttachmentPayload } from "./types";

export const MAX_ATTACHMENTS = 9;
/** Per-file upload ceiling (picker + client validation). */
export const MAX_FILE_BYTES = 256 * 1024 * 1024;
export const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif)$/i;
const TEXT_EXT =
  /\.(txt|md|markdown|csv|json|log|text|html?|ts|tsx|js|jsx|py|mjs|cjs)$/i;
const PDF_EXT = /\.pdf$/i;
const OFFICE_EXT = /\.(docx|pptx|xlsx)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

/** Shared `<input type="file" accept>` for Tutor + Ask AI */
export const FILE_INPUT_ACCEPT = [
  "image/*",
  "video/*",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".html",
  ".htm",
  ".docx",
  ".pptx",
  ".xlsx",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/html",
  "text/markdown",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

/** Code Agent also accepts common source / log files */
export const CONSOLE_FILE_INPUT_ACCEPT = [
  FILE_INPUT_ACCEPT,
  ".json",
  ".log",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".mjs",
  ".cjs",
].join(",");

export function isOfficeAttachment(mimeType: string, name: string): boolean {
  if (OFFICE_EXT.test(name)) return true;
  const mime = (mimeType || "").toLowerCase();
  return (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function isHtmlAttachment(mimeType: string, name: string): boolean {
  if (/\.html?$/i.test(name)) return true;
  return (mimeType || "").toLowerCase() === "text/html";
}

/** Short phone / screen-record clips (mp4/webm/mov/m4v). */
export function isVideoAttachment(mimeType: string, name: string): boolean {
  if (VIDEO_EXT.test(name || "")) return true;
  const mime = (mimeType || "").toLowerCase();
  if (!mime.startsWith("video/")) return false;
  // Allow common short-clip MIME even when extension is missing (iOS Photos)
  return (
    mime === "video/mp4" ||
    mime === "video/webm" ||
    mime === "video/quicktime" ||
    mime === "video/x-m4v" ||
    mime === "video/x-mp4"
  );
}

export function guessKind(mimeType: string, name: string): AttachmentKind {
  if (mimeType.startsWith("image/") || IMAGE_EXT.test(name)) return "image";
  return "file";
}

export function isAllowedAttachment(mimeType: string, name: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (isVideoAttachment(mime, name)) return true;
  // iOS / editors often report markdown as text/* or x-markdown
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/markdown" ||
    mime === "text/x-markdown" ||
    mime === "text/x-web-markdown"
  ) {
    return true;
  }
  // Phone camera / WeChat often give empty filename
  if (!name || name === "image.jpg" || name === "blob") {
    if (!mime || mime === "application/octet-stream") return true;
  }
  if (
    IMAGE_EXT.test(name) ||
    PDF_EXT.test(name) ||
    TEXT_EXT.test(name) ||
    OFFICE_EXT.test(name) ||
    VIDEO_EXT.test(name)
  ) {
    return true;
  }
  if (
    mime === "application/pdf" ||
    mime === "application/json" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return true;
  }
  return false;
}

/** iPhone / iPad (incl. iPadOS desktop UA). */
export function isAppleTouchDevice(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
  opts?: { platform?: string; maxTouchPoints?: number },
): boolean {
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  const platform =
    opts?.platform ??
    (typeof navigator !== "undefined" ? navigator.platform : "");
  const maxTouchPoints =
    opts?.maxTouchPoints ??
    (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0);
  // iPadOS 13+ reports as MacIntel with touch
  if (platform === "MacIntel" && maxTouchPoints > 1) return true;
  return false;
}

/**
 * Desktop: keep accept= filter. iOS: use accept all-files (`*` + `/` + `*`) —
 * WebKit grays out uncommon extensions like `.md` when accept lists MIME/ext
 * tokens. Explicit all-files accept is more reliable than omitting the attribute
 * on some iOS versions.
 *
 * Callers must mount `<input type="file">` only AFTER this resolves, and must
 * never first paint with a desktop accept then change it (WebKit keeps the first filter).
 */
export function resolveFilePickerAccept(
  desktopAccept: string,
  appleTouch = isAppleTouchDevice(),
): string | undefined {
  return appleTouch ? "*/*" : desktopAccept;
}

export function normalizeMime(mimeType: string, name: string): string {
  let mime = mimeType || "";
  if (!mime || mime === "application/octet-stream") {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) mime = "image/png";
    else if (lower.endsWith(".webp")) mime = "image/webp";
    else if (lower.endsWith(".gif")) mime = "image/gif";
    else if (lower.endsWith(".pdf")) mime = "application/pdf";
    else if (lower.endsWith(".html") || lower.endsWith(".htm"))
      mime = "text/html";
    else if (lower.endsWith(".md") || lower.endsWith(".markdown"))
      mime = "text/markdown";
    else if (lower.endsWith(".txt")) mime = "text/plain";
    else if (lower.endsWith(".csv")) mime = "text/csv";
    else if (lower.endsWith(".json")) mime = "application/json";
    else if (lower.endsWith(".docx"))
      mime =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (lower.endsWith(".pptx"))
      mime =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    else if (lower.endsWith(".xlsx"))
      mime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (lower.endsWith(".mp4") || lower.endsWith(".m4v"))
      mime = "video/mp4";
    else if (lower.endsWith(".webm")) mime = "video/webm";
    else if (lower.endsWith(".mov")) mime = "video/quicktime";
    else if (IMAGE_EXT.test(lower)) mime = "image/jpeg";
    else if (TEXT_EXT.test(lower)) mime = "text/plain";
    else mime = "application/octet-stream";
  }
  if (
    mime === "text/x-markdown" ||
    mime === "text/x-web-markdown" ||
    mime === "application/markdown"
  ) {
    mime = "text/markdown";
  }
  if (mime === "image/jpg") mime = "image/jpeg";
  return mime;
}

export function stripDataUrlPrefix(data: string): string {
  const raw = data || "";
  // data:mime;base64,PAYLOAD  or  data:mime;charset=...;base64,PAYLOAD
  const b64 = /^data:[^,]*=?base64,([\s\S]*)$/i.exec(raw);
  if (b64) return b64[1] || "";
  // Already raw base64 (no data: prefix)
  if (!raw.startsWith("data:")) return raw;
  // data:mime;charset=utf-8,urlencoded
  const comma = raw.indexOf(",");
  return comma >= 0 ? raw.slice(comma + 1) : raw;
}

/** Prefer explicit base64 `data`, else derive from a data URL. */
export function attachmentBase64(att: {
  data?: string;
  dataUrl?: string;
}): string {
  if (att.data && String(att.data).trim().length > 0) {
    return stripDataUrlPrefix(String(att.data));
  }
  if (att.dataUrl && att.dataUrl.startsWith("data:")) {
    // Only return base64 payloads (binary files / images)
    if (/;base64,/i.test(att.dataUrl)) {
      return stripDataUrlPrefix(att.dataUrl);
    }
  }
  return "";
}

/** Decode text from a charset data URL (non-base64). */
export function textFromDataUrl(dataUrl: string): string {
  if (!dataUrl?.startsWith("data:")) return "";
  if (/;base64,/i.test(dataUrl)) {
    try {
      return Buffer.from(stripDataUrlPrefix(dataUrl), "base64").toString("utf8");
    } catch {
      return "";
    }
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return "";
  try {
    return decodeURIComponent(dataUrl.slice(comma + 1));
  } catch {
    return dataUrl.slice(comma + 1);
  }
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
