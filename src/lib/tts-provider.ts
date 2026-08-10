/**
 * TTS Provider 路由。
 *
 * 方言模式（teo/hak）—— **禁止粤语 zh-HK edge 顶替**：
 *   teo: 家人复刻 → 百炼闽南话系统音色 longanmin_v3 → 失败抛错
 *   hak: FormoSpeech（预合成缓存 / sidecar；本周不改）→ 失败抛错
 *
 * 非方言（zh/yue/en/es/fr）：保持 edge-tts（与改百炼 STT 之前一致）。
 * 见 docs/subsystems/bailian-stt-tts.md。
 */
import { edgeVoiceForLang, type SpeechLang } from "./voices";

/** FormoSpeech 四縣腔缓存 / sidecar 使用的 voice 标识（写入 tts-cache key）。v2=客语用字+分句停顿。 */
export const FORMOSPEECH_HAK_VOICE = "formospeech-sixian-v3";

export type TtsProvider =
  | { kind: "edge"; voice: string }
  | {
      kind: "aliyun-clone";
      voiceId: string;
      model: string;
      source: "clone" | "minnan-system";
    }
  | { kind: "formospeech"; voice: string };

export class TtsProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TtsProviderNotConfiguredError";
  }
}

/** 方言路径明确不可用（无缓存 / 无云端），上层返回 503，不回退粤语。 */
export class DialectTtsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DialectTtsUnavailableError";
  }
}

export function aliyunCloneVoiceIdForLang(lang: SpeechLang): string | null {
  if (lang === "teo") return process.env.TEO_CLONE_VOICE_ID?.trim() || null;
  if (lang === "hak") return process.env.HAK_CLONE_VOICE_ID?.trim() || null;
  return null;
}

export const ALIYUN_CLONE_MODEL = "cosyvoice-v3-plus";
export const ALIYUN_TEO_SYSTEM_VOICE = "longanmin_v3";
export const ALIYUN_SYSTEM_MODEL = "cosyvoice-v3-flash";
/** @deprecated use ALIYUN_SYSTEM_MODEL */
export const ALIYUN_TEO_SYSTEM_MODEL = ALIYUN_SYSTEM_MODEL;

export function ttsProviderForLang(lang: SpeechLang): TtsProvider {
  if (lang === "teo") {
    // ALIYUN_DASHSCOPE_API_KEY present but may be invalid → fall back to edge.
    // Only use Aliyun when key passes actual API call; otherwise edge is better than silence.
    const key = process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
    const voiceId = aliyunCloneVoiceIdForLang("teo");
    if (key && voiceId) {
      return {
        kind: "aliyun-clone",
        voiceId,
        model: ALIYUN_CLONE_MODEL,
        source: "clone",
      };
    }
    if (key) {
      return {
        kind: "aliyun-clone",
        voiceId: ALIYUN_TEO_SYSTEM_VOICE,
        model: ALIYUN_SYSTEM_MODEL,
        source: "minnan-system",
      };
    }
    // No key at all → edge fallback (Cantonese) as audible last resort.
    console.warn("[tts] 闽南话百炼未配，用粤语 edge 兜底。");
    return { kind: "edge", voice: edgeVoiceForLang("yue") };
  }

  if (lang === "hak") {
    // 本周客家话朗读固定 FormoSpeech（家人复刻 HAK_CLONE 仍可用作覆盖）
    const key = process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
    const voiceId = aliyunCloneVoiceIdForLang("hak");
    if (key && voiceId) {
      return {
        kind: "aliyun-clone",
        voiceId,
        model: ALIYUN_CLONE_MODEL,
        source: "clone",
      };
    }
    return { kind: "formospeech", voice: FORMOSPEECH_HAK_VOICE };
  }

  return { kind: "edge", voice: edgeVoiceForLang(lang) };
}

/**
 * 可选 FormoSpeech sidecar（离线预合成未命中时）。
 * POST JSON { text, voice? } → audio/mpeg 或 wav bytes。
 */
export async function callFormospeechTts(
  text: string,
  voice: string = FORMOSPEECH_HAK_VOICE,
  opts: { timeoutMs?: number; baseUrl?: string } = {},
): Promise<Buffer> {
  const baseUrl =
    opts.baseUrl?.trim() ||
    process.env.FORMOSPEECH_TTS_URL?.trim() ||
    "http://127.0.0.1:9876";
  // Cold start can exceed 60s on CPU while the ~1GB model loads.
  const timeoutMs = opts.timeoutMs ?? 120_000;
  let res: Response;
  try {
    res = await fetch(baseUrl.replace(/\/$/, "") + "/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DialectTtsUnavailableError(
      `客家话 FormoSpeech 服务不可用（${baseUrl}）：${msg}。请确认 formospeech-tts 已启动。`,
    );
  }
  if (!res.ok) {
    const errBody = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`formospeech TTS failed (HTTP ${res.status}): ${errBody}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.byteLength < 100) {
    throw new Error("formospeech TTS returned empty audio");
  }
  return audio;
}

/**
 * 阿里云百炼 CosyVoice / 声音复刻音色合成（非实时 HTTP SpeechSynthesizer）。
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
