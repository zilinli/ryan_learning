/**
 * Lyric Studio music generation with provider fallback:
 *   1) Bailian Fun-Music (ALIYUN_DASHSCOPE_API_KEY)
 *   2) Volcengine GenSongV4 prepaid → GenSongForTime postpaid
 */

import {
  funMusicGenerate,
  isFunMusicConfigured,
  type FunMusicGender,
  type FunMusicGenerateResult,
} from "./fun-music-client";
import {
  isVolcMusicConfigured,
  volcGenerateSongWithBillingFallback,
  type VolcMusicGenerateResult,
} from "./volc-gensong-client";

export type MusicProviderId =
  | "bailian-fun-music"
  | "volc-prepaid"
  | "volc-postpaid";

export type MusicGenerateInput = {
  lyrics: string;
  /** Style notes — used by Volc when helpful; Bailian ignores when lyrics set */
  caption?: string;
  gender?: "male" | "female";
  durationSec?: number;
};

export type MusicGenerateResult = {
  ok: boolean;
  status: "done" | "error" | "unconfigured";
  provider?: MusicProviderId;
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
  requestId?: string;
  taskId?: string;
  generatedLyrics?: string;
  durationSec?: number;
  error?: string;
  /** Human-readable trail of attempts */
  attempts: string[];
  raw?: unknown;
};

export function isMusicGenerateConfigured(): boolean {
  return isFunMusicConfigured() || isVolcMusicConfigured();
}

function fromFun(
  r: FunMusicGenerateResult,
): Omit<MusicGenerateResult, "attempts"> {
  return {
    ok: r.ok,
    status:
      r.status === "done"
        ? "done"
        : r.status === "unconfigured"
          ? "unconfigured"
          : "error",
    provider: "bailian-fun-music",
    audioUrl: r.audioUrl,
    audioBase64: r.audioBase64,
    mimeType: r.mimeType,
    requestId: r.requestId,
    generatedLyrics: r.generatedLyrics,
    durationSec: r.durationSec,
    error: r.error,
    raw: r.raw,
  };
}

function fromVolc(
  r: VolcMusicGenerateResult,
): Omit<MusicGenerateResult, "attempts"> {
  const provider: MusicProviderId =
    r.provider === "volc-prepaid" ? "volc-prepaid" : "volc-postpaid";
  return {
    ok: r.ok,
    status:
      r.status === "done"
        ? "done"
        : r.status === "unconfigured"
          ? "unconfigured"
          : "error",
    provider,
    audioUrl: r.audioUrl,
    mimeType: r.mimeType,
    requestId: r.requestId,
    taskId: r.taskId,
    generatedLyrics: r.generatedLyrics,
    durationSec: r.durationSec,
    error: r.error,
    raw: r.raw,
  };
}

/**
 * Prefer Bailian; on failure / unconfigured / access denied → Volc prepaid then postpaid.
 */
export async function generateSongWithFallback(
  input: MusicGenerateInput,
): Promise<MusicGenerateResult> {
  const attempts: string[] = [];
  const gender = input.gender === "male" ? "male" : "female";

  if (isFunMusicConfigured()) {
    attempts.push("try:bailian-fun-music");
    const funGender: FunMusicGender = gender;
    const r = await funMusicGenerate({
      lyrics: input.lyrics,
      gender: funGender,
    });
    if (r.status === "done") {
      attempts.push("ok:bailian-fun-music");
      return { ...fromFun(r), attempts };
    }
    attempts.push(`fail:bailian-fun-music:${r.error || r.status}`);
  } else {
    attempts.push("skip:bailian-fun-music:unconfigured");
  }

  if (isVolcMusicConfigured()) {
    attempts.push("try:volc-gensong");
    const r = await volcGenerateSongWithBillingFallback({
      lyrics: input.lyrics,
      prompt: input.caption,
      gender,
      durationSec: input.durationSec,
    });
    if (Array.isArray(r.attempts)) attempts.push(...r.attempts);
    if (r.status === "done") {
      return { ...fromVolc(r), attempts };
    }
    attempts.push(`fail:volc-gensong:${r.error || r.status}`);
    return {
      ...fromVolc(r),
      status: "error",
      attempts,
      error: r.error || "Volcengine GenSong failed",
    };
  }

  attempts.push("skip:volc-gensong:unconfigured");
  return {
    ok: false,
    status: "unconfigured",
    error:
      "No music provider configured. Set ALIYUN_DASHSCOPE_API_KEY (Fun-Music) and/or VOLC_ACCESS_KEY_ID + VOLC_SECRET_ACCESS_KEY (GenSong).",
    attempts,
  };
}
