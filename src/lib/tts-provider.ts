/**
 * TTS Provider 路由。
 *
 * 方言模式（teo/hak）：
 *   - 若配置了阿里云百炼 Key + 对应方言的复刻音色 voiceId → 走阿里云「声音复刻」合成（CosyVoice）。
 *   - 否则（无 Key / 未配置音色 / 失败）→ 降级回粤语 edge-tts（现状行为）。
 *
 * 非方言语言 → 直接走 edge-tts 音色映射（现状不变）。
 * 云端调用包在 try/catch + 超时内，绝不成为单点故障。
 */
import { edgeVoiceForLang, type SpeechLang } from "./voices";

export type TtsProvider =
  | { kind: "edge"; voice: string }
  | { kind: "aliyun-clone"; voiceId: string; model: string };

/** 未配置百炼 Key 或未配置方言复刻音色时抛出，由上层降级 edge。 */
export class TtsProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TtsProviderNotConfiguredError";
  }
}

export function aliyunCloneVoiceIdForLang(lang: SpeechLang): string | null {
  if (lang === "teo") return process.env.TEO_CLONE_VOICE_ID?.trim() || null;
  if (lang === "hak") return process.env.HAK_CLONE_VOICE_ID?.trim() || null;
  return null;
}

/** 方言复刻音色使用的合成模型（须与创建音色时 target_model 一致）。 */
export const ALIYUN_CLONE_MODEL = "cosyvoice-v3-plus";

export function ttsProviderForLang(lang: SpeechLang): TtsProvider {
  if (lang === "teo" || lang === "hak") {
    const key = process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
    const voiceId = aliyunCloneVoiceIdForLang(lang);
    if (key && voiceId) {
      return { kind: "aliyun-clone", voiceId, model: ALIYUN_CLONE_MODEL };
    }
    return { kind: "edge", voice: "zh-HK-WanLungNeural" };
  }
  return { kind: "edge", voice: edgeVoiceForLang(lang) };
}

/**
 * 阿里云百炼「声音复刻」音色合成（非实时 HTTP）。
 * 返回 mp3 Buffer。任何失败抛错，由调用方降级 edge。
 */
export async function callAliyunCloneTts(
  text: string,
  voiceId: string,
  model: string,
  opts: { timeoutMs?: number; apiKey?: string } = {},
): Promise<Buffer> {
  const apiKey = opts.apiKey?.trim() || process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    throw new TtsProviderNotConfiguredError(
      "阿里云百炼未配置 (ALIYUN_DASHSCOPE_API_KEY)",
    );
  }
  const timeoutMs = opts.timeoutMs ?? 6_000;
  const baseUrl =
    process.env.ALIYUN_DASHSCOPE_BASE_URL?.trim() ||
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

  const body = {
    model,
    input: { text, voice: voiceId },
    parameters: { format: "mp3", sample_rate: 24000 },
  };

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errBody = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(
      `aliyun clone TTS failed (HTTP ${res.status}): ${errBody}`,
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    // 返回错误 JSON（如缺少权限/配额）
    const data = (await res.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    throw new Error(
      data?.message || data?.code || `aliyun clone TTS error (${res.status})`,
    );
  }

  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.byteLength < 100) {
    throw new Error("aliyun clone TTS returned empty audio");
  }
  return audio;
}
