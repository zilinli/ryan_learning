import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ChatAttachmentPayload } from "./types";
import {
  attachmentBase64,
  isHtmlAttachment,
  isOfficeAttachment,
  stripDataUrlPrefix,
  textFromDataUrl,
} from "./attachments";

const execFileAsync = promisify(execFile);
const MAX_SUMMARY = 12_000;

async function extractPdfWithPoppler(base64: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spark-pdf-"));
  const pdfPath = path.join(dir, "doc.pdf");
  const txtPath = path.join(dir, "doc.txt");
  try {
    await fs.writeFile(pdfPath, Buffer.from(stripDataUrlPrefix(base64), "base64"));
    await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, txtPath], {
      timeout: 20_000,
    });
    const text = await fs.readFile(txtPath, "utf8");
    return text.replace(/\u0000/g, "").trim();
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractPdfWithPdfParse(base64: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const buf = Buffer.from(stripDataUrlPrefix(base64), "base64");
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    const text =
      typeof result === "string"
        ? result
        : ((result as { text?: string }).text ?? "");
    return text.replace(/\u0000/g, "").trim();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function extractPdfText(base64: string): Promise<string> {
  try {
    const text = await extractPdfWithPoppler(base64);
    if (text) return text;
  } catch {
    // fall through
  }
  try {
    return await extractPdfWithPdfParse(base64);
  } catch {
    return "";
  }
}

/** Strip scripts/styles/tags for safe prompt injection (not browser render). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function officeExtFromName(name: string): string {
  const m = /\.(docx|pptx|xlsx)$/i.exec(name || "");
  return m ? m[1]!.toLowerCase() : "docx";
}

export async function extractOfficeText(
  base64: string,
  name: string,
): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spark-office-"));
  const filePath = path.join(dir, `doc.${officeExtFromName(name)}`);
  try {
    await fs.writeFile(filePath, Buffer.from(stripDataUrlPrefix(base64), "base64"));
    const { parseOfficeAsync, setDecompressionLocation, disableConsoleOutput } =
      await import("officeparser");
    disableConsoleOutput();
    setDecompressionLocation(dir);
    const text = await parseOfficeAsync(filePath);
    return String(text || "")
      .replace(/\u0000/g, "")
      .trim();
  } catch {
    return "";
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function buildFileSummaries(
  attachments: ChatAttachmentPayload[],
): Promise<string[]> {
  const summaries: string[] = [];
  let fileIndex = 0;

  for (const att of attachments) {
    if (att.kind !== "file") continue;
    fileIndex += 1;
    const label = `File ${fileIndex} (${att.name})`;

    if (att.textContent?.trim()) {
      let body = att.textContent.trim();
      if (isHtmlAttachment(att.mimeType, att.name)) {
        body = htmlToPlainText(body);
      }
      summaries.push(`--- ${label} ---\n${body.slice(0, MAX_SUMMARY)}`);
      continue;
    }

    // Text uploaded as charset data URL (no separate textContent)
    if (att.dataUrl && !/;base64,/i.test(att.dataUrl)) {
      let body = textFromDataUrl(att.dataUrl).trim();
      if (isHtmlAttachment(att.mimeType, att.name)) {
        body = htmlToPlainText(body);
      }
      if (body) {
        summaries.push(`--- ${label} ---\n${body.slice(0, MAX_SUMMARY)}`);
        continue;
      }
    }

    const isPdf =
      att.mimeType === "application/pdf" ||
      att.name.toLowerCase().endsWith(".pdf");
    const binary = attachmentBase64(att);

    if (isPdf && binary) {
      const text = await extractPdfText(binary);
      if (text) {
        summaries.push(`--- ${label} ---\n${text.slice(0, MAX_SUMMARY)}`);
      } else {
        summaries.push(
          `--- ${label} ---\n(PDF attached but text could not be extracted. Ask the student to also photograph key pages if needed.)`,
        );
      }
      continue;
    }

    if (isOfficeAttachment(att.mimeType, att.name) && binary) {
      const text = await extractOfficeText(binary, att.name);
      if (text) {
        summaries.push(`--- ${label} ---\n${text.slice(0, MAX_SUMMARY)}`);
      } else {
        summaries.push(
          `--- ${label} ---\n(Office file attached but text could not be extracted. Try exporting to PDF or copying the text.)`,
        );
      }
      continue;
    }

    if (
      binary &&
      (att.mimeType.startsWith("text/") ||
        /\.(txt|md|markdown|csv|html?|json|log|ts|tsx|js|jsx|py|mjs|cjs)$/i.test(
          att.name,
        ))
    ) {
      try {
        let body = Buffer.from(binary, "base64")
          .toString("utf8")
          .trim();
        if (isHtmlAttachment(att.mimeType, att.name)) {
          body = htmlToPlainText(body);
        }
        if (body) {
          summaries.push(`--- ${label} ---\n${body.slice(0, MAX_SUMMARY)}`);
          continue;
        }
      } catch {
        // fall through
      }
    }

    summaries.push(`--- ${label} ---\n(No extractable text.)`);
  }

  return summaries;
}
