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
