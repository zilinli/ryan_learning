import { NextResponse } from "next/server";
import {
  loadBailianAsrConfig,
  transcribeWithBailian,
} from "@/lib/bailian-asr";
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

/** 讯飞仅作显式备份：STT_BACKUP_IFYTEK=1 才启用（默认关，控费）。 */
export function isIflytekBackupEnabled(): boolean {
  const v = process.env.STT_BACKUP_IFYTEK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
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
): Promise<{
  res: Response;
  data: { text?: string; language?: string; error?: string } | null;
}> {
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
 * 主路径：百炼 Fun-ASR-Flash（客家/闽南/粤等方言）+ Qwen3 降级。
 */
async function tryBailianAsr(
  audio: Blob,
  language: string,
): Promise<{ text: string; language: string; model: string } | null> {
  if (!loadBailianAsrConfig()) return null;
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const result = await transcribeWithBailian(bytes, {
      language,
      mimeHint: audio.type,
      timeoutMs: 45_000,
    });
    const clean = (result.text || "").trim();
    if (!clean) return null;
    return {
      text: clean,
      language: result.language || language,
      model: result.model,
    };
  } catch (err) {
    console.warn(
      `[transcribe] bailian ASR failed for ${language}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 备份：讯飞方言识别（仅 teo/hak，且 STT_BACKUP_IFYTEK=1）。
 */
async function tryIflytekDialectBackup(
  audio: Blob,
  language: string,
): Promise<{ text: string; language: string } | null> {
  if (!isIflytekBackupEnabled()) return null;
  const config = loadIflytekConfig();
  if (!config) return null;
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
      `[transcribe] iflytek backup STT failed for ${language}:`,
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

    // ① 百炼主识别
    const bailian = await tryBailianAsr(audio, language);
    if (bailian) {
      return NextResponse.json({
        text: bailian.text,
        language: bailian.language,
        engine: "bailian",
        model: bailian.model,
      });
    }

    // ② 可选讯飞备份（默认关闭）
    const iflytek = await tryIflytekDialectBackup(audio, language);
    if (iflytek) {
      return NextResponse.json({
        text: iflytek.text,
        language: iflytek.language,
        engine: "iflytek",
      });
    }

    // ③ 本地 Whisper / SenseVoice
    let { res, data } = await forwardOnce(audio, language);

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
      engine: "local",
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
