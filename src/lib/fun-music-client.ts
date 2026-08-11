/**
 * Alibaba Bailian Fun-Music client (fun-music-v1).
 * Docs: https://help.aliyun.com/zh/model-studio/fun-music-api
 *
 * Reuses ALIYUN_DASHSCOPE_API_KEY (+ optional ALIYUN_WORKSPACE_ID).
 * Model is invite-only (北京); apply in 模型广场 → fun-music-v1.
 */

export type FunMusicGender = "male" | "female";

export type FunMusicGenerateInput = {
  /** Style / mood caption — used only when lyrics omitted (API ignores prompt if lyrics set). */
  prompt?: string;
  /** Structured lyrics ([Verse]/[Chorus]). Preferred for Writing Studio. */
  lyrics?: string;
  gender?: FunMusicGender;
  isInstrumental?: boolean;
  format?: "mp3" | "wav";
  model?: "fun-music-v1" | "fun-music-preview";
};

export type FunMusicGenerateResult = {
  ok: boolean;
  status: "done" | "error" | "unconfigured";
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
  requestId?: string;
  generatedLyrics?: string;
  durationSec?: number;
  error?: string;
  raw?: unknown;
};

function apiKey(): string | null {
  return process.env.ALIYUN_DASHSCOPE_API_KEY?.trim() || null;
}

/** Prefer workspace-scoped MaaS host (北京); fall back to classic dashscope. */
export function funMusicEndpoint(): string {
  const override = process.env.FUN_MUSIC_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID?.trim();
  if (workspaceId) {
    return `https://${workspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/music/generation`;
  }
  return "https://dashscope.aliyuncs.com/api/v1/services/audio/music/generation";
}

export function isFunMusicConfigured(): boolean {
  return Boolean(apiKey());
}

/** API limits: CN lyrics ≤350 chars; EN ≤2000 (non-stream). */
export function clampFunMusicLyrics(lyrics: string): string {
  const t = lyrics.trim();
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const max = cjk / Math.max(t.length, 1) > 0.3 ? 350 : 2000;
  if (t.length <= max) return t;
  return t.slice(0, max);
}

export function clampFunMusicPrompt(prompt: string): string {
  return prompt.trim().slice(0, 2000);
}

function extractError(data: Record<string, unknown>, status: number): string {
  const msg =
    data.message ||
    data.Message ||
    (data.error as { message?: string } | undefined)?.message ||
    data.code ||
    data.Code;
  if (msg) return String(msg);
  return `Fun-Music HTTP ${status}`;
}

/**
 * Non-streaming generation. When both prompt and lyrics are sent, Bailian
 * keeps lyrics only — so we send lyrics when present.
 */
export async function funMusicGenerate(
  input: FunMusicGenerateInput,
): Promise<FunMusicGenerateResult> {
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      status: "unconfigured",
      error:
        "ALIYUN_DASHSCOPE_API_KEY is not set. Reuse the same Bailian key as TTS/STT. Also apply for fun-music-v1 invite in 模型广场.",
    };
  }

  const lyrics = input.lyrics ? clampFunMusicLyrics(input.lyrics) : "";
  const prompt = input.prompt ? clampFunMusicPrompt(input.prompt) : "";
  if (!lyrics && !prompt) {
    return {
      ok: false,
      status: "error",
      error: "Provide lyrics or prompt",
    };
  }

  const model = input.model || process.env.FUN_MUSIC_MODEL?.trim() || "fun-music-v1";
  const bodyInput: Record<string, unknown> = {
    format: input.format || "mp3",
    is_instrumental: Boolean(input.isInstrumental),
  };
  // Prefer lyrics for Writing Studio; API drops prompt when lyrics present.
  if (lyrics) {
    bodyInput.lyrics = lyrics;
  } else {
    bodyInput.prompt = prompt;
  }
  if (!bodyInput.is_instrumental) {
    bodyInput.gender = input.gender === "male" ? "male" : "female";
  }

  const url = funMusicEndpoint();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        input: bodyInput,
      }),
      signal: AbortSignal.timeout(240_000),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        error: extractError(data, res.status),
        raw: data,
      };
    }

    const output = (data.output || {}) as Record<string, unknown>;
    const audio = (output.audio || {}) as Record<string, unknown>;
    const extra = (output.extra_info || {}) as Record<string, unknown>;
    const usage = (data.usage || {}) as Record<string, unknown>;
    const audioUrl = audio.url ? String(audio.url) : undefined;
    const b64 = typeof audio.data === "string" && audio.data ? audio.data : undefined;

    if (!audioUrl && !b64) {
      return {
        ok: false,
        status: "error",
        error:
          "Fun-Music returned no audio URL (check fun-music-v1 invite approval)",
        requestId: data.request_id ? String(data.request_id) : undefined,
        raw: data,
      };
    }

    return {
      ok: true,
      status: "done",
      audioUrl,
      audioBase64: b64,
      mimeType: input.format === "wav" ? "audio/wav" : "audio/mpeg",
      requestId: data.request_id ? String(data.request_id) : undefined,
      generatedLyrics: extra.lyrics ? String(extra.lyrics) : undefined,
      durationSec:
        typeof usage.duration === "number" ? usage.duration : undefined,
      raw: data,
    };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      error: err instanceof Error ? err.message : "Fun-Music request failed",
    };
  }
}
