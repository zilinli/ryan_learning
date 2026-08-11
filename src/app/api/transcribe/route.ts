import { NextResponse } from "next/server";
import {
  loadBailianAsrConfig,
  transcribeWithBailian,
} from "@/lib/bailian-asr";
import {
  loadIflytekConfig,
  transcribeWithIflytek,
} from "@/lib/iflytek-asr";
import { sttEngineOrder, type SttEngine } from "@/lib/stt-engine-order";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STT_URL = process.env.STT_URL || "http://127.0.0.1:8765/transcribe";

const ALLOWED = new Set(["auto", "en", "zh", "yue", "es", "fr", "ms", "teo", "hak", "sha"]);

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
    ms: "ms",
    may: "ms",
    msa: "ms",
    malay: "ms",
    "ms-my": "ms",
    bahasa: "ms",
    "bahasa melayu": "ms",
    teo: "teo",
    teochew: "teo",
    teochow: "teo",
    teochiu: "teo",
    chaoshan: "teo",
    hak: "hak",
    hakka: "hak",
    kejiahua: "hak",
    kejia: "hak",
    sha: "sha",
    shanghainese: "sha",
    shanghaihua: "sha",
    "上海话": "sha",
    "上海": "sha",
    wu: "sha",
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

// ── Engine-order STT walk ───────────────────────────────────────────
// For dialect languages (teo/hak): tries each engine in the configured order,
// short-circuiting on first success. Enables quality routing (e.g. iFlytek-first
// for teo if A/B eval confirms it wins).
//
// For non-dialect languages (en/zh/yue/es/fr/auto): fixed Bailian → local chain
// (outage recovery only — unchanged from before).

async function tryIflytekAsr(
  audio: Blob,
  language: string,
): Promise<{ text: string; language: string } | null> {
  const config = loadIflytekConfig();
  if (!config) return null;
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
      `[transcribe] iflytek ASR failed for ${language}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function tryLocalAsr(
  audio: Blob,
  language: string,
): Promise<{ text: string; language: string } | null> {
  let { res, data } = await forwardOnce(audio, language);

  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 400));
    ({ res, data } = await forwardOnce(audio, language));
  }

  if (!res.ok) return null;

  const text = (data?.text || "").trim();
  if (!text) return null;

  return { text, language: data?.language || language };
}

/**
 * Walk the engine order for a language: try each engine, return on first success.
 * Dialect languages (teo/hak) can reorder via STT_ENGINE_ORDER_{LANG} env var;
 * non-dialect languages always use short-circuit Bailian → local.
 */
async function walkEngineOrder(
  audio: Blob,
  language: string,
): Promise<{
  text: string;
  language: string;
  engine: SttEngine;
  model?: string;
}> {
  const order = sttEngineOrder(language);

  for (const engine of order) {
    switch (engine) {
      case "bailian": {
        const result = await tryBailianAsr(audio, language);
        if (result) {
          return {
            text: result.text,
            language: result.language,
            engine: "bailian",
            model: result.model,
          };
        }
        break;
      }
      case "iflytek": {
        const result = await tryIflytekAsr(audio, language);
        if (result) {
          return {
            text: result.text,
            language: result.language,
            engine: "iflytek",
          };
        }
        break;
      }
      case "local": {
        const result = await tryLocalAsr(audio, language);
        if (result) {
          return {
            text: result.text,
            language: result.language,
            engine: "local",
          };
        }
        break;
      }
    }
  }

  throw new Error(
    `No STT engine succeeded for ${language} (tried: ${order.join(", ")})`,
  );
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "transcribe", RATE_PRESETS.voice);
  if (limited) return limited;

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

    // Walk engine order: dialect languages (teo/hak) honour STT_ENGINE_ORDER_{LANG};
    // non-dialect languages use default Bailian → local.
    try {
      const result = await walkEngineOrder(audio, language);
      return NextResponse.json({
        text: result.text,
        language: result.language,
        engine: result.engine,
        model: result.model,
      });
    } catch (err) {
      // All engines failed
      const msg = err instanceof Error ? err.message : "Transcribe failed";
      return NextResponse.json(
        {
          error:
            "Didn't catch that — speak a bit louder, or pick the matching language voice.",
        },
        { status: 422 },
      );
    }
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
