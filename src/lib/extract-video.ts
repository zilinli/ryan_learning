/**
 * Short-video extract for tutor/console/FAQ attachments.
 *
 * Cursor SDK only accepts images, so we convert clips into text:
 *   1) ffmpeg → 16 kHz mono WAV → Bailian / local STT
 *   2) ffmpeg → up to 3 JPEG keyframes → Qwen-OCR (when configured)
 *
 * Design: docs/subsystems/short-video-upload-parse.md
 */
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { stripDataUrlPrefix } from "./attachments";
import {
  loadBailianAsrConfig,
  transcribeWithBailian,
} from "./bailian-asr";
import { extractImageOcrText } from "./image-ocr";

const execFileAsync = promisify(execFile);
const MAX_SUMMARY = 12_000;
const MAX_FRAMES = 3;
const STT_URL = process.env.STT_URL || "http://127.0.0.1:8765/transcribe";

export type VideoExtractDeps = {
  extractAudioWav?: (videoPath: string, wavPath: string) => Promise<void>;
  extractFrames?: (
    videoPath: string,
    dir: string,
    durationSec: number,
  ) => Promise<string[]>;
  probeDurationSec?: (videoPath: string) => Promise<number>;
  transcribeWav?: (wavBytes: Uint8Array) => Promise<string>;
  ocrFrame?: (jpegBase64: string) => Promise<string>;
};

function videoExtFromName(name: string): string {
  const m = /\.(mp4|webm|mov|m4v)$/i.exec(name || "");
  return m ? m[1]!.toLowerCase() : "mp4";
}

export async function probeVideoDurationSec(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ],
      { timeout: 15_000 },
    );
    const n = Number.parseFloat(String(stdout).trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function extractAudioWav(
  videoPath: string,
  wavPath: string,
): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "wav",
      wavPath,
    ],
    { timeout: 60_000 },
  );
}

/** Sample up to 3 frames across the clip. */
export function frameTimestampsSec(durationSec: number): number[] {
  const d = Math.max(0, durationSec);
  if (d <= 0.8) return [Math.max(0, d * 0.4)];
  if (d <= 3) return [0.3, Math.max(0.3, d * 0.5), Math.max(0.5, d - 0.25)];
  return [d * 0.1, d * 0.5, Math.max(0.5, d * 0.9)];
}

export async function extractKeyframePaths(
  videoPath: string,
  dir: string,
  durationSec: number,
): Promise<string[]> {
  const stamps = frameTimestampsSec(durationSec).slice(0, MAX_FRAMES);
  const out: string[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const framePath = path.join(dir, `frame-${i}.jpg`);
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-ss",
          String(Math.max(0, stamps[i]!)),
          "-i",
          videoPath,
          "-frames:v",
          "1",
          "-q:v",
          "4",
          framePath,
        ],
        { timeout: 30_000 },
      );
      const st = await fs.stat(framePath).catch(() => null);
      if (st && st.size > 64) out.push(framePath);
    } catch {
      // skip failed frame
    }
  }
  return out;
}

async function transcribeWavDefault(wavBytes: Uint8Array): Promise<string> {
  if (wavBytes.length < 64) return "";

  if (loadBailianAsrConfig()) {
    try {
      const result = await transcribeWithBailian(wavBytes, {
        language: "auto",
        mimeHint: "audio/wav",
        timeoutMs: 45_000,
      });
      const t = (result.text || "").trim();
      if (t) return t;
    } catch {
      // fall through to local
    }
  }

  try {
    const form = new FormData();
    form.append(
      "audio",
      new Blob([wavBytes], { type: "audio/wav" }),
      "video.wav",
    );
    form.append("language", "auto");
    const res = await fetch(STT_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(70_000),
    });
    if (!res.ok) return "";
    const data = (await res.json().catch(() => null)) as {
      text?: string;
    } | null;
    return (data?.text || "").trim();
  } catch {
    return "";
  }
}

/**
 * Extract speech + on-screen text from a short video (base64 payload).
 * Returns "" when nothing useful could be recovered.
 */
export async function extractVideoSummary(
  base64: string,
  name: string,
  deps: VideoExtractDeps = {},
): Promise<string> {
  const raw = stripDataUrlPrefix(base64);
  if (!raw || raw.length < 32) return "";

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "spark-video-"));
  const videoPath = path.join(dir, `clip.${videoExtFromName(name)}`);
  const wavPath = path.join(dir, "audio.wav");

  const probe = deps.probeDurationSec ?? probeVideoDurationSec;
  const toWav = deps.extractAudioWav ?? extractAudioWav;
  const toFrames = deps.extractFrames ?? extractKeyframePaths;
  const asr = deps.transcribeWav ?? transcribeWavDefault;
  const ocr = deps.ocrFrame ?? ((b64: string) => extractImageOcrText(b64, "image/jpeg"));

  try {
    await fs.writeFile(videoPath, Buffer.from(raw, "base64"));

    const durationSec = await probe(videoPath);
    const parts: string[] = [];
    if (durationSec > 0) {
      parts.push(`Duration: ~${durationSec.toFixed(1)}s`);
    }

    // Audio → STT
    try {
      await toWav(videoPath, wavPath);
      const wav = await fs.readFile(wavPath);
      const transcript = await asr(new Uint8Array(wav));
      if (transcript) {
        parts.push(`[Speech transcript]\n${transcript}`);
      }
    } catch {
      // no audio track / ffmpeg failure — continue with frames
    }

    // Keyframes → OCR
    try {
      const frames = await toFrames(videoPath, dir, durationSec || 2);
      const frameTexts: string[] = [];
      for (let i = 0; i < frames.length; i++) {
        const buf = await fs.readFile(frames[i]!);
        const text = (await ocr(buf.toString("base64"))).trim();
        if (text) frameTexts.push(`Frame ${i + 1}: ${text}`);
      }
      if (frameTexts.length) {
        parts.push(`[On-screen text from frames]\n${frameTexts.join("\n")}`);
      }
    } catch {
      // ignore frame failures
    }

    return parts.join("\n\n").trim().slice(0, MAX_SUMMARY);
  } catch {
    return "";
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
