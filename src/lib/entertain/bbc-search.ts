/**
 * Live BBC discovery via YouTube search + channel listing + curated fallback.
 * Query-based: yt-dlp ytsearch → fast, relevant. Empty-query: channel listing.
 * Live results are gated on usable English captions (TED parity).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BbcClip, BbcTopic } from "./bbc-catalog";
import { BBC_CATALOG, searchBbcCatalog, BBC_TOPIC_LABELS } from "./bbc-catalog";
import {
  filterVideosWithCaptions,
  type YtChannelVideo,
} from "./youtube-channel-search";

const execFileAsync = promisify(execFile);
const UA = "Mozilla/5.0 (compatible; SparkTutor/1.0)";

function ytDlpBin(): string {
  return process.env.YT_DLP_PATH?.trim() || "yt-dlp";
}

const BBC_CHANNELS = [
  { label: "BBC Earth", url: "https://www.youtube.com/@bbcearth/videos" },
  { label: "BBC Ideas", url: "https://www.youtube.com/@BBCIdeas/videos" },
  { label: "BBC", url: "https://www.youtube.com/@BBC/videos" },
] as const;

export type BbcSearchSource = "youtube-live" | "curated-fallback";

export type BbcSearchResult = {
  clips: BbcClip[];
  page: number;
  nbPages: number;
  nbHits: number;
  query: string;
  source: BbcSearchSource;
  cursor: string | null;
  hasNextPage: boolean;
};

type YtEntry = {
  id?: string;
  title?: string;
  duration?: number;
  channel?: string;
  uploader?: string;
};

function parseE(line: string): YtEntry | null {
  try {
    return JSON.parse(line) as YtEntry;
  } catch {
    return null;
  }
}

function inferTopic(t: string): BbcTopic {
  const l = t.toLowerCase();
  if (/planet|ocean|animal|wild|nature|bird|fish|whale|lion|penguin/.test(l))
    return "nature";
  if (/history|war|ancient|empire|century/.test(l)) return "history";
  if (/geo|country|city|map|continent/.test(l)) return "geography";
  if (/tech|computer|ai|robot|engineer/.test(l)) return "technology";
  if (/art|music|culture|language/.test(l)) return "culture";
  return "science";
}

function e2clip(e: YtEntry, channel: string): BbcClip {
  const topic = inferTopic(e.title || "");
  return {
    videoId: String(e.id || ""),
    title: String(e.title || "").slice(0, 200),
    series: BBC_TOPIC_LABELS[topic],
    topic,
    durationSec: Math.max(0, Math.round(Number(e.duration) || 0)) || 240,
    gradeMin: 4,
    gradeMax: 10,
    blurb: `From ${channel} on YouTube`,
    channel,
  };
}

async function gateEnCaptions(
  clips: BbcClip[],
  signal?: AbortSignal,
): Promise<BbcClip[]> {
  if (!clips.length) return [];
  const asYt: YtChannelVideo[] = clips.map((c) => ({
    videoId: c.videoId,
    title: c.title,
    durationSec: c.durationSec,
    channel: c.channel,
  }));
  const kept = await filterVideosWithCaptions(asYt, {
    maxChecks: Math.min(16, clips.length),
    signal,
  });
  const ids = new Set(kept.map((v) => v.videoId));
  return clips.filter((c) => ids.has(c.videoId));
}

async function ytSearch(query: string, n: number): Promise<YtEntry[]> {
  const args = [
    `ytsearch${n}:${query}`,
    "--dump-json",
    "--no-warnings",
    "--flat-playlist",
    "--user-agent",
    UA,
  ];
  try {
    const { stdout } = await execFileAsync(ytDlpBin(), args, {
      timeout: 25_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const out: YtEntry[] = [];
    for (const line of stdout.split("\n")) {
      const e = parseE(line);
      if (e?.id) out.push(e);
    }
    return out;
  } catch {
    return [];
  }
}

async function ytChannel(
  url: string,
  label: string,
  start: number,
  count: number,
): Promise<{ entries: YtEntry[]; label: string }> {
  const args = [
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--playlist-start",
    String(start),
    "--playlist-end",
    String(start + count - 1),
    "--user-agent",
    UA,
    url,
  ];
  try {
    const { stdout } = await execFileAsync(ytDlpBin(), args, {
      timeout: 25_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const out: YtEntry[] = [];
    for (const line of stdout.split("\n")) {
      const e = parseE(line);
      if (e?.id) out.push(e);
    }
    return { entries: out, label };
  } catch {
    return { entries: [], label };
  }
}

function curatedFb(
  query: string,
  topic: BbcTopic | "all",
  page: number,
  ps: number,
): BbcSearchResult {
  const all = searchBbcCatalog(query, topic === "all" ? undefined : topic);
  const start = Math.max(0, page) * ps;
  return {
    clips: all.slice(start, start + ps),
    page: Math.max(0, page),
    nbPages: Math.max(1, Math.ceil(all.length / ps)),
    nbHits: all.length,
    query,
    source: "curated-fallback",
    cursor: null,
    hasNextPage: page + 1 < Math.ceil(all.length / ps),
  };
}

function enc(ch: number, s: number): string {
  return `${ch}:${s}`;
}
function dec(raw: string | null | undefined): { ch: number; s: number } {
  if (!raw) return { ch: 0, s: 1 };
  const m = /^(\d+):(\d+)$/.exec(raw.trim());
  if (!m) return { ch: 0, s: 1 };
  return {
    ch: Math.max(0, Math.min(BBC_CHANNELS.length - 1, Number(m[1]) || 0)),
    s: Math.max(1, Number(m[2]) || 1),
  };
}

export async function searchBbcLive(opts: {
  query?: string;
  topic?: BbcTopic | "all";
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<BbcSearchResult> {
  const q = String(opts.query || "").trim().slice(0, 120);
  const topic = opts.topic || "all";
  const pg = Math.max(0, Math.min(50, opts.page ?? 0));
  const ps = Math.max(6, Math.min(24, opts.pageSize ?? 18));

  if (!q) return curatedFb("", topic, pg, ps);

  const entries = await ytSearch(q, Math.min(24, ps * 2));
  if (!entries.length) return curatedFb(q, topic, pg, ps);
  let clips = entries.map((e) => {
    const ch = (e.channel || e.uploader || "").includes("BBC")
      ? e.channel || e.uploader || "BBC"
      : "BBC";
    return e2clip(e, ch);
  });
  if (topic !== "all") clips = clips.filter((c) => c.topic === topic);
  if (!clips.length) return curatedFb(q, topic, pg, ps);
  const captioned = await gateEnCaptions(clips, opts.signal);
  if (!captioned.length) return curatedFb(q, topic, pg, ps);
  const paged = captioned.slice(0, ps);
  return {
    clips: paged,
    page: pg,
    nbPages: pg + 2,
    nbHits: captioned.length,
    query: q,
    source: "youtube-live",
    cursor: enc(0, 1 + ps),
    hasNextPage: captioned.length > ps,
  };
}

export async function refreshBbcBatch(opts: {
  cursor?: string | null;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<BbcSearchResult> {
  const ps = Math.max(6, Math.min(24, opts.pageSize ?? 18));
  const { ch, s } = dec(opts.cursor);
  const chDef = BBC_CHANNELS[ch] ?? BBC_CHANNELS[0];
  const batch = Math.min(36, ps * 2);
  const r = await ytChannel(chDef.url, chDef.label, s, batch);
  if (!r.entries.length) {
    const shuf = [...BBC_CATALOG].sort(() => Math.random() - 0.5);
    return {
      clips: shuf.slice(0, ps),
      page: 0,
      nbPages: 1,
      nbHits: shuf.length,
      query: "",
      source: "curated-fallback",
      cursor: enc((ch + 1) % BBC_CHANNELS.length, 1),
      hasNextPage: true,
    };
  }
  const rawClips = r.entries.map((e) => e2clip(e, r.label));
  const clips = (await gateEnCaptions(rawClips, opts.signal)).slice(0, ps);
  if (!clips.length) {
    const shuf = [...BBC_CATALOG].sort(() => Math.random() - 0.5);
    return {
      clips: shuf.slice(0, ps),
      page: 0,
      nbPages: 1,
      nbHits: shuf.length,
      query: "",
      source: "curated-fallback",
      cursor: enc((ch + 1) % BBC_CHANNELS.length, s + batch),
      hasNextPage: true,
    };
  }
  return {
    clips,
    page: 0,
    nbPages: 2,
    nbHits: clips.length,
    query: "",
    source: "youtube-live",
    cursor: enc((ch + 1) % BBC_CHANNELS.length, s + batch),
    hasNextPage: true,
  };
}
