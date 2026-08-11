/**
 * POST /api/studio/generate
 * Body: { kind: "music"|"image"|"video", prompt?, lyrics?, caption?, title?, accountId?, gender? }
 *
 * text2X via deAPI.ai (music also falls back through music-generate → Bailian/Volc).
 */

import { randomBytes } from "node:crypto";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import {
  deapiGenerateImage,
  deapiGenerateVideo,
  isDeapiConfigured,
} from "@/lib/deapi-client";
import {
  generateSongWithFallback,
  isMusicGenerateConfigured,
} from "@/lib/music-generate";
import {
  addCreation,
  type CreationType,
} from "@/lib/entertain/creations-store";
import {
  assertVisualPromptOk,
  buildVisualPrompt,
  looksLikeLyricStructure,
} from "@/lib/entertain/studio-structure";
import { writeMediaBytes } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

function safeAccount(id: string | null | undefined): string {
  const s = (id || "acct_ryan").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return s || "acct_ryan";
}

async function downloadUrl(
  url: string,
  fallbackMime: string,
): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") || fallbackMime;
    const ab = await res.arrayBuffer();
    return { buf: Buffer.from(ab), mime };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "studio-generate", {
    limit: 8,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: {
    kind?: string;
    lyrics?: string;
    caption?: string;
    prompt?: string;
    title?: string;
    accountId?: string;
    gender?: string;
    durationSec?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const kind = String(body.kind || "music").toLowerCase();
  if (kind !== "music" && kind !== "image" && kind !== "video") {
    return Response.json(
      { ok: false, error: "kind must be music | image | video" },
      { status: 400 },
    );
  }

  const accountId = safeAccount(body.accountId);
  const title = String(body.title || `Untitled ${kind}`).slice(0, 160);
  const lyrics = String(body.lyrics || "").trim().slice(0, 8000);
  const caption = String(body.caption || "")
    .trim()
    .slice(0, 500);
  const rawPrompt = String(body.prompt || "").trim().slice(0, 4000);

  if (kind === "music") {
    if (!isMusicGenerateConfigured()) {
      return Response.json(
        {
          ok: false,
          status: "unconfigured",
          error:
            "未配置音乐服务。请设 DEAPI_API_KEY（推荐），或百炼 Fun-Music / 火山 GenSong。",
        },
        { status: 503 },
      );
    }
    if (!lyrics || lyrics.length < 20) {
      return Response.json(
        { ok: false, error: "Lyrics too short" },
        { status: 400 },
      );
    }
    const gender = body.gender === "male" ? "male" : "female";
    const musicCaption = caption || rawPrompt.slice(0, 500) || undefined;
    const result = await generateSongWithFallback({
      lyrics,
      caption: musicCaption,
      gender,
      durationSec: body.durationSec,
    });
    if (result.status === "unconfigured") {
      return Response.json(
        {
          ok: false,
          status: "unconfigured",
          error: result.error,
          attempts: result.attempts,
        },
        { status: 503 },
      );
    }
    if (result.status !== "done") {
      return Response.json(
        {
          ok: false,
          status: result.status,
          error: result.error || "Generation failed",
          provider: result.provider,
          attempts: result.attempts,
        },
        { status: 502 },
      );
    }
    let audio: { buf: Buffer; mime: string } | null = null;
    if (result.audioBase64) {
      const cleaned = result.audioBase64.replace(/^data:[^;]+;base64,/, "");
      try {
        audio = {
          buf: Buffer.from(cleaned, "base64"),
          mime: result.mimeType || "audio/mpeg",
        };
      } catch {
        audio = null;
      }
    }
    if (!audio && result.audioUrl) {
      audio = await downloadUrl(result.audioUrl, result.mimeType || "audio/mpeg");
    }
    if (!audio) {
      return Response.json(
        {
          ok: false,
          error: "Could not download generated audio",
          attempts: result.attempts,
        },
        { status: 502 },
      );
    }
    const mediaId = `song_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const meta = await writeMediaBytes(
      mediaId,
      audio.buf,
      result.mimeType || audio.mime,
      {
        sessionId: "writing-studio",
        messageId: "generate",
        attachmentId: mediaId,
        name: `${title}.mp3`,
        kind: "file",
        accountId,
      },
    );
    if (!meta) {
      return Response.json(
        { ok: false, error: "Failed to store audio" },
        { status: 500 },
      );
    }
    const item = await addCreation(accountId, {
      type: "song",
      title,
      lyrics,
      caption: musicCaption,
      audioMediaId: mediaId,
      notes: result.provider ? `provider:${result.provider}` : undefined,
    });
    return Response.json({
    ok: true,
    kind: "music",
    item,
    mediaId,
    url: `/api/media/${mediaId}`,
    audioUrl: `/api/media/${mediaId}`,
    provider: result.provider,
    requestId: result.requestId,
    durationSec: result.durationSec,
    attempts: result.attempts,
  });
}

  // image | video — deAPI only; reject lyric-shaped prompts
  if (!isDeapiConfigured()) {
    return Response.json(
      {
        ok: false,
        status: "unconfigured",
        error: "未配置 DEAPI_API_KEY，无法生成图片/视频。",
      },
      { status: 503 },
    );
  }

  // Prefer an explicit prompt; otherwise fuse Stage body + caption.
  // Reject if the Stage still looks like karaoke lyrics — image/video need visual prose.
  if (looksLikeLyricStructure(rawPrompt) || looksLikeLyricStructure(lyrics)) {
    return Response.json(
      {
        ok: false,
        error:
          "Prompt still looks like song lyrics — restructure for Image/Video first",
      },
      { status: 400 },
    );
  }

  const prompt =
    rawPrompt ||
    buildVisualPrompt(lyrics, caption) ||
    caption ||
    lyrics.slice(0, 800);
  const promptError = assertVisualPromptOk(prompt);
  if (promptError) {
    return Response.json({ ok: false, error: promptError }, { status: 400 });
  }

  const gen =
    kind === "image"
      ? await deapiGenerateImage({ prompt })
      : await deapiGenerateVideo({ prompt });

  if (gen.status === "unconfigured") {
    return Response.json(
      { ok: false, status: "unconfigured", error: gen.error },
      { status: 503 },
    );
  }
  if (gen.status !== "done" || !gen.resultUrl) {
    return Response.json(
      {
        ok: false,
        status: "error",
        error: gen.error || "Generation failed",
        requestId: gen.requestId,
        model: gen.model,
      },
      { status: 502 },
    );
  }

  const fallbackMime = kind === "image" ? "image/png" : "video/mp4";
  const file = await downloadUrl(gen.resultUrl, gen.mimeType || fallbackMime);
  if (!file) {
    return Response.json(
      {
        ok: false,
        error: "Could not download generated media",
        requestId: gen.requestId,
        resultUrl: gen.resultUrl,
      },
      { status: 502 },
    );
  }

  const ext = kind === "image" ? "png" : "mp4";
  const mediaId = `${kind}_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const meta = await writeMediaBytes(mediaId, file.buf, file.mime, {
    sessionId: "writing-studio",
    messageId: kind,
    attachmentId: mediaId,
    name: `${title}.${ext}`,
    kind: kind === "image" ? "image" : "file",
    accountId,
  });
  if (!meta) {
    return Response.json({ ok: false, error: "Failed to store media" }, { status: 500 });
  }

  const creationType: CreationType = kind === "image" ? "image" : "video";
  const item = await addCreation(accountId, {
    type: creationType,
    title,
    caption: prompt.slice(0, 500),
    lyrics: lyrics || undefined,
    mediaId,
    notes: `provider:deapi model:${gen.model || "?"}`,
  });

  return Response.json({
    ok: true,
    kind,
    item,
    mediaId,
    url: `/api/media/${mediaId}`,
    provider: "deapi",
    model: gen.model,
    requestId: gen.requestId,
    durationSec: gen.durationSec,
    prompt,
  });
}
