/**
 * DashScope Qwen-OCR (qwen-vl-ocr) — server-side image text extraction.
 *
 * The tutor agent's multimodal model reads photographed homework unreliably,
 * especially dense vocabulary lists (FCE / spelling / word banks) where a
 * single misread word breaks the whole study session. We run a dedicated OCR
 * model on each photo and hand the tutor the EXACT words as plain text —
 * mirroring how PDFs / Office files already get text extraction via
 * `buildFileSummaries`.
 *
 * Docs: https://help.aliyun.com/zh/model-studio/qwen-vl-ocr-api-reference
 *       https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai
 */
import type { ChatAttachmentPayload } from "./types";
import { attachmentBase64, stripDataUrlPrefix } from "./attachments";

const OCR_TIMEOUT_MS = 30_000;
const MAX_OCR_IMAGES = 9;
const MIN_OCR_TEXT_LEN = 3;
const MAX_OCR_SUMMARY = 12_000;

export type ImageOcrConfig = {
  apiKey: string;
  model: string;
  workspaceId?: string;
  region: string;
};

export function loadImageOcrConfig(): ImageOcrConfig | null {
  const apiKey = process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.ALIYUN_OCR_MODEL?.trim() || "qwen-vl-ocr-latest",
    workspaceId: process.env.ALIYUN_WORKSPACE_ID?.trim() || undefined,
    region: process.env.ALIYUN_DASHSCOPE_REGION?.trim() || "cn-beijing",
  };
}

