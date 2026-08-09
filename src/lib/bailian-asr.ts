/**
 * 阿里云百炼语音识别（Fun-ASR-Flash / Qwen3-ASR-Flash）。
 * 短录音同步 multimodal-generation + Base64 Data URI。
 *
 * 方言：Fun-ASR 覆盖客家/闽南/粤等；失败可降级 Qwen3-ASR-Flash。
 * 文档：https://help.aliyun.com/zh/model-studio/recording-file-recognition
 */

export type BailianAsrResult = {
  text: string;
  language?: string;
  model: string;
};

export function loadBailianAsrConfig(): {
  apiKey: string;
  model: string;
  fallbackModel: string;
} | null {
  const apiKey = process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.ALIYUN_ASR_MODEL?.trim() || "fun-asr-flash-2026-06-15",
    fallbackModel:
      process.env.ALIYUN_ASR_FALLBACK_MODEL?.trim() || "qwen3-asr-flash",
  };
}

/** Map Spark STT lang → asr_options.language when supported. */
export function bailianAsrLanguageHint(
  lang: string,
): string | undefined {
  switch (lang) {
    case "zh":
    case "teo":
    case "hak":
      return "zh";
    case "yue":
      return "yue";
    case "en":
      return "en";
    case "es":
      return "es";
    case "fr":
      return "fr";
    default:
      return undefined;
  }
}

function multimodalUrl(): string {
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID?.trim();
  const region = process.env.ALIYUN_DASHSCOPE_REGION?.trim() || "cn-beijing";
  if (workspaceId) {
    return `https://${workspaceId}.${region}.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`;
  }
  return "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
}

function mimeFromBytes(bytes: Uint8Array, hint?: string): string {
  const h = (hint || "").toLowerCase();
  if (h.includes("mpeg") || h.includes("mp3")) return "audio/mpeg";
  if (h.includes("mp4") || h.includes("m4a")) return "audio/mp4";
  if (h.includes("ogg")) return "audio/ogg";
  if (h.includes("webm")) return "audio/webm";
  if (h.includes("wav")) return "audio/wav";
  // RIFF....WAVE
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return "audio/wav";
  }
  return "audio/wav";
}

function formatParam(mime: string): string {
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
  return "wav";
}

/** Pull transcript text from Fun-ASR / Qwen3-ASR response shapes. */
export function extractBailianAsrText(data: unknown): {
  text: string;
  language?: string;
} {
  if (!data || typeof data !== "object") return { text: "" };
  const root = data as Record<string, unknown>;
  const output = root.output as Record<string, unknown> | undefined;
  if (!output) return { text: "" };

  // Fun-ASR-Flash nested: output.output.text / output.text
  const nested = output.output as Record<string, unknown> | undefined;
  const funText =
    (typeof nested?.text === "string" && nested.text) ||
    (typeof output.text === "string" && output.text) ||
    "";
  if (funText.trim()) {
    return { text: funText.trim() };
  }

  // Qwen3-ASR: output.choices[0].message.content[{text}]
  const choices = output.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object" && "text" in block) {
        const t = (block as { text?: string }).text;
        if (t) text += t;
      }
    }
  }
  let language: string | undefined;
  const annotations = message?.annotations as
    | Array<{ language?: string; type?: string }>
    | undefined;
  const audioInfo = annotations?.find((a) => a?.type === "audio_info");
  if (audioInfo?.language) language = audioInfo.language;
  return { text: text.trim(), language };
}

function isNoWordsError(body: string): boolean {
  return /ASR_RESPONSE_HAVE_NO_WORDS|no.?words/i.test(body);
}

async function callModel(opts: {
  apiKey: string;
  model: string;
  dataUri: string;
  mime: string;
  languageHint?: string;
  timeoutMs: number;
}): Promise<BailianAsrResult> {
  const isFun = opts.model.startsWith("fun-asr");
  const body = isFun
    ? {
        model: opts.model,
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: { data: opts.dataUri },
                },
              ],
            },
          ],
        },
        parameters: {
          format: formatParam(opts.mime),
          sample_rate: "16000",
        },
      }
    : {
        model: opts.model,
        input: {
          messages: [
            {
              role: "user",
              content: [{ audio: opts.dataUri }],
            },
          ],
        },
        parameters: {
          asr_options: {
            enable_itn: true,
            ...(opts.languageHint
              ? { language: opts.languageHint }
              : {}),
          },
        },
      };

  const res = await fetch(multimodalUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-SSE": "disable",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });

  const raw = await res.text();
  if (!res.ok) {
    if (isNoWordsError(raw)) {
      return { text: "", model: opts.model };
    }
    throw new Error(
      `bailian ASR failed (HTTP ${res.status}): ${raw.slice(0, 280)}`,
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("bailian ASR returned non-JSON");
  }
  const code = (data as { code?: string }).code;
  if (code && code !== "Success") {
    const msg = (data as { message?: string }).message || code;
    if (isNoWordsError(msg)) return { text: "", model: opts.model };
    throw new Error(`bailian ASR error: ${msg}`);
  }

  const { text, language } = extractBailianAsrText(data);
  return { text, language, model: opts.model };
}

/**
 * Transcribe short mic audio via Bailian.
 * Tries primary Fun-ASR-Flash, then Qwen3-ASR-Flash.
 */
export async function transcribeWithBailian(
  audio: Uint8Array,
  opts: {
    language?: string;
    mimeHint?: string;
    timeoutMs?: number;
    apiKey?: string;
    model?: string;
    fallbackModel?: string;
  } = {},
): Promise<BailianAsrResult> {
  const cfg = loadBailianAsrConfig();
  const apiKey = opts.apiKey?.trim() || cfg?.apiKey;
  if (!apiKey) {
    throw new Error("阿里云百炼未配置 (ALIYUN_DASHSCOPE_API_KEY)");
  }
  const primary = opts.model || cfg?.model || "fun-asr-flash-2026-06-15";
  const fallback =
    opts.fallbackModel || cfg?.fallbackModel || "qwen3-asr-flash";
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const mime = mimeFromBytes(audio, opts.mimeHint);
  const dataUri = `data:${mime};base64,${Buffer.from(audio).toString("base64")}`;
  const languageHint = bailianAsrLanguageHint(opts.language || "auto");

  try {
    const result = await callModel({
      apiKey,
      model: primary,
      dataUri,
      mime,
      languageHint,
      timeoutMs,
    });
    if (result.text.trim()) return result;
  } catch (err) {
    console.warn(
      `[bailian-asr] primary ${primary} failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  if (fallback && fallback !== primary) {
    const result = await callModel({
      apiKey,
      model: fallback,
      dataUri,
      mime,
      languageHint,
      timeoutMs,
    });
    return result;
  }

  return { text: "", model: primary };
}
