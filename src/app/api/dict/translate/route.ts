/**
 * POST /api/dict/translate
 *
 * Sentence / paragraph / photo translation via Cursor Agent (LLM).
 * Body: { text?, from, to, images?[] }
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage, SDKUserMessage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { stripDataUrlPrefix } from "@/lib/attachments";
import {
  buildSentenceTranslatePrompt,
  parseSentenceTranslateJson,
} from "@/lib/dict-sentence";
import type {
  DictLang,
  SentenceTranslateRequest,
  TranslateLang,
} from "@/lib/dict-types";
import { DICT_LANG_LABELS } from "@/lib/dict-types";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID_TO = Object.keys(DICT_LANG_LABELS) as DictLang[];
const VALID_FROM: TranslateLang[] = ["auto", ...VALID_TO];
const MAX_IMAGES = 3;
const MAX_TEXT = 4_000;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "dict-translate", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: SentenceTranslateRequest;
  try {
    body = (await req.json()) as SentenceTranslateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  const from = (body.from || "auto") as TranslateLang;
  const to = (body.to || "en") as DictLang;
  const images = (body.images || []).slice(0, MAX_IMAGES);

  if (!VALID_FROM.includes(from)) {
    return Response.json({ error: "Invalid 'from' language" }, { status: 400 });
  }
  if (!VALID_TO.includes(to)) {
    return Response.json({ error: "Invalid 'to' language" }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return Response.json(
      { error: `Text too long (max ${MAX_TEXT} characters)` },
      { status: 400 },
    );
  }
  if (!text && images.length === 0) {
    return Response.json(
      { error: "Provide sentence text or at least one photo." },
      { status: 400 },
    );
  }

  const sdkImages: SDKImage[] = [];
  for (const img of images) {
    const data = stripDataUrlPrefix(img.data || "");
    if (data.length < 8) {
      return Response.json(
        { error: `Photo "${img.name || "image"}" looks empty — try again.` },
        { status: 400 },
      );
    }
    sdkImages.push({
      data,
      mimeType: img.mimeType?.startsWith("image/")
        ? img.mimeType
        : "image/jpeg",
    });
  }

  const prompt = buildSentenceTranslatePrompt({
    text,
    from,
    to,
    hasImages: sdkImages.length > 0,
  });

  let agent: SDKAgent | null = null;
  const close = () => {
    try {
      agent?.close();
    } catch {
      // ignore
    }
  };
  const onAbort = () => close();
  req.signal.addEventListener("abort", onAbort);

  try {
    agent = await Agent.create({
      apiKey: apiKey(),
      model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
      name: "Spark Translator",
      local: {
        cwd: path.join(process.cwd(), "tutor-workspace"),
        settingSources: [],
      },
    });

    const userMsg: SDKUserMessage =
      sdkImages.length > 0
        ? { text: prompt, images: sdkImages }
        : { text: prompt };

    let full = "";
    const run = await agent.send(userMsg, {
      onDelta: ({ update }) => {
        if (update.type === "text-delta" && update.text) {
          full += update.text;
        }
      },
    });

    for await (const ev of run.stream()) {
      if (req.signal.aborted) break;
      if (ev.type === "assistant") {
        for (const block of ev.message.content) {
          if (block.type === "text" && block.text && block.text.length > full.length) {
            full = block.text;
          }
        }
      }
    }

    const parsed = parseSentenceTranslateJson(full, from, to);
    if (!parsed?.translation) {
      return Response.json(
        {
          error: "Could not parse translation. Please try again.",
          raw: full.slice(0, 500),
        },
        { status: 502 },
      );
    }

    return Response.json(parsed);
  } catch (err) {
    if (req.signal.aborted) {
      return Response.json({ error: "Cancelled" }, { status: 499 });
    }
    const msg =
      err instanceof CursorAgentError
        ? `Translator failed: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Translation failed";
    return Response.json({ error: msg }, { status: 500 });
  } finally {
    req.signal.removeEventListener("abort", onAbort);
    close();
  }
}
