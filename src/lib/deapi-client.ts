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
      models.push(...data);
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
  const duration = clamp(
    Math.round(input.durationSec ?? Math.max(minDur, 30)),
    minDur,
    maxDur,
  );
  const steps = clamp(minSteps, minSteps, maxSteps);
  const guidance = clamp(minGuide, minGuide, maxGuide);

  return submitAndWait(
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
  const modelInfo = await deapiPickModel("txt2video", input.model);
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
  const defFrames =
    typeof defaults.frames === "number" ? defaults.frames : minFrames;
  const defFps = typeof defaults.fps === "number" ? defaults.fps : minFps;
  const defSteps =
    typeof defaults.steps === "number" ? defaults.steps : minSteps;

  const prompt = input.prompt.trim().slice(0, 4000);
  if (prompt.length < 3) {
    return { ok: false, status: "error", error: "Prompt too short" };
  }

  const payload: Record<string, unknown> = {
    prompt,
    model: modelInfo.slug,
    width: clamp(Math.round(input.width ?? defW), minW, maxW),
    height: clamp(Math.round(input.height ?? defH), minH, maxH),
    frames: clamp(Math.round(input.frames ?? defFrames), minFrames, maxFrames),
    fps: clamp(Math.round(input.fps ?? defFps), minFps, maxFps),
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

  return submitAndWait(
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
}
