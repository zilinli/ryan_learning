/**
 * Live RSA discovery via YouTube search + channel listing + curated fallback.
 * Query-based: yt-dlp ytsearch. Empty-query: channel listing. No caption blocking.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RsaTopic, RsaVideo } from "./rsa-catalog";
import { RSA_CATALOG, searchRsaCatalog } from "./rsa-catalog";

const execFileAsync = promisify(execFile);
const UA = "Mozilla/5.0 (compatible; SparkTutor/1.0)";

function ytDlpBin(): string { return process.env.YT_DLP_PATH?.trim() || "yt-dlp"; }

export type RsaSearchSource = "youtube-live" | "curated-fallback";

export type RsaSearchResult = {
  videos: RsaVideo[];
  page: number; nbPages: number; nbHits: number; query: string;
  source: RsaSearchSource; cursor: string | null; hasNextPage: boolean;
};

// ── yt-dlp ═══════════════════════════════════

type YtEntry = { id?: string; title?: string; duration?: number; channel?: string; uploader?: string };

function parseE(line: string): YtEntry | null {
  try { const r = JSON.parse(line) as YtEntry; return r; } catch { return null; }
}

function inferTopic(t: string): RsaTopic {
  const l = t.toLowerCase();
  if (/school|education|learn|student|teacher/.test(l)) return "education";
  if (/creat|design|art|imagine/.test(l)) return "creativity";
  if (/econom|money|market|work/.test(l)) return "economics";
  if (/society|social|community|politic/.test(l)) return "society";
  if (/philosoph|ethic|moral|meaning/.test(l)) return "philosophy";
  if (/psych|brain|mind|emotion|empath/.test(l)) return "psychology";
  return "ideas";
}

function inferSeries(d: number): RsaVideo["series"] {
  if (d >= 480) return "Animate";
  if (d >= 180) return "Minimate";
  return "Shorts";
}

function e2video(e: YtEntry): RsaVideo {
  const d = Math.max(0, Math.round(Number(e.duration) || 0)) || 360;
  return {
    videoId: String(e.id || ""),
    title: String(e.title || "").slice(0, 200),
    speaker: "RSA",
    series: inferSeries(d),
    topic: inferTopic(e.title || ""),
    durationSec: d,
    gradeMin: 6, gradeMax: 12,
    blurb: "From RSA on YouTube",
  };
}

async function ytSearch(query: string, n: number): Promise<YtEntry[]> {
  const args = [`ytsearch${n}:${query}`, "--dump-json", "--no-warnings", "--flat-playlist", "--user-agent", UA];
  try {
    const { stdout } = await execFileAsync(ytDlpBin(), args, { timeout: 25_000, maxBuffer: 4 * 1024 * 1024 });
    const out: YtEntry[] = [];
    for (const line of stdout.split("\n")) { const e = parseE(line); if (e?.id) out.push(e); }
    return out;
  } catch { return []; }
}

// ── Curated fallback ──

function curatedFb(query: string, topic: RsaTopic|"all", page: number, ps: number): RsaSearchResult {
  const all = searchRsaCatalog(query, topic==="all"?undefined:topic);
  const start = Math.max(0,page)*ps;
  return { videos: all.slice(start,start+ps), page: Math.max(0,page), nbPages: Math.max(1,Math.ceil(all.length/ps)), nbHits: all.length, query, source: "curated-fallback", cursor: null, hasNextPage: page+1<Math.ceil(all.length/ps) };
}

// ── Public ═══════════════════════════════════

export async function searchRsaLive(opts: {
  query?: string; topic?: RsaTopic|"all"; page?: number; pageSize?: number; signal?: AbortSignal;
}): Promise<RsaSearchResult> {
  const q = String(opts.query||"").trim().slice(0,120);
  const topic = opts.topic||"all";
  const pg = Math.max(0,Math.min(50,opts.page??0));
  const ps = Math.max(6,Math.min(24,opts.pageSize??18));

  // Empty query: always show curated catalog first (instant)
  if (!q) return curatedFb("",topic,pg,ps);

  // Query-based: use yt-dlp YouTube search, fallback to curated
  const entries = await ytSearch(q, Math.min(24, ps*2));
  if (!entries.length) return curatedFb(q,topic,pg,ps);
  let videos = entries.map(e2video);
  if (topic!=="all") videos = videos.filter(v => v.topic===topic);
  if (!videos.length) return curatedFb(q,topic,pg,ps);
  const paged = videos.slice(0,ps);
  return { videos: paged, page: pg, nbPages: pg+2, nbHits: videos.length, query: q, source: "youtube-live", cursor: String(1+ps), hasNextPage: videos.length>ps };
}

export async function refreshRsaBatch(opts: {
  cursor?: string|null; pageSize?: number; signal?: AbortSignal;
}): Promise<RsaSearchResult> {
  const ps = Math.max(6,Math.min(24,opts.pageSize??18));
  const shuf = [...RSA_CATALOG].sort(()=>Math.random()-0.5);
  // Cycle through catalog — never empty, always has curated videos
  const all = shuf.length > 0 ? shuf : [...RSA_CATALOG];
  const start = (Number(opts.cursor) || 0) % Math.max(1, all.length);
  const batch = [...all.slice(start), ...all.slice(0, start)].slice(0, ps);
  return {
    videos: batch,
    page: 0,
    nbPages: Math.max(1, Math.ceil(all.length / ps)),
    nbHits: all.length,
    query: "",
    source: "curated-fallback",
    cursor: String((start + ps) % all.length),
    hasNextPage: true,
  };
}
