/**
 * deAPI.ai v2 client — text2music / text2img / text2video.
 * Docs: https://docs.deapi.ai · https://deapi.ai/llms.txt
 *
 * Cloudflare blocks bare script UAs (Error 1010); always send a browser-like
 * User-Agent. Jobs are async: POST → poll GET /api/v2/jobs/{request_id}.
 */

export type DeapiInferenceType = "txt2music" | "txt2img" | "txt2video";

export type DeapiModelInfo = {
  name: string;
  slug: string;
  inference_types?: string[];
  status?: string;
  info?: {
    limits?: Record<string, unknown>;
    defaults?: Record<string, unknown>;
    features?: Record<string, unknown>;
  };
};

export type DeapiJobStatus = "pending" | "processing" | "done" | "error";

export type DeapiJobData = {
  status: DeapiJobStatus | string;
  progress?: number;
  result_url?: string | null;
  preview?: string | null;
  result?: unknown;
  error_code?: string | null;
  error_message?: string | null;
  results_alt_formats?: Record<string, string> | null;
};

export type DeapiGenerateResult = {
  ok: boolean;
  status: "done" | "error" | "unconfigured";
  requestId?: string;
  resultUrl?: string;
  mimeType?: string;
  model?: string;
  /** Requested / estimated length when known (music seconds; video = frames/fps) */
  durationSec?: number;
  error?: string;
  raw?: unknown;
};

const DEFAULT_BASE = "https://api.deapi.ai";
const DEFAULT_UA =
  "Mozilla/5.0 (compatible; SparkTutor/1.0; +https://github.com/zilinli/ryan_learning)";

export function deapiApiKey(): string | null {
  return process.env.DEAPI_API_KEY?.trim() || null;
}

export function deapiBaseUrl(): string {
  return (
    process.env.DEAPI_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_BASE
  );
}

export function isDeapiConfigured(): boolean {
  return Boolean(deapiApiKey());
}

function authHeaders(
  extra?: Record<string, string>,
): Record<string, string> | null {
  const key = deapiApiKey();
  if (!key) return null;
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "User-Agent": process.env.DEAPI_USER_AGENT?.trim() || DEFAULT_UA,
    ...extra,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pickNum(
  limits: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const v = limits?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}']+/gu) || []).length;
}

/**
 * Estimate song length from lyrics (not a fixed 30s).
 * Rough sung pace + structure pads; callers still clamp to model min/max.
 */
export function estimateMusicDurationSec(lyrics: string): number {
  const lines = lyrics
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const structureTags = lines.filter((l) => /^\[[^\]]+\]$/i.test(l));
  const lyricLines = lines.filter((l) => !/^\[[^\]]+\]$/i.test(l));
  const words = countWords(lyricLines.join(" "));
  const byLines = lyricLines.length * 2.8;
  const byWords = words * 0.45;
  const sectionBonus = Math.max(0, structureTags.length) * 5;
  const pad = lyricLines.length <= 2 ? 6 : 10;
  const raw = Math.max(byLines, byWords, 12) + sectionBonus + pad;
  // Nearest 5s keeps AceStep happier than odd values
  return Math.max(10, Math.round(raw / 5) * 5);
}

/**
 * Estimate target video length (seconds) from prompt richness.
 * Tuned for deAPI txt2video (~2–10s depending on model frames/fps).
 */
