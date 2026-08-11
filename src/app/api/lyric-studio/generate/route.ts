/**
 * POST /api/lyric-studio/generate
 * Body: { lyrics, caption|prompt, title?, accountId?, gender? }
 * Bailian Fun-Music → Volc GenSongV4 (prepaid) → GenSongForTime (postpaid).
 */

import { randomBytes } from "node:crypto";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import {
  generateSongWithFallback,
  isMusicGenerateConfigured,
} from "@/lib/music-generate";
import { addCreation } from "@/lib/entertain/creations-store";
import { writeMediaBytes } from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function safeAccount(id: string | null | undefined): string {
  const s = (id || "acct_ryan").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return s || "acct_ryan";
}

async function audioToBuffer(
  audioUrl?: string,
  audioBase64?: string,
): Promise<{ buf: Buffer; mime: string } | null> {
  if (audioBase64) {
    const cleaned = audioBase64.replace(/^data:[^;]+;base64,/, "");
    try {
      return { buf: Buffer.from(cleaned, "base64"), mime: "audio/mpeg" };
    } catch {
      return null;
    }
  }
  if (!audioUrl) return null;
  try {
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") || "audio/mpeg";
    const ab = await res.arrayBuffer();
    return { buf: Buffer.from(ab), mime };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "lyric-generate", {
    limit: 6,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!isMusicGenerateConfigured()) {
    return Response.json(
      {
        ok: false,
        status: "unconfigured",
        error:
          "未配置音乐服务。可设 ALIYUN_DASHSCOPE_API_KEY（百炼 Fun-Music）和/或 VOLC_ACCESS_KEY_ID + VOLC_SECRET_ACCESS_KEY（火山 GenSong）。歌词草稿仍可保存。",
      },
      { status: 503 },
    );
  }

  let body: {
    lyrics?: string;
    caption?: string;
    prompt?: string;
    title?: string;
    accountId?: string;
    gender?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const lyrics = String(body.lyrics || "").trim().slice(0, 8000);
  const caption = String(body.caption || body.prompt || "")
    .trim()
    .slice(0, 500);
  if (!lyrics || lyrics.length < 20) {
    return Response.json(
      { ok: false, error: "Lyrics too short" },
      { status: 400 },
    );
  }

  const accountId = safeAccount(body.accountId);
  const title = String(body.title || "Untitled song").slice(0, 160);
  const gender = body.gender === "male" ? "male" : "female";

  const result = await generateSongWithFallback({
    lyrics,
    caption: caption || undefined,
    gender,
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
        requestId: result.requestId,
        taskId: result.taskId,
        attempts: result.attempts,
      },
      { status: 502 },
    );
  }

  const audio = await audioToBuffer(result.audioUrl, result.audioBase64);
  if (!audio) {
    return Response.json(
      {
        ok: false,
        error: "Could not download generated audio",
        attempts: result.attempts,
        provider: result.provider,
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
      sessionId: "lyric-studio",
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
    caption: caption || undefined,
    audioMediaId: mediaId,
    notes: result.provider ? `provider:${result.provider}` : undefined,
  });

  return Response.json({
    ok: true,
    item,
    mediaId,
    audioUrl: `/api/media/${mediaId}`,
    provider: result.provider,
    requestId: result.requestId,
    taskId: result.taskId,
    durationSec: result.durationSec,
    attempts: result.attempts,
  });
}
