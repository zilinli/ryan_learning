/**
 * Shared YouTube caption fetcher — BBC Doc Lab + RSA Shorts (+ NatGeo videos).
 *
 * Order:
 *  1. Cache
 *  2. youtube-transcript (manual EN + auto-CC / ASR, with lang fallbacks)
 *  3. yt-dlp auto+manual VTT (node JS runtime when available)
 *  4. Legacy XML mirror (usually dead)
 *
 * Cache under data/yt-cache/ with 7-day TTL.
 */

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { YoutubeTranscript } from "youtube-transcript";

const execFileAsync = promisify(execFile);

const CACHE_DIR = "data/yt-cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHARS = 12_000;

/** Preferred English caption locales — auto-CC often lands on en-US, not bare `en`. */
const EN_LANG_CANDIDATES = ["en", "en-US", "en-GB", "en-orig", "a.en"] as const;

export type YtSegment = { start: number; text: string };

export type YtTranscript = {
  videoId: string;
  text: string;
  segments: YtSegment[];
  source: "cache" | "auto-cc" | "yt-dlp" | "api";
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
    if (!entry.transcript?.text || entry.transcript.text.length < 80) return null;
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

/** Strip WebVTT to plain narration text (deduped auto-caption lines). */
export function parseVttToText(vtt: string): string {
  const lines = (vtt || "").split(/\r?\n/);
  const chunks: string[] = [];
  for (const line of lines) {
    let t = line.trim();
    if (!t) continue;
    if (
      t === "WEBVTT" ||
      /^NOTE\b/i.test(t) ||
      /^Kind:/i.test(t) ||
      /^Language:/i.test(t) ||
      /^STYLE\b/i.test(t) ||
      /^REGION\b/i.test(t)
    ) {
      continue;
    }
    if (/^\d+$/.test(t)) continue;
    if (/-->/.test(t)) continue;
    t = t
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
      .replace(/<\/?c[^>]*>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!t || t.length < 2) continue;
    const prev = chunks[chunks.length - 1];
    if (prev) {
      if (prev === t) continue;
      if (t.startsWith(prev) && t.length > prev.length) {
        chunks[chunks.length - 1] = t;
        continue;
      }
      if (prev.startsWith(t)) continue;
    }
    chunks.push(t);
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export function parseSrtToText(srt: string): string {
  const lines = (srt || "").split(/\r?\n/);
  const texts: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || /^\d+$/.test(t) || /-->/.test(t)) continue;
    const cleaned = t.replace(/[{}]/g, "").replace(/\[[^\]]*\]/g, "").trim();
    if (cleaned) texts.push(cleaned);
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

/** Parse "Available languages: en, en-US, fr" from youtube-transcript errors. */
export function parseAvailableCaptionLangs(message: string): string[] {
  const m = /Available languages:\s*([^\n.]+)/i.exec(message || "");
  if (!m?.[1]) return [];
  return m[1]
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function preferEnglishLangs(available: string[]): string[] {
  const lower = available.map((l) => l.trim()).filter(Boolean);
  const score = (lang: string) => {
    const l = lang.toLowerCase();
    if (l === "en") return 100;
    if (l === "en-us" || l === "en-gb" || l === "en-orig") return 90;
    if (l.startsWith("en-") || l.startsWith("a.en")) return 80;
    if (l.includes("en")) return 40;
    return 0;
  };
  return [...lower].sort((a, b) => score(b) - score(a)).filter((l) => score(l) > 0);
}

function cuesToPlainText(
  cues: Array<{ text?: string; offset?: number }>,
): string {
  const parts: string[] = [];
  for (const c of cues) {
    const t = String(c.text || "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) continue;
    const prev = parts[parts.length - 1];
    if (prev === t) continue;
    parts.push(t);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Fetch English captions preferring auto-CC when manual EN is missing.
 * Tries common EN locales, then any EN-* reported as available.
 */
export async function fetchViaAutoCc(videoId: string): Promise<string | null> {
  const tried = new Set<string>();
  const queue: string[] = [...EN_LANG_CANDIDATES];

  while (queue.length > 0) {
    const lang = queue.shift()!;
    const key = lang.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);
    try {
      const cues = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      const text = cuesToPlainText(cues);
      if (text.length >= 80) return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/disabled on this video/i.test(msg)) return null;
      for (const avail of preferEnglishLangs(parseAvailableCaptionLangs(msg))) {
        if (!tried.has(avail.toLowerCase())) queue.push(avail);
      }
    }
  }

  // Last try: library default (may pick non-English — reject if no Latin letters)
  try {
    const cues = await YoutubeTranscript.fetchTranscript(videoId);
    const text = cuesToPlainText(cues);
    if (text.length >= 80 && /[A-Za-z]{3,}/.test(text)) return text;
  } catch {
    /* ignore */
  }
  return null;
}

function resolveYtDlpBin(): string {
  return process.env.YT_DLP_PATH?.trim() || "yt-dlp";
}

async function fetchViaYtDlp(videoId: string): Promise<string | null> {
  const outDir = path.join(await cacheDir(), "tmp");
  await fs.mkdir(outDir, { recursive: true });
  const outBase = path.join(outDir, videoId);
  try {
    const files = await fs.readdir(outDir);
    await Promise.all(
      files
        .filter((f) => f.startsWith(videoId))
        .map((f) => fs.unlink(path.join(outDir, f)).catch(() => {})),
    );
  } catch {
    /* ignore */
  }

  const bin = resolveYtDlpBin();
  // Prefer auto-CC; also pull manual tracks. Node JS runtime unlocks more player paths.
  const args = [
    "--skip-download",
    "--write-auto-subs",
    "--write-subs",
    "--sub-langs",
    "en.*,en,en-US,en-GB,en-orig",
    "--sub-format",
    "vtt/best",
    "--js-runtimes",
    "node",
    "--no-warnings",
    "--ignore-errors",
    "-o",
    outBase,
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  try {
    await execFileAsync(bin, args, {
      timeout: 45_000,
      maxBuffer: 2 * 1024 * 1024,
      cwd: process.cwd(),
    });
  } catch {
    // Partial downloads still usable
  }

  let names: string[] = [];
  try {
    names = (await fs.readdir(outDir)).filter((f) => f.startsWith(videoId));
  } catch {
    return null;
  }
  if (names.length === 0) return null;

  const prefer = (a: string, b: string) => {
    const score = (n: string) => {
      let s = 0;
      if (/\.en-US(\.|$)/i.test(n)) s += 6;
      if (/\.en(\.|$)/i.test(n) || /\.en-/i.test(n)) s += 4;
      if (n.endsWith(".vtt")) s += 2;
      if (n.endsWith(".srt")) s += 1;
      return -s;
    };
    return score(a) - score(b);
  };
  names.sort(prefer);

  for (const name of names) {
    try {
      const raw = await fs.readFile(path.join(outDir, name), "utf-8");
      const text = name.endsWith(".srt")
        ? parseSrtToText(raw)
        : parseVttToText(raw);
      await fs.unlink(path.join(outDir, name)).catch(() => {});
      if (text.length >= 80 && /[A-Za-z]{3,}/.test(text)) return text;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchViaLegacyApi(videoId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(
      `https://youtubetranscript.com/?v=${encodeURIComponent(videoId)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/xml,text/xml,*/*" },
      },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const xml = await res.text();
    if (!xml || xml.length < 100 || /<!DOCTYPE html/i.test(xml)) return null;
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

export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<YtTranscript | null> {
  const id = videoId.trim();
  if (!id) return null;

  const cached = await readCache(id);
  if (cached) return { ...cached, source: "cache" };

  let text = await fetchViaAutoCc(id);
  let source: YtTranscript["source"] = "auto-cc";

  if (!text) {
    text = await fetchViaYtDlp(id);
    if (text) source = "yt-dlp";
  }

  if (!text) {
    text = await fetchViaLegacyApi(id);
    if (text) source = "api";
  }

  if (!text || text.length < 80) return null;
  const truncated = text.slice(0, MAX_CHARS);

  const segments: YtSegment[] = truncated
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0)
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
