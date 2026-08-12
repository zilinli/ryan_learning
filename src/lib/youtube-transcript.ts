/**
 * Shared YouTube transcript fetcher — used by BBC Documentaries + RSA Shorts.
 * File cache under data/yt-cache/ with 7-day TTL.
 * Falls back to youtubetranscript.com free API, then yt-dlp CLI.
 */

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { execSync } from "node:child_process";

const CACHE_DIR = "data/yt-cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHARS = 12_000;

export type YtSegment = { start: number; text: string };

export type YtTranscript = {
  videoId: string;
  text: string;
  segments: YtSegment[];
  source: "cache" | "api" | "yt-dlp";
};

function vidHash(videoId: string): string {
  return crypto.createHash("sha256").update(videoId).digest("hex");
}

async function cacheDir(): Promise<string> {
  const dir = path.join(process.cwd(), CACHE_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function readCache(videoId: string): Promise<YtTranscript | null> {
  try {
    const file = path.join(await cacheDir(), `${vidHash(videoId)}.json`);
    const raw = await fs.readFile(file, "utf-8");
    const entry = JSON.parse(raw) as { transcript: YtTranscript; ts: number };
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.transcript;
  } catch {
    return null;
  }
}

async function writeCache(transcript: YtTranscript): Promise<void> {
  try {
    const file = path.join(
      await cacheDir(),
      `${vidHash(transcript.videoId)}.json`,
    );
    await fs.writeFile(
      file,
      JSON.stringify({ transcript, ts: Date.now() }),
      "utf-8",
    );
  } catch {
    // non-critical
  }
}

// ---------------------------------------------------------------------------
// Method 1: youtubetranscript.com free API
// ---------------------------------------------------------------------------

async function fetchViaApi(videoId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(
      `https://youtubetranscript.com/?v=${encodeURIComponent(videoId)}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;

    const xml = await res.text();
    if (!xml || xml.length < 100) return null;

    const segments: string[] = [];
    const regex = /<text start="([^"]+)"[^>]*>([^<]*)<\/text>/g;
    let m;
    while ((m = regex.exec(xml))) {
      const text = decodeHtmlEntities(m[2].trim());
      if (text) segments.push(text);
    }

    if (segments.length === 0) return null;
    return segments.join(" ");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Method 2: yt-dlp CLI
// ---------------------------------------------------------------------------

async function fetchViaYtDlp(videoId: string): Promise<string | null> {
  try {
    const outDir = path.join(await cacheDir(), "tmp");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, videoId);
    const cmd = [
      "yt-dlp",
      "--skip-download",
      "--write-auto-subs",
      "--sub-lang en",
      "--sub-format srt",
      `--output "${outFile}"`,
      `"https://www.youtube.com/watch?v=${videoId}"`,
    ].join(" ");

    execSync(cmd, {
      timeout: 30_000,
      encoding: "utf-8",
      stdio: "pipe",
      cwd: process.cwd(),
    });

    const srtPath = `${outFile}.en.srt`;
    const srtContent = await fs.readFile(srtPath, "utf-8");
    await fs.unlink(srtPath).catch(() => {});
    if (!srtContent.trim()) return null;

    const lines = srtContent.split(/\r?\n/);
    const texts: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t || /^\d+$/.test(t) || /-->/.test(t)) continue;
      texts.push(t);
    }
    return texts.join(" ").replace(/[{}]/g, "");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<YtTranscript | null> {
  const id = videoId.trim();
  if (!id) return null;

  const cached = await readCache(id);
  if (cached) return { ...cached, source: "cache" };

  let text = await fetchViaApi(id);
  let source: YtTranscript["source"] = "api";

  if (!text) {
    text = await fetchViaYtDlp(id);
    if (text) source = "yt-dlp";
  }

  if (!text) return null;
  const truncated = text.slice(0, MAX_CHARS);

  const segments: YtSegment[] = truncated
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map((t, i) => ({ start: i * 5, text: t.trim() }));

  const transcript: YtTranscript = {
    videoId: id,
    text: truncated,
    segments,
    source,
  };
  await writeCache(transcript);
  return transcript;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export { youtubeEmbedUrl, extractYouTubeId } from "./youtube-urls";
