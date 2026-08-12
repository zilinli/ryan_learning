/**
 * List videos from official YouTube channels via yt-dlp (metadata only).
 * Used by BBC / RSA live discovery — never downloads video files.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchYouTubeTranscript } from "@/lib/youtube-transcript";

const execFileAsync = promisify(execFile);

const UA =
  "Mozilla/5.0 (compatible; SparkTutor/1.0; +https://github.com/zilinli/ryan_learning)";

export type YtChannelVideo = {
  videoId: string;
  title: string;
  durationSec: number;
  channel: string;
};

function ytDlpBin(): string {
  return process.env.YT_DLP_PATH?.trim() || "yt-dlp";
}

function parseFlatEntry(
  line: string,
  channelLabel: string,
): YtChannelVideo | null {
  try {
    const row = JSON.parse(line) as {
      id?: string;
      title?: string;
      duration?: number;
    };
    const videoId = String(row.id || "").trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
    const title = String(row.title || videoId).trim().slice(0, 200);
    const durationSec = Math.max(
      0,
      Math.round(Number(row.duration) || 0),
    );
    return { videoId, title, durationSec, channel: channelLabel };
  } catch {
    return null;
  }
}

/** Fetch a page of uploads from a channel /videos tab. */
export async function listChannelVideos(opts: {
  channelUrl: string;
  channelLabel: string;
  playlistStart?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<YtChannelVideo[]> {
  const pageSize = Math.max(6, Math.min(40, opts.pageSize ?? 24));
  const start = Math.max(1, opts.playlistStart ?? 1);
  const end = start + pageSize - 1;

  const args = [
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--playlist-start",
    String(start),
    "--playlist-end",
    String(end),
    "--user-agent",
    UA,
    opts.channelUrl,
  ];

  try {
    const { stdout } = await execFileAsync(ytDlpBin(), args, {
      timeout: 28_000,
      maxBuffer: 8 * 1024 * 1024,
      signal: opts.signal,
    });
    const videos: YtChannelVideo[] = [];
    for (const line of stdout.split("\n")) {
      const v = parseFlatEntry(line, opts.channelLabel);
      if (v) videos.push(v);
    }
    return videos;
  } catch {
    return [];
  }
}

/** Keep only videos with usable English captions (cache-aware). */
export async function filterVideosWithCaptions(
  videos: YtChannelVideo[],
  opts?: { maxChecks?: number; signal?: AbortSignal },
): Promise<YtChannelVideo[]> {
  const maxChecks = Math.max(4, Math.min(20, opts?.maxChecks ?? 14));
  const candidates = videos.slice(0, maxChecks);
  const kept: YtChannelVideo[] = [];

  await Promise.all(
    candidates.map(async (v) => {
      if (opts?.signal?.aborted) return;
      const t = await fetchYouTubeTranscript(v.videoId);
      if (t && t.text.length >= 80) kept.push(v);
    }),
  );

  // Preserve channel order from original list
  const keptIds = new Set(kept.map((v) => v.videoId));
  return videos.filter((v) => keptIds.has(v.videoId));
}

export function filterVideosByQuery(
  videos: YtChannelVideo[],
  query: string,
): YtChannelVideo[] {
  const q = query.trim().toLowerCase();
  if (!q) return videos;
  const words = q.split(/\s+/).filter(Boolean);
  return videos.filter((v) =>
    words.every((w) => v.title.toLowerCase().includes(w)),
  );
}
