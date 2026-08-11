/**
 * POST /api/lyric-studio/coach
 * Body: {
 *   action: "coach" | "structure" | "extract",
 *   draft?, genre?,
 *   target?: "music" | "image" | "video",
 *   images?: { name?, mimeType, data }[],
 *   fileText?: string
 * }
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage, SDKUserMessage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { stripDataUrlPrefix } from "@/lib/attachments";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  looksLikeLyricStructure,
  structureDraftLocal,
  type StudioStructureTarget,
} from "@/lib/entertain/studio-structure";

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

function parseTarget(raw: unknown): StudioStructureTarget {
  const t = String(raw || "music").toLowerCase();
  if (t === "image" || t === "video" || t === "music") return t;
  return "music";
}

function localCoach(draft: string, target: StudioStructureTarget): string {
  const words = draft.trim().split(/\s+/).filter(Boolean).length;
  const tips: string[] = [];
  if (target === "image") {
    if (words < 15) {
      tips.push(
        "Name one clear subject and where they are — photo prompts need a concrete scene.",
      );
    } else {
      tips.push(
        "What lighting and camera distance fit this moment? Add one visual detail, not a lyric.",
      );
    }
    tips.push("Avoid song structure tags — image models need a visual description.");
    return tips.join("\n\n");
  }
  if (target === "video") {
    if (words < 15) {
      tips.push(
        "Who or what moves, and how does the camera follow? Video needs action + motion.",
      );
    } else {
      tips.push(
        "Add one camera move (push-in, pan, tracking) and one continuous action beat.",
      );
    }
    tips.push("Keep it cinematic prose — no [Verse]/[Chorus] tags.");
    return tips.join("\n\n");
  }
  // ── Music target — BASIS writing dimensions ──
  if (words < 10) {
    tips.push(
      "Start with one clear topic sentence — what is this song about in one line?",
    );
    tips.push(
      "Underline your strongest image. Can you make the next line more specific than the last?",
    );
  } else {
    // BASIS-aligned craft tips: thesis, detail, vocabulary, grammar
    const lines = draft.split(/\n/).filter(Boolean);
    const firstLine = (lines[0] || "").trim();

    // Topic sentence / thesis clarity
    if (firstLine.length < 15) {
      tips.push(
        "Your opening line is short — try expanding it to one clear topic sentence that tells us what the song is about.",
      );
    } else if (!firstLine.endsWith(".") && !firstLine.endsWith("?") && !firstLine.endsWith("!")) {
      tips.push(
        "Good opening! Try ending your first line with a period so it stands as a clear topic sentence.",
      );
    }

    // Detail support
    const sensoryWords = draft.match(
      /\b(smell|taste|touch|sound|feel|see|saw|hear|heard|warm|cold|bright|dark|loud|quiet|soft|hard|rough|smooth)\b/gi,
    );
    if ((sensoryWords?.length || 0) < 2) {
      tips.push(
        "Add one concrete sensory detail — a sound, a smell, or a texture. Strong writing uses specific evidence, not general feelings.",
      );
    }

    // Vocabulary diversity
    const uniqueWords = new Set(
      draft
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 3),
    );
    if (uniqueWords.size < 12 && words > 15) {
      tips.push(
        "Your vocabulary is clear but could be more varied — try replacing one common word with a more precise choice (e.g., 'walked' → 'strolled' or 'dashed').",
      );
    }

    // Grammar / sentence variety
    const sentenceStarts = draft
      .split(/[.!?]\s+/)
      .filter((s) => s.trim())
      .map((s) => s.trim().split(/\s+/)[0]?.toLowerCase() || "");
    const startVariety = new Set(sentenceStarts);
    if (sentenceStarts.length >= 4 && startVariety.size <= 2) {
      tips.push(
        "Try varying how your sentences begin — too many start the same way. Mix a question, a command, or a short fragment to vary the rhythm.",
      );
    }

    // Always push forward
    tips.push(
      "Don't need a full song yet — chase one honest sentence, then expand around it.",
    );
  }
  if (!/[.!?]/.test(draft)) {
    tips.push("Try ending one line with a question the chorus could answer.");
  }
  return tips.join("\n\n");
}

function structureAgentPrompt(
  draft: string,
  genre: string,
  target: StudioStructureTarget,
): string {
  if (target === "image") {
    return [
      "Turn the student's writing into a TEXT-TO-IMAGE prompt.",
      "Return ONLY JSON: {\"body\":\"...\",\"caption\":\"...\",\"prompt\":\"...\"}",
      "body = concise visual scene (subject, setting, mood). NO [Verse]/[Chorus] tags.",
      "caption = style notes (medium, lighting, composition).",
      "prompt = body + caption fused for an image model (Flux-ready).",
      "Never output song lyrics or karaoke structure.",
      `Genre vibe: ${genre}.`,
      "",
      "Draft:",
      draft,
    ].join("\n");
  }
  if (target === "video") {
    return [
      "Turn the student's writing into a TEXT-TO-VIDEO prompt.",
      "Return ONLY JSON: {\"body\":\"...\",\"caption\":\"...\",\"prompt\":\"...\"}",
      "body = cinematic scene with continuous action + camera move. NO lyric section tags.",
      "caption = style / fps feel / lighting notes.",
      "prompt = body + caption fused for a video model.",
      `Genre vibe: ${genre}.`,
      "",
      "Draft:",
      draft,
    ].join("\n");
  }
  return [
    "You format student writing into song lyrics for music generation.",
    "Never ghostwrite a wholly new song — reshape THEIR words.",
    'Return ONLY JSON: {"lyrics":"...","caption":"..."}',
    "lyrics must use [Verse] / [Chorus] / optional [Bridge] section tags.",
    `Genre/mood for caption: ${genre}. Caption = short English style prompt (instruments, tempo, mood).`,
    "",
    "Draft:",
    draft,
  ].join("\n");
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "lyric-coach", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: {
    action?: string;
    draft?: string;
    genre?: string;
    target?: string;
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
  const target = parseTarget(body.target);
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
    const fallback = structureDraftLocal(draft, genre, target);
    let agent: SDKAgent | null = null;
    try {
      agent = await Agent.create({
        apiKey: apiKey(),
        model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
        name: "Studio Structure",
        local: {
          cwd: path.join(process.cwd(), "tutor-workspace"),
          settingSources: [],
        },
      });
      let full = "";
      const run = await agent.send(
        { text: structureAgentPrompt(draft, genre, target) },
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
          body?: string;
          caption?: string;
          prompt?: string;
        };
        if (target === "music") {
          const lyrics = String(parsed.lyrics || parsed.body || "");
          if (lyrics.includes("[")) {
            return Response.json({
              ok: true,
              target,
              lyrics: lyrics.slice(0, 8000),
              body: lyrics.slice(0, 8000),
              caption: String(parsed.caption || fallback.caption).slice(0, 500),
              prompt: String(parsed.caption || fallback.prompt).slice(0, 1200),
            });
          }
        } else {
          const bodyText = String(parsed.body || parsed.prompt || "");
          const caption = String(parsed.caption || fallback.caption).slice(
            0,
            500,
          );
          const prompt = String(parsed.prompt || bodyText || fallback.prompt);
          if (
            bodyText.length >= 12 &&
            !looksLikeLyricStructure(bodyText) &&
            !looksLikeLyricStructure(prompt)
          ) {
            return Response.json({
              ok: true,
              target,
              body: bodyText.slice(0, 8000),
              lyrics: bodyText.slice(0, 8000),
              caption,
              prompt: prompt.slice(0, 1200),
            });
          }
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
    return Response.json({
      ok: true,
      target: fallback.target,
      lyrics: fallback.lyrics,
      body: fallback.body,
      caption: fallback.caption,
      prompt: fallback.prompt,
    });
  }

  // coach
  let coach = localCoach(draft, target);
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
    const modeHint =
      target === "image"
        ? "Student is drafting toward a still image prompt."
        : target === "video"
          ? "Student is drafting toward a short video prompt."
          : "Student is drafting toward song lyrics.";
    const prompt = [
      "You are a witty writing coach for an international-school student.",
      modeHint,
      target === "music"
        ? "Assess the draft across 4 writing dimensions (be brief — max 2 that need most work):\n" +
          "1. Topic sentence clarity — can the reader tell what the piece is mainly about in one line?\n" +
          "2. Detail support — are there concrete sensory details or evidence, not only general feelings?\n" +
          "3. Vocabulary diversity — are word choices precise and varied, or repetitive?\n" +
          "4. Grammar — are sentences complete and grammatically correct?\n" +
          "Pick the 1-2 dimensions that could improve most and give a SPECIFIC craft tip for each."
        : "",
      "Socratic: ask 1–2 sharp questions and give 1 concrete craft tip.",
      "Never rewrite the whole draft. Never be babyish. Max 120 words.",
      `Genre vibe: ${genre}.`,
      "",
      "Draft:",
      draft,
    ]
      .filter(Boolean)
      .join("\n");
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
  return Response.json({ ok: true, coach, target });
}