export function estimateVideoDurationSec(prompt: string): number {
  const words = countWords(prompt);
  const beats = prompt
    .split(/[.!?。！？;；|/\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);
  const moves =
    (
      prompt.match(
        /\b(pan|push(?:-in)?|track(?:ing)?|dolly|zoom|cut|then|after|next|follow|镜头|推进|拉远|然后|接着|切换)\b/gi,
      ) || []
    ).length;
  // Short single-beat clips stay brief; multi-beat / camera moves stretch longer.
  const raw =
    2.2 +
    Math.max(0, beats.length - 1) * 1.45 +
    moves * 0.85 +
    Math.min(words / 28, 3.5);
  return Math.round(clamp(raw, 2, 10) * 10) / 10;
}

/** True if the catalog entry is usable for text→video. */
export function isTxt2VideoModel(m: DeapiModelInfo): boolean {
  const types = m.inference_types;
  if (Array.isArray(types) && types.length > 0) {
    return types.includes("txt2video");
  }
  const lim = m.info?.limits;
  return typeof lim?.max_frames === "number" && Number(lim.max_frames) > 0;
}

/** Longest clip a model can produce (frames / min fps). */
export function modelMaxDurationSec(m: DeapiModelInfo): number {
  const lim = (m.info?.limits || {}) as Record<string, unknown>;
  const maxFrames = pickNum(lim, "max_frames", 0);
  if (maxFrames < 1) return 0;
  const minFps = pickNum(lim, "min_fps", 24);
  return Math.round((maxFrames / Math.max(1, minFps)) * 10) / 10;
}

/**
 * Prefer a model that can cover the content-based target length.
 * Short clips → cheaper short-max models; rich prompts → longer-capable LTX-2.
 */
export function pickBestVideoModel(
  models: DeapiModelInfo[],
  wantSec: number,
  preferred?: string,
): DeapiModelInfo | null {
  const vids = models.filter(isTxt2VideoModel).filter((m) => modelMaxDurationSec(m) > 0);
  if (!vids.length) return null;
  if (preferred) {
    const hit = vids.find((m) => m.slug === preferred);
    if (hit) return hit;
  }
  const target = Math.max(2, wantSec);
  const covering = vids.filter((m) => modelMaxDurationSec(m) + 0.05 >= target);
  if (covering.length) {
    covering.sort((a, b) => modelMaxDurationSec(a) - modelMaxDurationSec(b));
    return covering[0] || null;
  }
  vids.sort((a, b) => modelMaxDurationSec(b) - modelMaxDurationSec(a));
  return vids[0] || null;
}

async function readJson(
  res: Response,
): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractError(
  data: Record<string, unknown>,
  status: number,
): string {
  const msg =
    data.message ||
    data.detail ||
    data.error_message ||
    (data.error as { message?: string } | undefined)?.message ||
    (data.data as { error_message?: string } | undefined)?.error_message;
  if (msg) return String(msg);
  // Laravel-style field errors
  const errors = data.errors;
  if (errors && typeof errors === "object") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
      else if (v) parts.push(`${k}: ${String(v)}`);
    }
    if (parts.length) return parts.join("; ");
  }
  return `deAPI HTTP ${status}`;
}

