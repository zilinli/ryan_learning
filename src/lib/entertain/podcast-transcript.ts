/**
 * Podcast transcript jobs — audio → text via DashScope filetrans (primary) or
 * the local spark-stt whisper box (fallback). Text is disk-cached so a repeat
 * visit to the same episode is instant.
 *
 * DashScope long-audio flow (async task):
 *   POST /api/v1/services/audio/asr/transcription   (X-DashScope-Async: enable)
 *   → { output: { task_id } }
 *   GET  /api/v1/tasks/{task_id}  →  { output: { task_status: SUCCEEDED,
 *        results: [{ transcripts: [{ url }] }] } }
 *   download url → { transcripts: [{ text, sentences: [{ text }] }] }
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadBailianAsrConfig } from "../bailian-asr";
import type { PodcastShow } from "./podcast-catalog";
import type { PodcastEpisode } from "./podcast-rss";

export type TranscriptStatus = "queued" | "running" | "done" | "error";

export type PodcastTranscriptJob = {
  id: string;
  showId: string;
  episodeGuid: string;
  status: TranscriptStatus;
  /** 0–1 coarse progress for the UI. */
  progress: number;
  transcript?: string;
  error?: string;
  engine: "bailian" | "local" | "cache";
  createdAt: number;
  updatedAt: number;
};

let CACHE_DIR = path.join(process.cwd(), "data", "podcast-cache", "transcripts");
let JOBS_DIR = path.join(process.cwd(), "data", "podcast-cache", "jobs");
let AUDIO_DIR = path.join(process.cwd(), "data", "podcast-audio");
const CACHE_TTL_MS = 7 * 86_400_000;
export const PODCAST_TRANSCRIPT_MAX_CHARS = 12_000;

/** Override cache dirs (tests use a temp dir). */
export function setPodcastCacheDirsForTests(root: string): void {
  (CACHE_DIR as string) = path.join(root, "transcripts");
  (JOBS_DIR as string) = path.join(root, "jobs");
  (AUDIO_DIR as string) = path.join(root, "audio");
}

function episodeKey(showId: string, episodeGuid: string): string {
  const h = createHash("sha256")
    .update(`${showId}:${episodeGuid}`)
    .digest("hex")
    .slice(0, 16);
  return `${showId}_${h}`;
}

function transcriptCachePath(showId: string, episodeGuid: string): string {
  return path.join(CACHE_DIR, `${episodeKey(showId, episodeGuid)}.txt`);
}

