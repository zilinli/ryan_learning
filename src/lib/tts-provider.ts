/**
 * TTS Provider 路由。
 *
 * 方言模式（teo/hak）：
 *   1) 配置了家人「声音复刻」voiceId → 百炼 CosyVoice 复刻音色（最理想）
 *   2) 潮汕话未复刻但有百炼 Key → 百炼系统音色「龙安闽」闽南话（官方最接近潮汕；**绝不走普通话**）
 *   3) 客家话未复刻 / 无 Key / 云端失败 → 本地 edge 临时兜底
 *
 * 对比结论（2026-08-08）：
 *   - 讯飞在线 TTS：无潮汕话/客家话/闽南话发音人（仅粤/川/湘等 11 种方言）→ 不采用
 *   - 百炼 CosyVoice：有闽南话系统音色 longanmin_v3 + 声音复刻 → 采用百炼
 *
 * 非方言语言 → edge-tts 音色映射（现状不变）。
 */
import { edgeVoiceForLang, type SpeechLang } from "./voices";

export type TtsProvider =
  | { kind: "edge"; voice: string }
  | {
      kind: "aliyun-clone";
      voiceId: string;
      model: string;
      /** 复刻音色 vs 系统方言音色（便于日志 / X-TTS-Engine） */
      source: "clone" | "minnan-system";
    };

/** 未配置百炼 Key 时抛出，由上层降级 edge。 */
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

/** 家人复刻音色默认合成模型（须与 create_voice 的 target_model 一致）。 */
export const ALIYUN_CLONE_MODEL = "cosyvoice-v3-plus";

/**
 * 潮汕话临时系统音色：CosyVoice「龙安闽」闽南话。
 * 官方音色列表标注语言为闽南话（与潮汕同属闽南语支）；实测需 cosyvoice-v3-flash。
 * 文档：https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
 */
export const ALIYUN_TEO_SYSTEM_VOICE = "longanmin_v3";
export const ALIYUN_TEO_SYSTEM_MODEL = "cosyvoice-v3-flash";

export function ttsProviderForLang(lang: SpeechLang): TtsProvider {
  if (lang === "teo" || lang === "hak") {
    const key = process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
    const voiceId = aliyunCloneVoiceIdForLang(lang);
    if (key && voiceId) {
      return {
        kind: "aliyun-clone",
        voiceId,
        model: ALIYUN_CLONE_MODEL,
        source: "clone",
      };
    }
    // 潮汕话：无复刻时用百炼闽南话系统音色（禁止普通话样例 / 普通话系统音色）
    if (lang === "teo" && key) {
      return {
        kind: "aliyun-clone",
        voiceId: ALIYUN_TEO_SYSTEM_VOICE,
        model: ALIYUN_TEO_SYSTEM_MODEL,
        source: "minnan-system",
      };
    }
    // 客家话暂无云端方言音色；未复刻时本地 edge（仍非普通话）
    return { kind: "edge", voice: "zh-HK-WanLungNeural" };
  }
  return { kind: "edge", voice: edgeVoiceForLang(lang) };
}

/**
 * 阿里云百炼 CosyVoice / 声音复刻音色合成（非实时 HTTP SpeechSynthesizer）。
 * 返回音频 Buffer（通常是 mp3/wav）。任何失败抛错，由调用方降级 edge。
 *
 * 文档：https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide
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
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID?.trim();
  const baseUrl =
    process.env.ALIYUN_DASHSCOPE_BASE_URL?.trim() ||
    (workspaceId
      ? `https://${workspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`
      : "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer");

  const body = {
    model,
    input: {
      text,
      voice: voiceId,
      format: "mp3",
      sample_rate: 24000,
    },
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
  // SpeechSynthesizer 非流式返回 JSON，audio.url 指向 OSS
  if (contentType.includes("application/json") || contentType.includes("text/json")) {
    const data = (await res.json().catch(() => null)) as {
      message?: string;
      code?: string;
      output?: { audio?: { url?: string; data?: string } };
    } | null;
    if (data?.code && data.code !== "Success") {
      throw new Error(data.message || data.code || "aliyun TTS error");
    }
    const audioUrl = data?.output?.audio?.url;
    const b64 = data?.output?.audio?.data;
    if (b64 && b64.length > 100) {
      return Buffer.from(b64, "base64");
    }
    if (audioUrl) {
      const audioRes = await fetch(audioUrl, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!audioRes.ok) {
        throw new Error(`aliyun TTS audio download failed (HTTP ${audioRes.status})`);
      }
      const audio = Buffer.from(await audioRes.arrayBuffer());
      if (audio.byteLength < 100) throw new Error("aliyun TTS returned empty audio");
      return audio;
    }
    throw new Error(
      data?.message || data?.code || "aliyun TTS response missing audio",
    );
  }

  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.byteLength < 100) {
    throw new Error("aliyun clone TTS returned empty audio");
  }
  return audio;
}
