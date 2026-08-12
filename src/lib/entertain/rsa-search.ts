/**
 * Live RSA discovery via @theRSAorg + curated fallback.
 * Hard gate: English captions required.
 */

import type { RsaTopic, RsaVideo } from "./rsa-catalog";
import { RSA_CATALOG, searchRsaCatalog } from "./rsa-catalog";
import {
  filterVideosByQuery,
  filterVideosWithCaptions,
  listChannelVideos,
  type YtChannelVideo,
} from "./youtube-channel-search";

const RSA_CHANNEL = {
  label: "RSA",
  url: "https://www.youtube.com/@theRSAorg/videos",
} as const;

export type RsaSearchSource = "youtube-live" | "curated-fallback";

export type RsaSearchResult = {
  videos: RsaVideo[];
  page: number;
  nbPages: number;
  nbHits: number;
  query: string;
  source: RsaSearchSource;
  cursor: string | null;
  hasNextPage: boolean;
};

function inferTopic(title: string): RsaTopic {
  const t = title.toLowerCase();
  if (/school|education|learn|student|teacher/.test(t)) return "education";
  if (/creat|design|art|imagine/.test(t)) return "creativity";
  if (/econom|money|market|work/.test(t)) return "economics";
  if (/society|social|community|politic/.test(t)) return "society";
  if (/philosoph|ethic|moral|meaning/.test(t)) return "philosophy";
  if (/psych|brain|mind|emotion|empathy/.test(t)) return "psychology";
  return "ideas";
}

function inferSeries(durationSec: number): RsaVideo["series"] {
  if (durationSec >= 480) return "Animate";
  if (durationSec >= 180) return "Minimate";
  return "Shorts";
}

function ytToVideo(v: YtChannelVideo): RsaVideo {
  const durationSec = v.durationSec || 360;
  return {
    videoId: v.videoId,
    title: v.title,
    speaker: "RSA",
    series: inferSeries(durationSec),
    topic: inferTopic(v.title),
    durationSec,
    gradeMin: 6,
    gradeMax: 12,
    blurb: "From RSA on YouTube",
  };
}

function curatedFallback(
  query: string,
  topic: RsaTopic | "all",
  page: number,
  pageSize: number,
): RsaSearchResult {
  const all = searchRsaCatalog(
    query,
    topic === "all" ? undefined : topic,
  );
  const start = Math.max(0, page) * pageSize;
  const videos = all.slice(start, start + pageSize);
  const nbPages = Math.max(1, Math.ceil(all.length / pageSize));
  return {
    videos,
    page: Math.max(0, page),
    nbPages,
    nbHits: all.length,
    query,
    source: "curated-fallback",
    cursor: null,
    hasNextPage: page + 1 < nbPages,
  };
}

export async function searchRsaLive(opts: {
  query?: string;
  topic?: RsaTopic | "all";
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<RsaSearchResult> {
  const query = String(opts.query || "").trim().slice(0, 120);
  const topic = opts.topic || "all";
  const page = Math.max(0, Math.min(50, opts.page ?? 0));
  const pageSize = Math.max(6, Math.min(24, opts.pageSize ?? 18));
  const batchSize = Math.min(40, pageSize * 2);
  const start = 1 + page * batchSize;

  const raw = await listChannelVideos({
    channelUrl: RSA_CHANNEL.url,
    channelLabel: RSA_CHANNEL.label,
    playlistStart: start,
    pageSize: batchSize,
    signal: opts.signal,
  });

  let videos = filterVideosByQuery(raw, query);
  if (topic !== "all") {
    videos = videos.filter((v) => inferTopic(v.title) === topic);
  }

  if (!videos.length) {
    return curatedFallback(query, topic, page, pageSize);
  }

  const gated = await filterVideosWithCaptions(videos, {
    maxChecks: Math.min(18, videos.length),
    signal: opts.signal,
  });

  if (!gated.length) {
    return curatedFallback(query, topic, page, pageSize);
  }

  const results = gated.slice(0, pageSize).map(ytToVideo);
  return {
    videos: results,
    page,
    nbPages: page + 2,
    nbHits: gated.length,
    query,
    source: "youtube-live",
    cursor: String(start + batchSize),
    hasNextPage: gated.length >= pageSize,
  };
}

export async function refreshRsaBatch(opts: {
  cursor?: string | null;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<RsaSearchResult> {
  const pageSize = Math.max(6, Math.min(24, opts.pageSize ?? 18));
  const start = Math.max(1, Number(opts.cursor) || 1);
  const batchSize = Math.min(40, pageSize * 2);

  const raw = await listChannelVideos({
    channelUrl: RSA_CHANNEL.url,
    channelLabel: RSA_CHANNEL.label,
    playlistStart: start,
    pageSize: batchSize,
    signal: opts.signal,
  });

  if (!raw.length) {
    const shuffled = [...RSA_CATALOG].sort(() => Math.random() - 0.5);
    return {
      videos: shuffled.slice(0, pageSize),
      page: 0,
      nbPages: 1,
      nbHits: shuffled.length,
      query: "",
      source: "curated-fallback",
      cursor: "1",
      hasNextPage: true,
    };
  }

  const gated = await filterVideosWithCaptions(raw, {
    maxChecks: Math.min(18, raw.length),
    signal: opts.signal,
  });

  const videos = (gated.length ? gated : raw).slice(0, pageSize).map(ytToVideo);

  return {
    videos,
    page: 0,
    nbPages: 2,
    nbHits: videos.length,
    query: "",
    source: gated.length ? "youtube-live" : "curated-fallback",
    cursor: String(start + batchSize),
    hasNextPage: true,
  };
}
