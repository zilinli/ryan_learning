/**
 * POST /api/writing-studio/coach
 * Body: {
 *   action: "coach" | "mentor" | "structure" | "extract",
 *   draft?, genre?,
 *   target?: "music" | "image" | "video",
 *   images?: { name?, mimeType, data }[],
 *   fileText?: string,
 *   studentReply?, history?, focusIds?, craftTip?  (mentor)
 * }
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage, SDKUserMessage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { stripDataUrlPrefix } from "@/lib/attachments";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  isNearVerbatimStructure,
  looksLikeLyricStructure,
  structureDraftLocal,
  type StudioStructureTarget,
} from "@/lib/entertain/studio-structure";
import {
  basisCoachAgentPrompt,
  buildBasisCoachLocal,
  mergeBasisCoachFromLlm,
  type BasisCoachReport,
  type BasisDimensionId,
  type WritingType,
  WRITING_TYPES,
} from "@/lib/entertain/basis-writing";
import {
  localMentorReply,
  mentorTurnAgentPrompt,
  type MentorChatTurn,
} from "@/lib/entertain/basis-mentor-session";
import { localHeuristicGrammarCheck } from "@/lib/entertain/languagetool";
import {
  normalizeStageStyle,
  suggestStageStyle,
} from "@/lib/entertain/stage-styles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

const MAX_IMAGES = 3;

function parseTarget(raw: unknown): StudioStructureTarget {
  const t = String(raw || "music").toLowerCase();
  if (t === "image" || t === "video" || t === "music") return t;
  return "music";
}

function localCoach(draft: string, target: StudioStructureTarget): string {
  if (target === "music") {
    return buildBasisCoachLocal(draft).summary;
  }
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
  // video
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

function structureAgentPrompt(
  draft: string,
  genre: string,
  target: StudioStructureTarget,
): string {
  if (target === "image") {
    return [
      "Turn the student's writing into a TEXT-TO-IMAGE prompt.",
      "Return ONLY JSON: {\"body\":\"...\",\"caption\":\"...\",\"prompt\":\"...\"}",
      "CREATIVELY ADAPT: extract subject, setting, mood, and concrete images — do NOT paste essay paragraphs.",
      "body = concise visual scene (subject, setting, mood). NO [Verse]/[Chorus] tags.",
      "caption = style notes (medium, lighting, composition).",
      "prompt = body + caption fused for an image model (Flux-ready).",
      "Never output song lyrics or karaoke structure.",
      "Match the draft's language for any wording that must stay (names); scene prose may be English for the model.",
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
      "CREATIVELY ADAPT: invent continuous action + camera move from the student's ideas — do NOT paste the essay.",
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
    "You turn student writing into song lyrics for music generation.",
    "CREATIVELY ADAPT the language: write singable lyric lines inspired by their themes, emotions, and images.",
    "Do NOT copy paragraphs or paste the draft under [Verse]/[Chorus]. Transform into lyric diction (refrain, imagery, rhythm).",
    "Keep the student's core meaning and key concrete nouns; match the draft language (EN/ZH/etc.).",
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
    writingType?: string;
    target?: string;
    images?: Array<{ name?: string; mimeType?: string; data?: string }>;
    fileText?: string;
    studentReply?: string;
    craftTip?: string;
    focusIds?: string[];
    history?: Array<{ role?: string; text?: string }>;
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
        : body.action === "mentor"
          ? "mentor"
          : "coach";
  const target = parseTarget(body.target);
  const draft = String(body.draft || "").trim().slice(0, 6000);
  const fileText = String(body.fileText || "").trim().slice(0, 8000);
  const genre = normalizeStageStyle(target, String(body.genre || ""));
  const writingTypeRaw = String(body.writingType || "free").toLowerCase();
  const writingType: WritingType = WRITING_TYPES.some((t) => t.id === writingTypeRaw)
    ? (writingTypeRaw as WritingType)
    : "free";
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

  if (action === "mentor") {
    const studentReply = String(body.studentReply || "").trim().slice(0, 1200);
    if (!studentReply) {
      return Response.json(
        { ok: false, error: "Reply is empty" },
        { status: 400 },
      );
    }
    const ORDER: BasisDimensionId[] = ["topic", "detail", "vocab", "grammar"];
    const focusIds = Array.isArray(body.focusIds)
      ? body.focusIds
          .map((x) => String(x) as BasisDimensionId)
          .filter((id) => ORDER.includes(id))
          .slice(0, 2)
      : [];
    const history: MentorChatTurn[] = Array.isArray(body.history)
      ? body.history
          .map((t) => ({
            role: t.role === "you" ? ("you" as const) : ("coach" as const),
            text: String(t.text || "").trim().slice(0, 800),
          }))
          .filter((t) => t.text)
          .slice(-10)
      : [];
    const craftTip = String(body.craftTip || "").trim().slice(0, 320);
    const localReport = buildBasisCoachLocal(draft);
    let reply = localMentorReply(studentReply, localReport, draft);
    let agent: SDKAgent | null = null;
    try {
      agent = await Agent.create({
        apiKey: apiKey(),
        model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
        name: "Writing Mentor",
        local: {
          cwd: path.join(process.cwd(), "tutor-workspace"),
          settingSources: [],
        },
      });
      let full = "";
      const run = await agent.send(
        {
          text: mentorTurnAgentPrompt({
            draft,
            genre,
            target,
            focusIds: focusIds.length ? focusIds : localReport.focusIds,
            history,
            studentReply,
            craftTip: craftTip || localReport.craftTip,
          }),
        },
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
      const cleaned = full
        .replace(/^```[\w]*\n?|\n?```$/g, "")
        .trim()
        .slice(0, 900);
      if (cleaned.length > 12) reply = cleaned;
    } catch {
      /* local mentor */
    } finally {
      try {
        agent?.close();
      } catch {
        /* ignore */
      }
    }
    return Response.json({ ok: true, reply, target });
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
          if (
            lyrics.includes("[") &&
            !isNearVerbatimStructure(draft, lyrics)
          ) {
            return Response.json({
              ok: true,
              target,
              lyrics: lyrics.slice(0, 8000),
              body: lyrics.slice(0, 8000),
              caption: String(parsed.caption || fallback.caption).slice(0, 500),
              prompt: String(parsed.caption || fallback.prompt).slice(0, 1200),
              suggestedStyle: suggestStageStyle(target, lyrics),
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
            !looksLikeLyricStructure(prompt) &&
            !isNearVerbatimStructure(draft, bodyText)
          ) {
            return Response.json({
              ok: true,
              target,
              body: bodyText.slice(0, 8000),
              lyrics: bodyText.slice(0, 8000),
              caption,
              prompt: prompt.slice(0, 1200),
              suggestedStyle: suggestStageStyle(target, bodyText),
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
      suggestedStyle: suggestStageStyle(
        fallback.target,
        fallback.body || fallback.lyrics,
      ),
    });
  }

  // coach
  if (target === "music") {
    const grammarMatchCount = localHeuristicGrammarCheck(draft).length;
    const localReport = buildBasisCoachLocal(draft, {
      grammarMatchCount,
      writingType,
    });
    let report: BasisCoachReport = localReport;
    let agent: SDKAgent | null = null;
    try {
      agent = await Agent.create({
        apiKey: apiKey(),
        model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
        name: "Writing Coach BASIS",
        local: {
          cwd: path.join(process.cwd(), "tutor-workspace"),
          settingSources: [],
        },
      });
      let full = "";
      const run = await agent.send(
        { text: basisCoachAgentPrompt(draft, genre, writingType) },
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
        try {
          report = mergeBasisCoachFromLlm(localReport, JSON.parse(m[0]));
        } catch {
          /* keep local */
        }
      }
    } catch {
      /* local report */
    } finally {
      try {
        agent?.close();
      } catch {
        /* ignore */
      }
    }
    return Response.json({
      ok: true,
      target,
      coach: report.summary,
      report,
    });
  }

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
        : "Student is drafting toward a short video prompt.";
    const prompt = [
      "You are Spark — a calm writing tutor for an international-school student.",
      modeHint,
      "Think-first: (1) praise ONE specific choice in their words,",
      "(2) ask ONE sharp question,",
      "(3) at most one tiny craft nudge — never rewrite their sentences.",
      "Stop and wait. Max 90 words. Never be babyish.",
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
  return Response.json({ ok: true, coach, target });
}
