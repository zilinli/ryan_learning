import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STT_URL = process.env.STT_URL || "http://127.0.0.1:8765/transcribe";

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

    const forward = new FormData();
    const filename =
      (audio as File).name ||
      (audio.type.includes("mp4")
        ? "speech.mp4"
        : audio.type.includes("ogg")
          ? "speech.ogg"
          : "speech.webm");
    forward.append("audio", audio, filename);

    const res = await fetch(STT_URL, {
      method: "POST",
      body: forward,
      signal: AbortSignal.timeout(90_000),
    });

    const data = (await res.json().catch(() => null)) as {
      text?: string;
      error?: string;
    } | null;

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || "Speech recognition failed" },
        { status: 502 },
      );
    }

    const text = (data?.text || "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Didn’t catch that — try again a bit louder." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transcribe failed";
    return NextResponse.json(
      {
        error:
          msg.includes("fetch") || msg.includes("ECONNREFUSED")
            ? "Voice service starting up — wait a few seconds and try again."
            : msg,
      },
      { status: 503 },
    );
  }
}