export async function readTranscriptCache(
  showId: string,
  episodeGuid: string,
): Promise<string | null> {
  try {
    const p = transcriptCachePath(showId, episodeGuid);
    const st = await fs.stat(p);
    if (Date.now() - st.mtimeMs > CACHE_TTL_MS) return null;
    const text = await fs.readFile(p, "utf8");
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

async function writeTranscriptCache(
  showId: string,
  episodeGuid: string,
  text: string,
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    transcriptCachePath(showId, episodeGuid),
    text.slice(0, PODCAST_TRANSCRIPT_MAX_CHARS),
    "utf8",
  );
}

function jobPath(jobId: string): string {
  const safe = jobId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return path.join(JOBS_DIR, `${safe}.json`);
}

async function persistJob(job: PodcastTranscriptJob): Promise<void> {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.writeFile(jobPath(job.id), JSON.stringify(job), "utf8");
}

async function loadJob(jobId: string): Promise<PodcastTranscriptJob | null> {
  try {
    const raw = await fs.readFile(jobPath(jobId), "utf8");
    const j = JSON.parse(raw) as PodcastTranscriptJob;
    if (j && typeof j.id === "string" && j.status) return j;
  } catch {
    /* no job */
  }
  return null;
}

/** In-memory running promises so GET can await an in-flight job. */
const running = new Map<string, Promise<PodcastTranscriptJob>>();
/** Live job objects (mutated in place by the worker) keyed by job id. */
const jobsById = new Map<string, PodcastTranscriptJob>();

function newJobId(): string {
  return `pod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── DashScope filetrans (primary) ────────────────────────────────────────

/** Standard DashScope base; allow an explicit override for dedicated/intl hosts. */
function dashscopeBase(): string {
  const override = process.env.ALIYUN_DASHSCOPE_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  const intl = process.env.ALIYUN_DASHSCOPE_REGION?.trim() === "intl";
  return intl
    ? "https://dashscope-intl.aliyuncs.com"
    : "https://dashscope.aliyuncs.com";
}

function filetransUrl(): string {
  return `${dashscopeBase()}/api/v1/services/audio/asr/transcription`;
}

function tasksUrl(taskId: string): string {
  return `${dashscopeBase()}/api/v1/tasks/${taskId}`;
}

/**
 * Pull the transcript download URL out of a SUCCEEDED task response.
 * Real paraformer-v2 responses expose `results[0].transcription_url` (or
 * nested under `output`); some SDK shapes use `transcripts[0].url` instead.
 */
export function extractTaskResultUrl(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = data as { output?: { results?: unknown[] } };
  const first = (root.output?.results?.[0] || null) as
    | (Record<string, unknown> & {
        transcription_url?: string;
        output?: { transcription_url?: string };
        transcripts?: Array<{ url?: string }>;
        url?: string;
      })
    | null;
  if (!first) return "";
  return (
    first.transcription_url ||
    first.output?.transcription_url ||
    first.transcripts?.[0]?.url ||
    first.url ||
    ""
  );
}

/** Extract full transcript text from a DashScope transcription result JSON. */
export function extractFiletransText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = data as Record<string, unknown>;
  const transcripts = Array.isArray(root.transcripts)
    ? (root.transcripts as Array<Record<string, unknown>>)
    : Array.isArray((root.output as Record<string, unknown>)?.transcripts)
      ? ((root.output as Record<string, unknown>).transcripts as Array<
          Record<string, unknown>
        >)
      : [];
  const parts: string[] = [];
  for (const t of transcripts) {
    if (typeof t.text === "string" && t.text.trim()) {
      parts.push(t.text.trim());
      continue;
    }
    if (Array.isArray(t.sentences)) {
      for (const s of t.sentences as Array<Record<string, unknown>>) {
        if (typeof s.text === "string" && s.text.trim()) parts.push(s.text.trim());
      }
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Submit a DashScope filetrans task and poll to completion.
 * onProgress lets the job reflect coarse stages in the UI.
 */
export async function transcribeWithBailianFiletrans(
  audioUrl: string,
  opts: {
    languageHint?: string;
    onProgress?: (p: number) => void;
    /** Override the poll budget. Default scales with the audio duration. */
    maxAttempts?: number;
  } = {},
): Promise<string> {
  const cfg = loadBailianAsrConfig();
  const apiKey = cfg?.apiKey;
  if (!apiKey) throw new Error("ALIYUN_DASHSCOPE_API_KEY not configured");

  const submitRes = await fetch(filetransUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: process.env.ALIYUN_PODCAST_ASR_MODEL?.trim() || "paraformer-v2",
      input: { file_urls: [audioUrl] },
      parameters: {
        channel_id: [0],
        ...(opts.languageHint
          ? { language_hints: [opts.languageHint] }
          : { language_hints: ["en"] }),
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!submitRes.ok) {
    throw new Error(`DashScope submit HTTP ${submitRes.status}`);
  }
  const submitData = (await submitRes.json()) as {
    output?: { task_id?: string; task_status?: string };
  };
  const taskId = submitData.output?.task_id;
  if (!taskId) throw new Error("DashScope returned no task_id");

  opts.onProgress?.(0.15);
  const pollMs = Number(process.env.ALIYUN_ASR_POLL_MS || "5000");
  // Paraformer processes long audio slower than realtime; budget polls by the
  // audio duration so hour-long episodes don't time out (env can override).
  const maxAttempts = opts.maxAttempts || Number(process.env.ALIYUN_ASR_MAX_ATTEMPTS || "0") || 120;
  let resultUrl = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollMs));
    const res = await fetch(tasksUrl(taskId), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      output?: {
        task_status?: string;
        results?: Array<{
          transcripts?: Array<{ url?: string }>;
          url?: string;
        }>;
      };
    };
    const status = data.output?.task_status || "";
    if (status === "SUCCEEDED") {
      resultUrl = extractTaskResultUrl(data);
      break;
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`DashScope task ${status}`);
    }
    opts.onProgress?.(0.15 + 0.6 * ((attempt + 1) / maxAttempts));
  }
  if (!resultUrl) throw new Error("DashScope task timed out");

  opts.onProgress?.(0.85);
  const dlRes = await fetch(resultUrl, { signal: AbortSignal.timeout(30_000) });
  if (!dlRes.ok) throw new Error(`DashScope result download HTTP ${dlRes.status}`);
  const text = extractFiletransText(await dlRes.json());
  if (!text.trim()) throw new Error("DashScope returned empty transcript");
  return text.slice(0, PODCAST_TRANSCRIPT_MAX_CHARS);
}

// ── Local whisper box (fallback) ─────────────────────────────────────────

function localSttUrl(): string {
  return process.env.STT_URL?.trim() || "http://127.0.0.1:8765/transcribe";
}

async function downloadAudio(audioUrl: string): Promise<string> {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const ext = /\.(mp3|m4a|mp4|ogg|wav|aac)(\?|$)/i.exec(audioUrl)?.[1]?.toLowerCase() || "mp3";
  const dest = path.join(AUDIO_DIR, `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`);
  const res = await fetch(audioUrl, {
    headers: { "User-Agent": "SparkTutor/1.0 (family education)" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Audio download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error("Audio download too small");
  await fs.writeFile(dest, buf);
  return dest;
}

/** Transcribe a downloaded audio file via the local spark-stt box. */
export async function transcribeWithLocalStt(
  audioUrl: string,
  onProgress?: (p: number) => void,
): Promise<string> {
  const localFile = await downloadAudio(audioUrl);
  onProgress?.(0.25);
  try {
    const buf = await fs.readFile(localFile);
    const form = new FormData();
    form.append("audio", new Blob([buf]), path.basename(localFile));
    form.append("language", "en");
    const res = await fetch(localSttUrl(), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30 * 60_000), // long episodes on CPU whisper
    });
    if (!res.ok) throw new Error(`Local STT HTTP ${res.status}`);
    const data = (await res.json()) as { text?: string; error?: string };
    const text = String(data.text || "").trim();
    if (!text) throw new Error(data.error || "Local STT returned no text");
    onProgress?.(1);
    return text.slice(0, PODCAST_TRANSCRIPT_MAX_CHARS);
  } finally {
    try {
      await fs.unlink(localFile);
    } catch {
      /* ignore */
    }
  }
}

// ── Job orchestration ────────────────────────────────────────────────────

/** Engine registry — property access so tests can spy on individual engines. */
export const podcastEngines = {
  bailian: transcribeWithBailianFiletrans,
  local: transcribeWithLocalStt,
};

/** Poll budget for the DashScope task, scaled to the episode length. */
export function bailianPollAttempts(durationSec: number): number {
  const minutes = Math.max(10, Math.ceil((durationSec / 60) * 1.5) + 6);
  const attempts = Math.min(1800, Math.ceil(minutes * 12)); // one poll per 5s
  return Math.max(72, attempts);
}

async function runTranscriptWork(
  show: PodcastShow,
  episode: PodcastEpisode,
  job: PodcastTranscriptJob,
): Promise<PodcastTranscriptJob> {
  const update = async (patch: Partial<PodcastTranscriptJob>) => {
    Object.assign(job, patch, { updatedAt: Date.now() });
    await persistJob(job).catch(() => undefined);
  };

  try {
    await update({ status: "running", progress: 0.1 });
    let text = "";
    let engine: PodcastTranscriptJob["engine"] = "bailian";
    try {
      text = await podcastEngines.bailian(episode.audioUrl, {
        languageHint: "en",
        maxAttempts: bailianPollAttempts(episode.durationSec),
        onProgress: (p) => void update({ progress: Math.max(job.progress, p) }),
      });
    } catch (bailianErr) {
      console.warn(
        `[podcast-transcript] bailian failed for ${episode.title}:`,
        bailianErr instanceof Error ? bailianErr.message : bailianErr,
      );
      text = await podcastEngines.local(episode.audioUrl, (p) =>
        void update({ progress: Math.max(job.progress, p) }),
      );
      engine = "local";
    }
    if (!text.trim()) throw new Error("Empty transcript from all engines");
    const capped = text.slice(0, PODCAST_TRANSCRIPT_MAX_CHARS);
    await writeTranscriptCache(show.id, episode.guid, capped);
    await update({ status: "done", progress: 1, transcript: capped, engine });
  } catch (err) {
    await update({
      status: "error",
      error: err instanceof Error ? err.message : "Transcription failed",
    });
  }
  return job;
}

/**
 * Start a transcript job (or return a cached/done result instantly).
 * Client polls `getPodcastTranscriptJob` every ~5s.
 */
export async function requestPodcastTranscript(
  show: PodcastShow,
  episode: PodcastEpisode,
): Promise<PodcastTranscriptJob> {
  const cached = await readTranscriptCache(show.id, episode.guid);
  if (cached) {
    const job: PodcastTranscriptJob = {
      id: newJobId(),
      showId: show.id,
      episodeGuid: episode.guid,
      status: "done",
      progress: 1,
      transcript: cached,
      engine: "cache",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return job;
  }

  const existing = running.get(episodeKey(show.id, episode.guid));
  if (existing) return existing;

  const job: PodcastTranscriptJob = {
    id: newJobId(),
    showId: show.id,
    episodeGuid: episode.guid,
    status: "queued",
    progress: 0,
    engine: "bailian",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobsById.set(job.id, job);
  await persistJob(job);
  const promise = runTranscriptWork(show, episode, job).finally(() => {
    running.delete(episodeKey(show.id, episode.guid));
  });
  running.set(episodeKey(show.id, episode.guid), promise);
  return job;
}

/** Read a job's latest state. Live jobs are returned from memory (in place). */
export async function getPodcastTranscriptJob(
  jobId: string,
): Promise<PodcastTranscriptJob | null> {
  const safe = String(jobId || "").trim();
  if (!safe) return null;
  const live = jobsById.get(safe);
  if (live) return live;
  return loadJob(safe);
}
