import {
  callAliyunCloneTts,
  ttsProviderForLang,
} from "@/lib/tts-provider";
import {
  getCachedTts,
  setCachedTts,
} from "@/lib/tts-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TTS_URL = process.env.TTS_URL || "http://127.0.0.1:8765/tts";

const ALLOWED_VOICES = new Set([
  "en-US-AvaNeural",
  "en-GB-RyanNeural",
  "en-US-JennyNeural",
  "en-GB-ThomasNeural",
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-YunxiNeural",
  "zh-HK-HiuMaanNeural",
  "zh-HK-WanLungNeural",
  "es-ES-ElviraNeural",
  "es-ES-AlvaroNeural",
  "es-MX-DaliaNeural",
  "es-MX-JorgeNeural",
  "es-US-PalomaNeural",
  "fr-FR-HenriNeural",
  "fr-FR-DeniseNeural",
]);

async function fetchTtsOnce(
  text: string,
  voice: string,
): Promise<{ res: Response; errorBody: { error?: string } | null }> {
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal: AbortSignal.timeout(90_000),
  });
  if (res.ok) return { res, errorBody: null };
  const errorBody = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return { res, errorBody };
}

/** 通过本地 edge-tts (stt_server.py) 合成；含一次 5xx 重试。 */
async function synthesizeEdge(text: string, voice: string): Promise<Buffer> {
  let { res, errorBody } = await fetchTtsOnce(text, voice);
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 350));
    ({ res, errorBody } = await fetchTtsOnce(text, voice));
  }
  if (!res.ok) {
    throw new Error(errorBody?.error || `TTS failed (HTTP ${res.status})`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.byteLength < 100) {
    throw new Error("TTS returned empty audio");
  }
  return audio;
}

/**
 * 方言 TTS：
 * 1) 阿里声音复刻（有 Key + voiceId）
 * 2) 失败或未配置 → 本地 edge 临时兜底（不做粤语云 TTS）
 * 全程走磁盘缓存。
 */
async function synthesizeDialect(
  text: string,
  dialectLang: "teo" | "hak",
): Promise<Buffer> {
  const provider = ttsProviderForLang(dialectLang);
  const cacheVoice =
    provider.kind === "aliyun-clone" ? provider.voiceId : provider.voice;

  const cached = await getCachedTts(text, cacheVoice);
  if (cached) return cached;

  if (provider.kind === "aliyun-clone") {
    try {
      const audio = await callAliyunCloneTts(
        text,
        provider.voiceId,
        provider.model,
      );
      void setCachedTts(text, provider.voiceId, audio);
      return audio;
    } catch (err) {
      console.warn(
        `[tts] aliyun-clone failed for ${dialectLang}, falling back to local edge:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const edgeVoice =
    provider.kind === "edge" ? provider.voice : "zh-HK-WanLungNeural";
  const audio = await synthesizeEdge(text, edgeVoice);
  void setCachedTts(text, edgeVoice, audio);
  return audio;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      voice?: string;
      /** 可选：方言模式传入 "teo"|"hak"，触发云端 provider 路由 */
      lang?: string;
    };
    const text = (body.text || "").trim();
    if (!text) {
      return Response.json({ error: "empty text" }, { status: 400 });
    }

    // 方言模式 → 声音复刻（若配置）否则本地 edge；带缓存
    const dialectLang =
      body.lang === "teo" ? "teo" : body.lang === "hak" ? "hak" : null;
    if (dialectLang) {
      const audio = await synthesizeDialect(text, dialectLang);
      return new Response(audio, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    // 非方言：现状白名单 + edge
    const voice =
      body.voice && ALLOWED_VOICES.has(body.voice)
        ? body.voice
        : "en-GB-RyanNeural";

    const audio = await synthesizeEdge(text, voice);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TTS failed";
    const busy = /fetch|ECONNREFUSED|timeout|AbortError|undici/i.test(msg);
    return Response.json(
      {
        error: busy
          ? "Voice service starting up — wait a few seconds and try again."
          : msg,
      },
      { status: 503 },
    );
  }
}
