import {
  callAliyunCloneTts,
  callFormospeechTts,
  DialectTtsUnavailableError,
  ttsProviderForLang,
} from "@/lib/tts-provider";
import {
  getCachedTts,
  setCachedTts,
} from "@/lib/tts-cache";
import { normalizeHakkaForTts } from "@/lib/hakka-tts-text";
import { cleanTutorSpeechText, normalizeForTTS } from "@/lib/tts-text";

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

/** 非方言：本地 edge-tts（含粤语 yue）。方言路径禁止调用。 */
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

type DialectTtsEngine =
  | "aliyun-clone"
  | "aliyun-minnan"
  | "formospeech"
  | "formospeech-cache"
  | "edge-fallback";

/**
 * 方言 TTS：闽南话 / 客家话。
 * teo → 百炼；失败抛错（禁止粤语 edge 顶替）。
 * hak → FormoSpeech（或家人复刻）；失败抛错。
 */
async function synthesizeDialect(
  text: string,
  dialectLang: "teo" | "hak",
): Promise<{ audio: Buffer; engine: DialectTtsEngine }> {
  const provider = ttsProviderForLang(dialectLang);

  if (provider.kind === "edge") {
    // 设计上 teo/hak 不应落到 edge；若误配置则拒绝粤语顶替
    throw new DialectTtsUnavailableError(
      dialectLang === "teo"
        ? "闽南话未配置百炼音色，拒绝粤语 edge 顶替。"
        : "客家话未配置 FormoSpeech，拒绝粤语 edge 顶替。",
    );
  }

  if (provider.kind === "aliyun-clone") {
    try {
      const cacheVoice = provider.voiceId;
      const engine: DialectTtsEngine =
        provider.source === "minnan-system" ? "aliyun-minnan" : "aliyun-clone";
      const cached = await getCachedTts(text, cacheVoice);
      if (cached) return { audio: cached, engine };

      const audio = await callAliyunCloneTts(
        text,
        provider.voiceId,
        provider.model,
      );
      void setCachedTts(text, provider.voiceId, audio);
      console.info(
        `[tts] ${engine} ok for ${dialectLang} voice=${provider.voiceId} bytes=${audio.byteLength}`,
      );
      return { audio, engine };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[tts] aliyun clone failed for ${dialectLang}:`, msg);
      throw new DialectTtsUnavailableError(
        dialectLang === "teo"
          ? `闽南话百炼合成失败：${msg}。不使用粤语顶替。`
          : `客家话百炼合成失败：${msg}。不使用粤语顶替。`,
      );
    }
  }

  if (provider.kind === "formospeech") {
    // 简体→客语繁体后再查缓存 / 合成，避免未知字被丢掉造成怪声
    const hakText = normalizeHakkaForTts(text);
    const cached = await getCachedTts(hakText, provider.voice);
    if (cached) {
      return { audio: cached, engine: "formospeech-cache" };
    }
    const audio = await callFormospeechTts(hakText, provider.voice);
    void setCachedTts(hakText, provider.voice, audio);
    console.info(
      `[tts] formospeech ok for hak voice=${provider.voice} bytes=${audio.byteLength}`,
    );
    return { audio, engine: "formospeech" };
  }

  throw new DialectTtsUnavailableError(
    `方言 TTS 未配置 provider（${dialectLang}）。`,
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      voice?: string;
      lang?: string;
    };
    // Always clean text before TTS — strips markdown, SVG, data URIs, HTML, URLs
    const text = cleanTutorSpeechText(body.text || "");
    if (!text) {
      return Response.json({ error: "empty text" }, { status: 400 });
    }

    const dialectLang =
      body.lang === "teo" ? "teo" : body.lang === "hak" ? "hak" : null;
    if (dialectLang) {
      try {
        const { audio, engine } = await synthesizeDialect(text, dialectLang);
        return new Response(new Uint8Array(audio), {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
            "X-TTS-Engine": engine,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Dialect TTS failed";
        console.warn(`[tts] dialect ${dialectLang} unavailable:`, msg);
        return Response.json(
          {
            error: msg,
            hint:
              dialectLang === "hak"
                ? "客家话请确认 formospeech-tts 服务在跑（pm2），或预合成高频句；不使用粤语顶替。"
                : "闽南话请配置 ALIYUN_DASHSCOPE_API_KEY（或 TEO_CLONE_VOICE_ID）；不使用粤语顶替。",
          },
          { status: 503 },
        );
      }
    }

    // Shanghainese: normalize Wu characters before edge TTS (Cantonese voice misreads 侬/阿拉/etc.)
    const ttsText = body.lang === "sha" ? normalizeForTTS(text, "sha") : text;

    const voice =
      body.voice && ALLOWED_VOICES.has(body.voice)
        ? body.voice
        : "en-GB-RyanNeural";

    // zh/yue/en/es/fr/ms/sha：走 edge-tts
    const audio = await synthesizeEdge(ttsText, voice);
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-TTS-Engine": "edge",
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
