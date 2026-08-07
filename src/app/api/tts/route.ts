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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string; voice?: string };
    const text = (body.text || "").trim();
    if (!text) {
      return Response.json({ error: "empty text" }, { status: 400 });
    }
    const voice =
      body.voice && ALLOWED_VOICES.has(body.voice)
        ? body.voice
        : "en-US-AvaNeural";

    let { res, errorBody } = await fetchTtsOnce(text, voice);

    // One retry on transient TTS failures (busy / edge blip)
    if (!res.ok && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 350));
      ({ res, errorBody } = await fetchTtsOnce(text, voice));
    }

    if (!res.ok) {
      return Response.json(
        { error: errorBody?.error || "TTS failed" },
        { status: 502 },
      );
    }

    const audio = await res.arrayBuffer();
    if (audio.byteLength < 100) {
      return Response.json(
        { error: "TTS returned empty audio" },
        { status: 502 },
      );
    }
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
