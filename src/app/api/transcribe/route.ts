import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STT_URL = process.env.STT_URL || "http://127.0.0.1:8765/transcribe";

const ALLOWED = new Set(["auto", "en", "zh", "yue", "es", "fr"]);

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

    let language = String(form.get("language") || "auto").toLowerCase();
    if (!ALLOWED.has(language)) language = "auto";

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
