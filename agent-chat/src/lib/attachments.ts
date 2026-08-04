import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { promisify } from "node:util";
import type { ChatAttachment } from "./types";

const execFileAsync = promisify(execFile);

export const MAX_ATTACHMENTS = 9;
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_SUMMARY_BYTES = 12_000;

export function isAllowedAttachment(
  mimeType: string,
  name: string,
): boolean {
  const mime = (mimeType || "").toLowerCase();
  const ext = path.extname(name || "").toLowerCase();
  const allowedMimes = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/heic",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
  ];
  const allowedExts = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".heic",
    ".pdf",
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".log",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
  ];
  return (
    allowedMimes.includes(mime) ||
    (mime.startsWith("image/") && ext !== "") ||
    allowedExts.includes(ext)
  );
}

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64.replace(/^data:[^;]+;base64,/, ""), "base64");
}

function decodeCharsetDataUrl(dataUrl: string): string | null {
  try {
    if (dataUrl.startsWith("data:") && dataUrl.includes("base64,")) {
      return base64ToBuffer(dataUrl).toString("utf8");
    }
    if (dataUrl.startsWith("data:") && dataUrl.includes(",")) {
      return decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));
    }
    return null;
  } catch {
    return null;
  }
}

async function extractPdfText(b64: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acc-pdf-"));
  const pdfPath = path.join(tmpDir, "doc.pdf");
  try {
    fs.writeFileSync(pdfPath, base64ToBuffer(b64));
    try {
      const { stdout } = await execFileAsync(
        "pdftotext",
        ["-layout", "-enc", "UTF-8", pdfPath, "-"],
        { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 },
      );
      return stdout.replace(/\0/g, "").trim();
    } catch {
      return "";
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function summarizeOne(
  att: ChatAttachment,
  index: number,
): Promise<string> {
  const header = `--- File ${index} (${att.name}) [${att.kind === "image" ? "image" : att.mimeType || "file"}] ---\n`;

  if (att.kind === "image") {
    // Images are sent to the model as image blocks via SDKUserMessage.
    return header + "(Image attached — sent to the model as an image block.)";
  }

  if (att.textContent) {
    return header + att.textContent.slice(0, MAX_SUMMARY_BYTES);
  }

  if (att.mimeType === "application/pdf" && att.data) {
    const text = await extractPdfText(att.data);
    if (text) return header + text.slice(0, MAX_SUMMARY_BYTES);
    return header + "(PDF provided but text extraction returned nothing.)";
  }

  if (att.data) {
    const text = decodeCharsetDataUrl(att.data);
    if (text) return header + text.slice(0, MAX_SUMMARY_BYTES);
  }

  return header + "(No extractable text.)";
}

/**
 * Build a compact block of file summaries to inject into the agent prompt.
 * Images are described as data-URL context; PDFs/text are extracted to text.
 */
export async function buildAttachmentLines(
  attachments: ChatAttachment[],
): Promise<string> {
  if (!attachments?.length) return "";
  const valid = attachments
    .filter((a) => isAllowedAttachment(a.mimeType, a.name))
    .slice(0, MAX_ATTACHMENTS);
  if (!valid.length) return "";

  const lines = await Promise.all(valid.map((a, i) => summarizeOne(a, i + 1)));
  return `\n\n---\n\n[User attachments]\n${lines.join("\n\n")}\n---`;
}
