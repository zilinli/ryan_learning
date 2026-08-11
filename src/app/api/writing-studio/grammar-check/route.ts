/**
 * POST /api/writing-studio/grammar-check
 * Body: { text: string, language?: string }
 * Returns: { ok, matches, source }
 */

import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { checkGrammar } from "@/lib/entertain/languagetool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "ws-grammar", RATE_PRESETS.entertain);
  if (limited) return limited;

  let body: { text?: unknown; language?: unknown };
  try {
    body = (await req.json()) as { text?: unknown; language?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.text ?? "");
  if (text.length > 20_000) {
    return Response.json({ error: "Text too long" }, { status: 400 });
  }
  const language = String(body.language || "en-US").slice(0, 16);

  try {
    const result = await checkGrammar(text, { language });
    return Response.json({
      ok: true,
      matches: result.matches,
      source: result.source,
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Grammar check failed",
      },
      { status: 502 },
    );
  }
}
