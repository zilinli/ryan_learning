/**
 * TTS Provider 路由。
 *
 * 方言模式 —— **禁止粤语 zh-HK edge 顶替**：
 *   teo: 家人复刻 → 百炼闽南话系统音色 longanmin_v3 → 失败抛错
 *   hak: FormoSpeech（预合成缓存 / sidecar）→ 失败抛错
 *   sha: 家人复刻 → 百炼千问 TTS「上海-阿珍」Jada → 失败抛错
 *
 * 非方言（zh/yue/en/es/fr）：保持 edge-tts。
 * 见 docs/subsystems/bailian-stt-tts.md · shanghainese-support.md。
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
  | {
      kind: "qwen-tts";
      voiceId: string;
      model: string;
      source: "shanghai-system" | "clone";
      languageType?: string;
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
  if (lang === "sha") return process.env.SHA_CLONE_VOICE_ID?.trim() || null;
  return null;
}

export const ALIYUN_CLONE_MODEL = "cosyvoice-v3-plus";
export const ALIYUN_TEO_SYSTEM_VOICE = "longanmin_v3";
export const ALIYUN_SYSTEM_MODEL = "cosyvoice-v3-flash";
/** @deprecated use ALIYUN_SYSTEM_MODEL */
export const ALIYUN_TEO_SYSTEM_MODEL = ALIYUN_SYSTEM_MODEL;

/** 千问3-TTS 上海话系统音色（上海-阿珍）。 */
export const ALIYUN_SHA_SYSTEM_VOICE = "Jada";
export const ALIYUN_QWEN_TTS_MODEL = "qwen3-tts-flash";

export function ttsProviderForLang(lang: SpeechLang): TtsProvider {
  if (lang === "teo") {
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
    // 禁止粤语 edge 顶替 — 无密钥时明确失败，让上层返回 503
    throw new DialectTtsUnavailableError(
      "闽南话朗读需要 ALIYUN_DASHSCOPE_API_KEY（可选 TEO_CLONE_VOICE_ID）；不使用粤语顶替。",
    );
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

  if (lang === "sha") {
    const key = process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
    const voiceId = aliyunCloneVoiceIdForLang("sha");
    if (key && voiceId) {
      // 家人复刻音色：走 CosyVoice SpeechSynthesizer（与闽南复刻同路径）
      return {
        kind: "aliyun-clone",
        voiceId,
        model: ALIYUN_CLONE_MODEL,
        source: "clone",
      };
    }
    if (key) {
      return {
        kind: "qwen-tts",
        voiceId: ALIYUN_SHA_SYSTEM_VOICE,
        model: ALIYUN_QWEN_TTS_MODEL,
        source: "shanghai-system",
        languageType: "Chinese",
      };
    }
    throw new DialectTtsUnavailableError(
      "上海话朗读需要 ALIYUN_DASHSCOPE_API_KEY（可选 SHA_CLONE_VOICE_ID）；不使用粤语顶替。",
    );
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
/** Bailian CosyVoice often needs 20–60s for ~200+ char dialect passages. */
export const ALIYUN_CLONE_TTS_TIMEOUT_MS = 90_000;

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
  const timeoutMs = opts.timeoutMs ?? ALIYUN_CLONE_TTS_TIMEOUT_MS;
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

/**
 * 百炼千问3-TTS（multimodal-generation）。上海话系统音色 Jada 走此接口。
 * 文档：https://help.aliyun.com/zh/model-studio/qwen-tts-api
 */
export async function callQwenTts(
  text: string,
  voiceId: string,
  opts: {
    model?: string;
    languageType?: string;
    timeoutMs?: number;
    apiKey?: string;
  } = {},
): Promise<Buffer> {
  const apiKey = opts.apiKey?.trim() || process.env.ALIYUN_DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    throw new TtsProviderNotConfiguredError(
      "阿里云百炼未配置 (ALIYUN_DASHSCOPE_API_KEY)",
    );
  }
  const model = opts.model?.trim() || ALIYUN_QWEN_TTS_MODEL;
  const timeoutMs = opts.timeoutMs ?? ALIYUN_CLONE_TTS_TIMEOUT_MS;
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID?.trim();
  const region = process.env.ALIYUN_DASHSCOPE_REGION?.trim() || "cn-beijing";
  const baseUrl = workspaceId
    ? `https://${workspaceId}.${region}.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
    : "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

  const body = {
    model,
    input: {
      text,
      voice: voiceId,
      language_type: opts.languageType || "Chinese",
    },
  };

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-SSE": "disable",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(
      `qwen TTS failed (HTTP ${res.status}): ${raw.slice(0, 300)}`,
    );
  }

  let data: {
    code?: string;
    message?: string;
    output?: { audio?: { url?: string; data?: string } };
  } | null;
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error("qwen TTS returned non-JSON");
  }
  if (data?.code && data.code !== "Success") {
    throw new Error(data.message || data.code || "qwen TTS error");
  }
  const b64 = data?.output?.audio?.data;
  if (b64 && b64.length > 100) {
    return Buffer.from(b64, "base64");
  }
  const audioUrl = data?.output?.audio?.url;
  if (audioUrl) {
    const audioRes = await fetch(audioUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!audioRes.ok) {
      throw new Error(`qwen TTS audio download failed (HTTP ${audioRes.status})`);
    }
    const audio = Buffer.from(await audioRes.arrayBuffer());
    if (audio.byteLength < 100) throw new Error("qwen TTS returned empty audio");
    return audio;
  }
  throw new Error(data?.message || "qwen TTS response missing audio");
}