export function ocrCompletionsUrl(): string {
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID?.trim();
  const region = process.env.ALIYUN_DASHSCOPE_REGION?.trim() || "cn-beijing";
  if (workspaceId) {
    return `https://${workspaceId}.${region}.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
  }
  return "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
}

/** Strip a wrapping ``` fence (Qwen-OCR sometimes returns ```json … ```). */
export function stripCodeFence(text: string): string {
  const t = (text || "").trim();
  if (!t) return "";
  const fenced = /^```[A-Za-z0-9_-]*\s*\n([\s\S]*?)\n?```\s*$/.exec(t);
  if (fenced?.[1] != null) return fenced[1].trim();
  return t;
}

/** Pull OCR text out of the OpenAI-compatible response body. */
export function ocrContentFromResponse(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = data as Record<string, unknown>;
  const choices = root.choices as Array<Record<string, unknown>> | undefined;
  const content = choices?.[0]?.message as Record<string, unknown> | undefined;
  const c = content?.content;
  if (typeof c === "string") return stripCodeFence(c);
  if (Array.isArray(c)) {
    const parts: string[] = [];
    for (const block of c) {
      if (block && typeof block === "object" && "text" in block) {
        const t = (block as { text?: string }).text;
        if (t) parts.push(t);
      }
    }
    return stripCodeFence(parts.join("\n"));
  }
  return "";
}

async function callOcr(base64: string, mimeType: string): Promise<string> {
  const cfg = loadImageOcrConfig();
  if (!cfg) {
    throw new Error("阿里云百炼未配置 (ALIYUN_DASHSCOPE_API_KEY)");
  }
  const dataUri = `data:${mimeType || "image/jpeg"};base64,${base64}`;
  const res = await fetch(ocrCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: "user",
          // NOTE: send ONLY the image. Adding a custom text prompt makes
          // qwen-vl-ocr switch to a "text localization" task that returns
          // bounding-box coordinates instead of the recognized words.
          content: [
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`qwen-ocr failed (HTTP ${res.status}): ${raw.slice(0, 240)}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("qwen-ocr returned non-JSON");
  }
  const code = (data as { code?: string }).code;
  if (code && code !== "Success") {
    const msg = (data as { message?: string }).message || code;
    throw new Error(`qwen-ocr error: ${msg}`);
  }
  return ocrContentFromResponse(data);
}

/** OCR a single image's base64 payload. Returns "" on failure / empty. */
export async function extractImageOcrText(
  base64: string,
  mimeType: string,
): Promise<string> {
  const b64 = stripDataUrlPrefix(base64);
  if (!b64 || b64.length < 8) return "";
  try {
    return (await callOcr(b64, mimeType)).trim();
  } catch {
    return "";
  }
}

export type OcrSummary = { label: string; text: string };

/**
 * P1-2 — a worksheet item ("题") extracted from OCR text. Qwen-OCR returns a
 * flat text dump; this splits it into numbered question blocks so the tutor
 * can grade the page per-item and point at the exact wrong ones.
 */
export type WorksheetItem = { number: number; text: string };

/** Lines that start a new numbered worksheet item (Q1 / 1. / 1) / 第1题). */
const ITEM_MARKER_RE =
  /^\s*(?:Q\d+\s*[.:、．]?|(?:第\s*\d+\s*题)|(?:[（(]\s*\d+\s*[）)])|\d{1,3}\s*[.)、．])\s*/;

/**
 * Split OCR text into numbered worksheet items. Returns [] when the page has
 * no numbered structure (word lists, paragraphs) — callers then treat the
 * whole page as one unit.
 */
export function parseWorksheetItems(text: string): WorksheetItem[] {
  const lines = String(text || "").split(/\r?\n/);
  const items: WorksheetItem[] = [];
  let cur: WorksheetItem | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = ITEM_MARKER_RE.exec(line);
    if (m) {
      if (cur) items.push(cur);
      cur = {
        number: items.length + 1,
        text: line.replace(m[0], "").trim(),
      };
    } else if (cur) {
      cur.text = `${cur.text} ${line}`.trim();
    }
  }
  if (cur) items.push(cur);
  return items;
}

/**
 * P1-2 — build the "full-page grading" instruction block for the tutor prompt
 * when a photographed worksheet has recognizable numbered items.
 */
export function worksheetGradingBlock(
  ocrText: string,
  itemLimit = 40,
): string | null {
  const items = parseWorksheetItems(ocrText);
  if (!items.length) return null;
  const shown = items.length > itemLimit ? itemLimit : items.length;
  return [
    "",
    "[Full-page grading — the page is a worksheet with numbered items]",
    `The OCR page has ${items.length} numbered item(s)${shown < items.length ? ` (grade the first ${shown} as a set)` : ""}. Grade the set in ONE go:`,
    "- Per item: a one-line verdict, marked ✓ or ✗ (e.g. “Q1 ✓ · Q2 ✗ — you wrote 2/3”).",
    "- Finish with a compact summary line: “You got N of M right. To redo: Q…”. Then stop — no new topic until the student reacts.",
    "- Next, work through the WRONG items ONE at a time, Socratic hints only, no spoilers. Use the OCR text as ground truth for spellings/numbers.",
  ].join("\n");
}

/** Build the grading block from `buildImageOcrSummaries` output (plain text parts). */
export function worksheetGradingBlockFromSummaries(
  summaries: string[],
): string | null {
  const texts = (summaries || [])
    .map((s) => s.slice(s.indexOf("\n") + 1))
    .filter(Boolean);
  if (!texts.length) return null;
  return worksheetGradingBlock(texts.join("\n"));
}

/**
 * OCR every image attachment and produce `--- Photo N (name) ---\n<text>`
 * summaries the tutor prompt can quote. Any failed / blank image is dropped so
 * the agent falls back to raw vision for that photo.
 */
export async function buildImageOcrSummaries(
  attachments: ChatAttachmentPayload[],
  opts?: { ocrFn?: (base64: string, mimeType: string) => Promise<string> },
): Promise<string[]> {
  const images = (attachments || [])
    .filter((a) => a.kind === "image")
    .slice(0, MAX_OCR_IMAGES);
  if (images.length === 0) return [];
  if (!loadImageOcrConfig()) return [];

  const ocrFn = opts?.ocrFn ?? extractImageOcrText;
  const results = await Promise.all(
    images.map(async (img, i) => {
      const b64 = attachmentBase64(img);
      if (!b64) return null;
      const text = await ocrFn(b64, img.mimeType || "image/jpeg");
      if (!text || text.trim().length < MIN_OCR_TEXT_LEN) return null;
      return {
        label: `Photo ${i + 1} (${img.name || "photo"})`,
        text: text.trim(),
      } as OcrSummary;
    }),
  );

  return results
    .filter((r): r is OcrSummary => r !== null)
    .map((r) => `--- ${r.label} ---\n${r.text.slice(0, MAX_OCR_SUMMARY)}`);
}
