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
  | "formospeech-cache";

/**
 * 方言 TTS：潮汕话 / 客家话。
 * **永不**回退粤语 edge（zh-HK）。
 */
async function synthesizeDialect(
  text: string,
  dialectLang: "teo" | "hak",
): Promise<{ audio: Buffer; engine: DialectTtsEngine }> {
  const provider = ttsProviderForLang(dialectLang);

  if (provider.kind === "aliyun-clone") {
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
  }

  if (provider.kind === "formospeech") {
    const cached = await getCachedTts(text, provider.voice);
    if (cached) {
      return { audio: cached, engine: "formospeech-cache" };
    }
    const audio = await callFormospeechTts(text, provider.voice);
    void setCachedTts(text, provider.voice, audio);
    console.info(
      `[tts] formospeech ok for hak voice=${provider.voice} bytes=${audio.byteLength}`,
    );
    return { audio, engine: "formospeech" };
  }

  throw new DialectTtsUnavailableError(
    `${dialectLang} TTS provider misconfigured (unexpected edge)`,
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      voice?: string;
      lang?: string;
    };
    const text = (body.text || "").trim();
    if (!text) {
      return Response.json({ error: "empty text" }, { status: 400 });
    }

    const dialectLang =
      body.lang === "teo" ? "teo" : body.lang === "hak" ? "hak" : null;
    if (dialectLang) {
      try {
        const { audio, engine } = await synthesizeDialect(text, dialectLang);
        return new Response(audio, {
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
                ? "客家话请先离线预合成（scripts/formospeech_presynth.py）或配置 FORMOSPEECH_TTS_URL / HAK_CLONE_VOICE_ID；不使用粤语顶替。"
                : "潮汕话请配置 ALIYUN_DASHSCOPE_API_KEY（或 TEO_CLONE_VOICE_ID）；不使用粤语顶替。",
          },
          { status: 503 },
        );
      }
    }

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
