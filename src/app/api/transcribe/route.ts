import { NextResponse } from "next/server";
import {
  loadIflytekConfig,
  transcribeWithIflytek,
} from "@/lib/iflytek-asr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STT_URL = process.env.STT_URL || "http://127.0.0.1:8765/transcribe";

const ALLOWED = new Set(["auto", "en", "zh", "yue", "es", "fr", "teo", "hak"]);

/** Map browser / BCP-47 tags (e.g. zh-CN) onto STT backend codes. */
export function normalizeTranscribeLang(raw: string): string {
  const aliases: Record<string, string> = {
    "": "auto",
    auto: "auto",
    en: "en",
    eng: "en",
    english: "en",
    "en-us": "en",
    "en-gb": "en",
    zh: "zh",
    "zh-cn": "zh",
    "zh-tw": "zh",
    cmn: "zh",
    mandarin: "zh",
    chinese: "zh",
    yue: "yue",
    "zh-hk": "yue",
    "zh-yue": "yue",
    cantonese: "yue",
    es: "es",
    spa: "es",
    spanish: "es",
    "es-es": "es",
    "es-mx": "es",
    fr: "fr",
    fra: "fr",
    french: "fr",
    "fr-fr": "fr",
    teo: "teo",
    teochew: "teo",
    teochow: "teo",
    teochiu: "teo",
    chaoshan: "teo",
    hak: "hak",
    hakka: "hak",
    kejiahua: "hak",
    kejia: "hak",
  };
  const key = String(raw || "auto").trim().toLowerCase();
  const mapped = aliases[key] || key;
  return ALLOWED.has(mapped) ? mapped : "auto";
}

function pickFilename(audio: Blob): string {
  const named = (audio as File).name;
  if (named && /\.(wav|webm|ogg|mp3|mp4|m4a|aac)$/i.test(named)) {
    return named;
  }
  const type = (audio.type || "").toLowerCase();
  if (type.includes("wav")) return "speech.wav";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) {
    return "speech.m4a";
  }
  if (type.includes("ogg")) return "speech.ogg";
  if (type.includes("mpeg") || type.includes("mp3")) return "speech.mp3";
  return "speech.webm";
}

async function forwardOnce(
  audio: Blob,
  language: string,
): Promise<{ res: Response; data: { text?: string; language?: string; error?: string } | null }> {
  const forward = new FormData();
  forward.append("audio", audio, pickFilename(audio));
  forward.append("language", language);

  const res = await fetch(STT_URL, {
    method: "POST",
    body: forward,
    signal: AbortSignal.timeout(70_000),
  });

  const data = (await res.json().catch(() => null)) as {
    text?: string;
    language?: string;
    error?: string;
  } | null;

  return { res, data };
}

/**
 * 方言模式优先尝试讯飞方言识别大模型（若已配置 Key）。
 * 失败/超时/无文本 → 返回 null，由调用方 fallback 本地 Whisper。
 */
async function tryIflytekDialect(
  audio: Blob,
  language: string,
): Promise<{ text: string; language: string } | null> {
  const config = loadIflytekConfig();
  if (!config) return null;
  // 仅方言模式走讯飞
  if (language !== "teo" && language !== "hak") return null;

  try {
    const wavBytes = new Uint8Array(await audio.arrayBuffer());
    const { text } = await transcribeWithIflytek(config, wavBytes, {
      timeoutMs: 30_000,
    });
    const clean = (text || "").trim();
    if (!clean) return null;
    return { text: clean, language };
  } catch (err) {
    console.warn(
      `[transcribe] iflytek dialect STT failed for ${language}, falling back to local Whisper:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size < 64) {
      return NextResponse.json(
        { error: "No audio captured — hold/tap Mic and speak clearly." },
        { status: 400 },
      );
    }
    if (audio.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Recording too long — try a shorter message." },
        { status: 413 },
      );
    }

    const language = normalizeTranscribeLang(
      String(form.get("language") || "auto"),
    );

    // 方言模式：优先讯飞方言识别（已配置 Key 时），失败自动回退本地 Whisper
    const iflytekResult = await tryIflytekDialect(audio, language);
    if (iflytekResult) {
      return NextResponse.json({
        text: iflytekResult.text,
        language: iflytekResult.language,
        engine: "iflytek",
      });
    }

    let { res, data } = await forwardOnce(audio, language);

    // One retry on transient STT failures (queue / restart / decode blip)
    if (!res.ok && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 400));
      ({ res, data } = await forwardOnce(audio, language));
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            data?.error ||
            (res.status === 503
              ? "Voice service busy — try again in a moment."
              : "Speech recognition failed — try again."),
        },
        { status: res.status === 400 || res.status === 422 ? res.status : 502 },
      );
    }

    const text = (data?.text || "").trim();
    if (!text) {
      return NextResponse.json(
        {
          error:
            "Didn’t catch that — speak a bit louder, or pick the matching language voice.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text,
      language: data?.language || language,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transcribe failed";
    const busy =
      /fetch|ECONNREFUSED|timeout|AbortError|undici/i.test(msg);
    return NextResponse.json(
      {
        error: busy
          ? "Voice service starting up — wait a few seconds and try again."
          : msg,
      },
      { status: 503 },
    );
  }
}
