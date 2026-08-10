/**
 * POST /api/translate-en
 * Fast English gloss for a tutor chat bubble (Google gtx, auto-detect source).
 * Strips SVG / markdown noise via cleanTutorSpeechText first.
 */

import { cleanTutorSpeechText } from "@/lib/tts-text";
import { gtxTranslatePassage } from "@/lib/dict-translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 6_000;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string };
    const raw = typeof body.text === "string" ? body.text : "";
    const text = cleanTutorSpeechText(raw).slice(0, MAX_TEXT);
    if (!text || text.length < 2) {
      return Response.json({ error: "empty text" }, { status: 400 });
    }

    const result = await gtxTranslatePassage(text, "en");
    if (!result?.translation) {
      return Response.json(
        { error: "Translation unavailable — try again in a moment." },
        { status: 503 },
      );
    }

    return Response.json({
      translation: result.translation,
      alreadyEnglish: result.alreadyTarget,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Translation failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
