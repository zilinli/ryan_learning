import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ChatAttachmentPayload } from "./types";
import {
  attachmentBase64,
  stripDataUrlPrefix,
  textFromDataUrl,
} from "./attachments";

const execFileAsync = promisify(execFile);

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
      const body = att.textContent.trim().slice(0, 12_000);
      summaries.push(`--- ${label} ---\n${body}`);
      continue;
    }

    // Text uploaded as charset data URL (no separate textContent)
    if (att.dataUrl && !/;base64,/i.test(att.dataUrl)) {
      const body = textFromDataUrl(att.dataUrl).trim().slice(0, 12_000);
      if (body) {
        summaries.push(`--- ${label} ---\n${body}`);
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
        summaries.push(`--- ${label} ---\n${text.slice(0, 12_000)}`);
      } else {
        summaries.push(
          `--- ${label} ---\n(PDF attached but text could not be extracted. Ask the student to also photograph key pages if needed.)`,
        );
      }
      continue;
    }

    if (binary && (att.mimeType.startsWith("text/") || /\.(txt|md|csv)$/i.test(att.name))) {
      try {
        const body = Buffer.from(binary, "base64").toString("utf8").trim().slice(0, 12_000);
        if (body) {
          summaries.push(`--- ${label} ---\n${body}`);
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
