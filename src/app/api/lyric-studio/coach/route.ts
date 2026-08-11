/**
 * POST /api/lyric-studio/coach
 * Body: {
 *   action: "coach" | "structure" | "extract",
 *   draft?, genre?,
 *   images?: { name?, mimeType, data }[],
 *   fileText?: string
 * }
 * Coach = Socratic writing tips; structure = lyrics; extract = OCR/file → pad text.
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage, SDKUserMessage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { stripDataUrlPrefix } from "@/lib/attachments";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

const GENRES = ["Indie", "Orchestral", "Hip-hop sketch", "Ballad"] as const;
const MAX_IMAGES = 3;

function localStructure(draft: string, genre: string): {
  lyrics: string;
  caption: string;
} {
  const lines = draft
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const half = Math.max(2, Math.ceil(lines.length / 2));
  const v1 = lines.slice(0, half).join("\n") || "Something I noticed today…";
  const chorus =
    lines.slice(half, half + 2).join("\n") || "Hold the feeling — say it twice.";
  const lyrics = `[Verse]\n${v1}\n\n[Chorus]\n${chorus}\n\n[Verse]\n${lines.slice(half + 2).join("\n") || "Then the world shifted slightly…"}\n\n[Chorus]\n${chorus}`;
  const caption = `${genre} mood, clear vocal, mid tempo, sincere storytelling, studio demo`;
  return { lyrics, caption };
}

function localCoach(draft: string): string {
  const words = draft.trim().split(/\s+/).filter(Boolean).length;
  const tips: string[] = [];
  if (words < 20) {
    tips.push(
      "Add one concrete sensory detail — a place, a sound, or a specific moment.",
    );
  } else {
    tips.push(
      "Underline your strongest image. Can you make the next line more specific than the last?",
    );
    tips.push(
      "Don't need a full song yet — chase one honest sentence, then expand around it.",
    );
  }
  if (!/[.!?]/.test(draft)) {
    tips.push("Try ending one line with a question the chorus could answer.");
  }
  return tips.join("\n\n");
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "lyric-coach", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: {
    action?: string;
    draft?: string;
    genre?: string;
    images?: Array<{ name?: string; mimeType?: string; data?: string }>;
    fileText?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action =
    body.action === "structure"
      ? "structure"
      : body.action === "extract"
        ? "extract"
        : "coach";
  const draft = String(body.draft || "").trim().slice(0, 6000);
  const fileText = String(body.fileText || "").trim().slice(0, 8000);
  const genre = GENRES.includes(body.genre as (typeof GENRES)[number])
    ? String(body.genre)
    : "Indie";
  const images = (body.images || []).slice(0, MAX_IMAGES);

  if (action === "extract") {
    if (!fileText && images.length === 0) {
      return Response.json(
        { ok: false, error: "Provide a file or photo to extract" },
        { status: 400 },
      );
    }
    if (fileText && images.length === 0) {
      return Response.json({ ok: true, text: fileText.slice(0, 8000) });
    }

    const sdkImages: SDKImage[] = [];
    for (const img of images) {
      const data = stripDataUrlPrefix(img.data || "");
      if (data.length < 8) continue;
      sdkImages.push({
        data,
        mimeType: img.mimeType?.startsWith("image/")
          ? img.mimeType
          : "image/jpeg",
      });
    }
    if (!sdkImages.length && !fileText) {
      return Response.json(
        { ok: false, error: "Could not read image" },
        { status: 400 },
      );
    }

    let agent: SDKAgent | null = null;
    try {
      agent = await Agent.create({
        apiKey: apiKey(),
        model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
        name: "Writing Pad Extract",
        local: {
          cwd: path.join(process.cwd(), "tutor-workspace"),
          settingSources: [],
        },
      });
      let full = "";
      const prompt = [
        "Extract the student's writing from the attached photo(s) and/or file text.",
        "Return ONLY the plain text to paste into a writing pad — no commentary, no markdown fences.",
        "Preserve line breaks when they look intentional. Fix obvious OCR typos lightly.",
        "If the image has no readable text, return an empty string.",
        fileText ? `\nExtra file text:\n${fileText}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const userMsg: SDKUserMessage =
        sdkImages.length > 0
          ? { text: prompt, images: sdkImages }
          : { text: prompt };
      const run = await agent.send(userMsg, {
        onDelta: ({ update }) => {
          if (update.type === "text-delta" && update.text) full += update.text;
        },
      });
      for await (const ev of run.stream()) {
        if (req.signal.aborted) break;
        if (ev.type === "assistant") {
          for (const block of ev.message.content) {
            if (
              block.type === "text" &&
              block.text &&
              block.text.length > full.length
            ) {
              full = block.text;
            }
          }
        }
      }
      const text = full
        .replace(/^```[\w]*\n?|\n?```$/g, "")
        .trim()
        .slice(0, 8000);
      if (text) return Response.json({ ok: true, text });
    } catch (err) {
      if (!(err instanceof CursorAgentError) && !(err instanceof Error)) {
        /* fall through */
      }
    } finally {
      try {
        agent?.close();
      } catch {
        /* ignore */
      }
    }
    if (fileText) {
      return Response.json({ ok: true, text: fileText.slice(0, 8000) });
    }
    return Response.json(
      { ok: false, error: "Could not extract text from image" },
      { status: 502 },
    );
  }

  if (!draft) {
    return Response.json({ ok: false, error: "Draft is empty" }, { status: 400 });
  }

  if (action === "structure") {
    const fallback = localStructure(draft, genre);
    let agent: SDKAgent | null = null;
    try {
      agent = await Agent.create({
        apiKey: apiKey(),
        model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
        name: "Lyric Structure",
        local: {
          cwd: path.join(process.cwd(), "tutor-workspace"),
          settingSources: [],
        },
      });
      let full = "";
      const prompt = [
        "You format student writing into song lyrics for Bailian Fun-Music.",
        "Never ghostwrite a wholly new song — reshape THEIR words.",
        'Return ONLY JSON: {"lyrics":"...","caption":"..."}',
        "lyrics must use [Verse] / [Chorus] / optional [Bridge] section tags.",
        `Genre/mood for caption: ${genre}. Caption = short English style prompt (instruments, tempo, mood).`,
        "",
        "Draft:",
        draft,
      ].join("\n");
      const run = await agent.send(
        { text: prompt },
        {
          onDelta: ({ update }) => {
            if (update.type === "text-delta" && update.text) full += update.text;
          },
        },
      );
      for await (const ev of run.stream()) {
        if (req.signal.aborted) break;
        if (ev.type === "assistant") {
          for (const block of ev.message.content) {
            if (
              block.type === "text" &&
              block.text &&
              block.text.length > full.length
            ) {
              full = block.text;
            }
          }
        }
      }
      const m = /\{[\s\S]*\}/.exec(full);
      if (m) {
        const parsed = JSON.parse(m[0]) as {
          lyrics?: string;
          caption?: string;
        };
        if (parsed.lyrics && parsed.lyrics.includes("[")) {
          return Response.json({
            ok: true,
            lyrics: String(parsed.lyrics).slice(0, 8000),
            caption: String(parsed.caption || fallback.caption).slice(0, 500),
          });
        }
      }
    } catch (err) {
      if (!(err instanceof CursorAgentError) && !(err instanceof Error)) {
        /* fall through */
      }
    } finally {
      try {
        agent?.close();
      } catch {
        /* ignore */
      }
    }
    return Response.json({ ok: true, ...fallback });
  }

  // coach
  let coach = localCoach(draft);
  let agent: SDKAgent | null = null;
  try {
    agent = await Agent.create({
      apiKey: apiKey(),
      model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
      name: "Writing Coach",
      local: {
        cwd: path.join(process.cwd(), "tutor-workspace"),
        settingSources: [],
      },
    });
    let full = "";
    const prompt = [
      "You are a witty writing coach for an international-school student writing song lyrics.",
      "Socratic: ask 1–2 sharp questions and give 1 concrete craft tip.",
      "Never rewrite the whole draft. Never be babyish. Max 120 words.",
      `Genre vibe: ${genre}.`,
      "",
      "Draft:",
      draft,
    ].join("\n");
    const run = await agent.send(
      { text: prompt },
      {
        onDelta: ({ update }) => {
          if (update.type === "text-delta" && update.text) full += update.text;
        },
      },
    );
    for await (const ev of run.stream()) {
      if (req.signal.aborted) break;
      if (ev.type === "assistant") {
        for (const block of ev.message.content) {
          if (
            block.type === "text" &&
            block.text &&
            block.text.length > full.length
          ) {
            full = block.text;
          }
        }
      }
    }
    if (full.trim().length > 20) coach = full.trim().slice(0, 1200);
  } catch {
    /* local coach */
  } finally {
    try {
      agent?.close();
    } catch {
      /* ignore */
    }
  }
  return Response.json({ ok: true, coach });
}