export async function deapiListModels(
  inferenceType: DeapiInferenceType,
): Promise<{ ok: boolean; models: DeapiModelInfo[]; error?: string }> {
  const headers = authHeaders();
  if (!headers) {
    return { ok: false, models: [], error: "DEAPI_API_KEY not set" };
  }
  const models: DeapiModelInfo[] = [];
  let page = 1;
  for (;;) {
    const url = new URL(`${deapiBaseUrl()}/api/v2/models`);
    url.searchParams.set("filter[inference_types]", inferenceType);
    url.searchParams.set("page", String(page));
    try {
      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      const body = await readJson(res);
      if (!res.ok) {
        return { ok: false, models, error: extractError(body, res.status) };
      }
      const data = (body.data as DeapiModelInfo[]) || [];
      // API filter is unreliable — keep only rows that advertise this inference type
      // (or have no types listed, for older payloads).
      models.push(
        ...data.filter((m) => {
          const types = m.inference_types;
          if (!Array.isArray(types) || types.length === 0) return true;
          return types.includes(inferenceType);
        }),
      );
      const meta = body.meta as { current_page?: number; last_page?: number } | undefined;
      const last = meta?.last_page ?? page;
      const cur = meta?.current_page ?? page;
      if (cur >= last) break;
      page += 1;
      if (page > 20) break;
    } catch (e) {
      return {
        ok: false,
        models,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return { ok: true, models };
}

export async function deapiPickModel(
  inferenceType: DeapiInferenceType,
  preferred?: string,
): Promise<DeapiModelInfo | null> {
  const envPref =
    preferred ||
    (inferenceType === "txt2music"
      ? process.env.DEAPI_MUSIC_MODEL?.trim()
      : inferenceType === "txt2img"
        ? process.env.DEAPI_IMAGE_MODEL?.trim()
        : process.env.DEAPI_VIDEO_MODEL?.trim()) ||
    undefined;
  const listed = await deapiListModels(inferenceType);
  if (!listed.ok || listed.models.length === 0) {
    if (envPref) return { name: envPref, slug: envPref };
    return null;
  }
  if (envPref) {
    const hit = listed.models.find((m) => m.slug === envPref);
    if (hit) return hit;
  }
  if (inferenceType === "txt2video") {
    return pickBestVideoModel(listed.models, 4, undefined);
  }
  // Prefer turbo / cheaper for music & image
  const turbo = listed.models.find((m) =>
    /turbo|schnell/i.test(m.slug),
  );
  return turbo || listed.models[0] || null;
}

export async function deapiPollJob(
  requestId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<{ ok: boolean; data?: DeapiJobData; error?: string }> {
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "DEAPI_API_KEY not set" };
  const interval = opts?.intervalMs ?? 2500;
  const timeout = opts?.timeoutMs ?? 300_000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(
        `${deapiBaseUrl()}/api/v2/jobs/${encodeURIComponent(requestId)}`,
        { headers, signal: AbortSignal.timeout(20_000) },
      );
      const body = await readJson(res);
      if (!res.ok) {
        return { ok: false, error: extractError(body, res.status) };
      }
      const data = (body.data || body) as DeapiJobData;
      const st = String(data.status || "");
      if (st === "done") return { ok: true, data };
      if (st === "error") {
        return {
          ok: false,
          data,
          error:
            data.error_message ||
            data.error_code ||
            `Job ${requestId} failed`,
        };
      }
    } catch (e) {
      // transient — keep polling until timeout
      if (Date.now() - start > timeout - interval) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return { ok: false, error: `Job ${requestId} timed out after ${timeout}ms` };
}

async function submitAndWait(
  submit: () => Promise<{
    ok: boolean;
    requestId?: string;
    error?: string;
    raw?: unknown;
  }>,
  mimeType: string,
  model: string,
  pollTimeoutMs?: number,
): Promise<DeapiGenerateResult> {
  const submitted = await submit();
  if (!submitted.ok || !submitted.requestId) {
    return {
      ok: false,
      status: submitted.error?.includes("not set") ? "unconfigured" : "error",
      model,
      error: submitted.error || "Submit failed",
      raw: submitted.raw,
    };
  }
  const polled = await deapiPollJob(submitted.requestId, {
    timeoutMs: pollTimeoutMs,
  });
  if (!polled.ok || !polled.data?.result_url) {
    return {
      ok: false,
      status: "error",
      requestId: submitted.requestId,
      model,
      error: polled.error || "No result_url",
      raw: polled.data,
    };
  }
  return {
    ok: true,
    status: "done",
    requestId: submitted.requestId,
    resultUrl: polled.data.result_url,
    mimeType,
    model,
    raw: polled.data,
  };
}

export type DeapiMusicInput = {
  lyrics: string;
  caption: string;
  durationSec?: number;
  model?: string;
  seed?: number;
  bpm?: number;
  vocalLanguage?: string;
};

export async function deapiGenerateMusic(
  input: DeapiMusicInput,
): Promise<DeapiGenerateResult> {
  const headers = authHeaders();
  if (!headers) {
    return {
      ok: false,
      status: "unconfigured",
      error: "DEAPI_API_KEY not set",
    };
  }
  const modelInfo = await deapiPickModel("txt2music", input.model);
  if (!modelInfo) {
    return {
      ok: false,
      status: "error",
      error: "No txt2music model available",
    };
  }
  const limits = (modelInfo.info?.limits || {}) as Record<string, unknown>;
  const minDur = pickNum(limits, "min_duration", 10);
  const maxDur = pickNum(limits, "max_duration", 300);
  const minSteps = pickNum(limits, "min_steps", 8);
  const maxSteps = pickNum(limits, "max_steps", 8);
  const minGuide = pickNum(limits, "min_guidance", 1);
  const maxGuide = pickNum(limits, "max_guidance", 1);
  const maxCaption = pickNum(limits, "max_caption", 300);
  const formats = Array.isArray(limits.output_formats)
    ? (limits.output_formats as string[])
    : ["mp3"];
  const format = formats.includes("mp3") ? "mp3" : formats[0] || "mp3";

  const caption = input.caption.trim().slice(0, maxCaption) || "pop ballad";
  const lyrics =
    input.lyrics.trim().slice(0, 8000) || "[Instrumental]";
  const estimated =
    typeof input.durationSec === "number" && Number.isFinite(input.durationSec)
      ? input.durationSec
      : estimateMusicDurationSec(lyrics);
  const duration = clamp(Math.round(estimated), minDur, maxDur);
  const steps = clamp(minSteps, minSteps, maxSteps);
  const guidance = clamp(minGuide, minGuide, maxGuide);

  const result = await submitAndWait(
    async () => {
      const form = new FormData();
      form.set("caption", caption);
      form.set("model", modelInfo.slug);
      form.set("lyrics", lyrics);
      form.set("duration", String(duration));
      form.set("inference_steps", String(steps));
      form.set("guidance_scale", String(guidance));
      form.set("seed", String(input.seed ?? -1));
      form.set("format", format);
      if (input.bpm != null) form.set("bpm", String(input.bpm));
      if (input.vocalLanguage) {
        form.set("vocal_language", input.vocalLanguage);
      }
      try {
        const res = await fetch(`${deapiBaseUrl()}/api/v2/audio/music`, {
          method: "POST",
          headers, // no Content-Type — FormData sets boundary
          body: form,
          signal: AbortSignal.timeout(60_000),
        });
        const body = await readJson(res);
        if (!res.ok) {
          return { ok: false, error: extractError(body, res.status), raw: body };
        }
        const data = body.data as { request_id?: string } | undefined;
        const requestId = data?.request_id || (body.request_id as string | undefined);
        if (!requestId) {
          return { ok: false, error: "No request_id in response", raw: body };
        }
        return { ok: true, requestId, raw: body };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    format === "wav" ? "audio/wav" : "audio/mpeg",
    modelInfo.slug,
    360_000,
  );
  return { ...result, durationSec: duration };
}

export type DeapiImageInput = {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  model?: string;
};

export async function deapiGenerateImage(
  input: DeapiImageInput,
): Promise<DeapiGenerateResult> {
  const headers = authHeaders({ "Content-Type": "application/json" });
  if (!headers) {
    return {
      ok: false,
      status: "unconfigured",
      error: "DEAPI_API_KEY not set",
    };
  }
  const modelInfo = await deapiPickModel("txt2img", input.model);
  if (!modelInfo) {
    return {
      ok: false,
      status: "error",
      error: "No txt2img model available",
    };
  }
  const limits = (modelInfo.info?.limits || {}) as Record<string, unknown>;
  const defaults = (modelInfo.info?.defaults || {}) as Record<string, unknown>;
  const features = (modelInfo.info?.features || {}) as Record<string, unknown>;
  const minW = pickNum(limits, "min_width", 256);
  const maxW = pickNum(limits, "max_width", 2048);
  const minH = pickNum(limits, "min_height", 256);
  const maxH = pickNum(limits, "max_height", 2048);
  const minSteps = pickNum(limits, "min_steps", 1);
  const maxSteps = pickNum(limits, "max_steps", 10);
  const defW =
    typeof defaults.width === "number" ? defaults.width : 768;
  const defH =
    typeof defaults.height === "number" ? defaults.height : 768;
  const defSteps =
    typeof defaults.steps === "number" ? defaults.steps : minSteps;

  const width = clamp(Math.round(input.width ?? defW), minW, maxW);
  const height = clamp(Math.round(input.height ?? defH), minH, maxH);
  const steps = clamp(
    Math.round(input.steps ?? defSteps),
    minSteps,
    maxSteps,
  );
  const prompt = input.prompt.trim().slice(0, 4000);
  if (prompt.length < 3) {
    return { ok: false, status: "error", error: "Prompt too short" };
  }

  const payload: Record<string, unknown> = {
    prompt,
    model: modelInfo.slug,
    width,
    height,
    steps,
    seed: input.seed ?? -1,
  };
  // Schema often requires guidance even when features.supports_guidance is false
  payload.guidance =
    input.guidance ??
    (typeof defaults.guidance === "number" ? defaults.guidance : 3.5);
  if (
    input.negativePrompt &&
    features.supports_negative_prompt !== false
  ) {
    payload.negative_prompt = input.negativePrompt.slice(0, 1000);
  }

  return submitAndWait(
    async () => {
      try {
        const res = await fetch(
          `${deapiBaseUrl()}/api/v2/images/generations`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(60_000),
          },
        );
        const body = await readJson(res);
        if (!res.ok) {
          return { ok: false, error: extractError(body, res.status), raw: body };
        }
        const data = body.data as { request_id?: string } | undefined;
        const requestId =
          data?.request_id || (body.request_id as string | undefined);
        if (!requestId) {
          return { ok: false, error: "No request_id in response", raw: body };
        }
        return { ok: true, requestId, raw: body };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    "image/png",
    modelInfo.slug,
    300_000,
  );
}

export type DeapiVideoInput = {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  /** Preferred length in seconds — converted to frames via fps and clamped */
  durationSec?: number;
  frames?: number;
  fps?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  model?: string;
};

export async function deapiGenerateVideo(
  input: DeapiVideoInput,
): Promise<DeapiGenerateResult> {
  const headers = authHeaders({ "Content-Type": "application/json" });
  if (!headers) {
    return {
      ok: false,
      status: "unconfigured",
      error: "DEAPI_API_KEY not set",
    };
  }
  const prompt = input.prompt.trim().slice(0, 4000);
  if (prompt.length < 3) {
    return { ok: false, status: "error", error: "Prompt too short" };
  }

  const wantSec =
    typeof input.durationSec === "number" && Number.isFinite(input.durationSec)
      ? input.durationSec
      : estimateVideoDurationSec(prompt);

  // Content-first model pick: short prompts stay on ~4s LTX; multi-beat → LTX-2 (~10s).
  let modelInfo: DeapiModelInfo | null = null;
  if (input.model?.trim()) {
    modelInfo = await deapiPickModel("txt2video", input.model);
  } else {
    const listed = await deapiListModels("txt2video");
    modelInfo = pickBestVideoModel(
      listed.models,
      wantSec,
      process.env.DEAPI_VIDEO_MODEL?.trim(),
    );
  }
  if (!modelInfo) {
    return {
      ok: false,
      status: "error",
      error: "No txt2video model available",
    };
  }
  const limits = (modelInfo.info?.limits || {}) as Record<string, unknown>;
  const defaults = (modelInfo.info?.defaults || {}) as Record<string, unknown>;
  const features = (modelInfo.info?.features || {}) as Record<string, unknown>;
  const minW = pickNum(limits, "min_width", 256);
  const maxW = pickNum(limits, "max_width", 768);
  const minH = pickNum(limits, "min_height", 256);
  const maxH = pickNum(limits, "max_height", 768);
  const minFrames = pickNum(limits, "min_frames", 30);
  const maxFrames = pickNum(limits, "max_frames", 120);
  const minFps = pickNum(limits, "min_fps", 24);
  const maxFps = pickNum(limits, "max_fps", 30);
  const minSteps = pickNum(limits, "min_steps", 1);
  const maxSteps = pickNum(limits, "max_steps", 8);

  const defW = typeof defaults.width === "number" ? defaults.width : 512;
  const defH = typeof defaults.height === "number" ? defaults.height : 512;
  const defFps = typeof defaults.fps === "number" ? defaults.fps : minFps;
  const defSteps =
    typeof defaults.steps === "number" ? defaults.steps : minSteps;

  // Prefer lowest allowed fps when stretching toward wantSec (more seconds per frame budget).
  const fps = clamp(
    Math.round(input.fps ?? (wantSec > 4 ? minFps : defFps)),
    minFps,
    maxFps,
  );
  let frames: number;
  if (typeof input.frames === "number" && Number.isFinite(input.frames)) {
    frames = clamp(Math.round(input.frames), minFrames, maxFrames);
  } else {
    // Content-based length — never force the model default (often fixed 120 ≈ 4s).
    frames = clamp(Math.round(wantSec * fps), minFrames, maxFrames);
  }
  const durationSec = Math.round((frames / fps) * 10) / 10;

  const payload: Record<string, unknown> = {
    prompt,
    model: modelInfo.slug,
    width: clamp(Math.round(input.width ?? defW), minW, maxW),
    height: clamp(Math.round(input.height ?? defH), minH, maxH),
    frames,
    fps,
    seed: input.seed ?? -1,
  };
  // Ltx2 reports supports_steps false but still requires steps ≥ 8 — send when limits exist
  if (limits.min_steps != null || limits.max_steps != null) {
    payload.steps = clamp(
      Math.round(input.steps ?? defSteps),
      minSteps,
      Math.max(minSteps, maxSteps),
    );
  }
  payload.guidance =
    input.guidance ??
    (typeof defaults.guidance === "number" ? defaults.guidance : 3.5);
  if (
    input.negativePrompt &&
    features.supports_negative_prompt !== false
  ) {
    payload.negative_prompt = input.negativePrompt.slice(0, 1000);
  }

  const result = await submitAndWait(
    async () => {
      try {
        const res = await fetch(
          `${deapiBaseUrl()}/api/v2/videos/generations`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(60_000),
          },
        );
        const body = await readJson(res);
        if (!res.ok) {
          return { ok: false, error: extractError(body, res.status), raw: body };
        }
        const data = body.data as { request_id?: string } | undefined;
        const requestId =
          data?.request_id || (body.request_id as string | undefined);
        if (!requestId) {
          return { ok: false, error: "No request_id in response", raw: body };
        }
        return { ok: true, requestId, raw: body };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    "video/mp4",
    modelInfo.slug,
    600_000,
  );
  return { ...result, durationSec };
}
