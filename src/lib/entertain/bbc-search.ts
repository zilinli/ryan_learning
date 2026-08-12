/**
 * Live BBC discovery via official YouTube channels + curated fallback.
 * Hard gate: English captions required for challenge-ready clips.
 */

import type { BbcClip, BbcTopic } from "./bbc-catalog";
import {
  BBC_CATALOG,
  searchBbcCatalog,
  BBC_TOPIC_LABELS,
} from "./bbc-catalog";
import {
  filterVideosByQuery,
  filterVideosWithCaptions,
  listChannelVideos,
  type YtChannelVideo,
} from "./youtube-channel-search";

const BBC_CHANNELS = [
  {
    label: "BBC Earth",
    url: "https://www.youtube.com/@bbcearth/videos",
  },
  {
    label: "BBC Ideas",
    url: "https://www.youtube.com/@BBCIdeas/videos",
  },
  {
    label: "BBC",
    url: "https://www.youtube.com/@BBC/videos",
  },
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

function inferTopic(title: string): BbcTopic {
  const t = title.toLowerCase();
  if (/planet|ocean|animal|wild|nature|bird|fish|whale|lion|penguin/.test(t))
    return "nature";
  if (/history|war|ancient|empire|century/.test(t)) return "history";
  if (/geo|country|city|map|continent/.test(t)) return "geography";
  if (/tech|computer|ai|robot|engineer/.test(t)) return "technology";
  if (/art|music|culture|language/.test(t)) return "culture";
  return "science";
}

function ytToClip(v: YtChannelVideo): BbcClip {
  const topic = inferTopic(v.title);
  const duration = v.durationSec || 240;
  return {
    videoId: v.videoId,
    title: v.title,
    series: BBC_TOPIC_LABELS[topic],
    topic,
    durationSec: duration,
    gradeMin: 3,
    gradeMax: 9,
    blurb: `From ${v.channel} on YouTube`,
    channel: v.channel,
  };
}

function curatedFallback(
  query: string,
  topic: BbcTopic | "all",
  page: number,
  pageSize: number,
): BbcSearchResult {
  const all = searchBbcCatalog(
    query,
    topic === "all" ? undefined : topic,
  );
  const start = Math.max(0, page) * pageSize;
  const clips = all.slice(start, start + pageSize);
  const nbPages = Math.max(1, Math.ceil(all.length / pageSize));
  return {
    clips,
    page: Math.max(0, page),
    nbPages,
    nbHits: all.length,
    query,
    source: "curated-fallback",
    cursor: null,
    hasNextPage: page + 1 < nbPages,
  };
}

function parseCursor(raw: string | null | undefined): {
  channelIdx: number;
  start: number;
} {
  if (!raw) return { channelIdx: 0, start: 1 };
  const m = /^(\d+):(\d+)$/.exec(raw.trim());
  if (!m) return { channelIdx: 0, start: 1 };
  return {
    channelIdx: Math.max(0, Math.min(BBC_CHANNELS.length - 1, Number(m[1]) || 0)),
    start: Math.max(1, Number(m[2]) || 1),
  };
}

function encodeCursor(channelIdx: number, start: number): string {
  return `${channelIdx}:${start}`;
}

export async function searchBbcLive(opts: {
  query?: string;
  topic?: BbcTopic | "all";
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<BbcSearchResult> {
  const query = String(opts.query || "").trim().slice(0, 120);
  const topic = opts.topic || "all";
  const page = Math.max(0, Math.min(50, opts.page ?? 0));
  const pageSize = Math.max(6, Math.min(24, opts.pageSize ?? 18));

  const batchSize = Math.min(36, pageSize * 2);
  const collected: YtChannelVideo[] = [];

  for (const ch of BBC_CHANNELS) {
    const raw = await listChannelVideos({
      channelUrl: ch.url,
      channelLabel: ch.label,
      playlistStart: 1 + page * batchSize,
      pageSize: batchSize,
      signal: opts.signal,
    });
    collected.push(...filterVideosByQuery(raw, query));
  }

  const unique = new Map<string, YtChannelVideo>();
  for (const v of collected) unique.set(v.videoId, v);
  let videos = [...unique.values()];

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

  const clips = gated.slice(0, pageSize).map(ytToClip);
  return {
    clips,
    page,
    nbPages: page + 2,
    nbHits: gated.length,
    query,
    source: "youtube-live",
    cursor: encodeCursor(0, 1 + (page + 1) * batchSize),
    hasNextPage: gated.length >= pageSize,
  };
}

export async function refreshBbcBatch(opts: {
  cursor?: string | null;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<BbcSearchResult> {
  const pageSize = Math.max(6, Math.min(24, opts.pageSize ?? 18));
  const { channelIdx, start } = parseCursor(opts.cursor);
  const ch = BBC_CHANNELS[channelIdx] ?? BBC_CHANNELS[0];
  const batchSize = Math.min(36, pageSize * 2);

  const raw = await listChannelVideos({
    channelUrl: ch.url,
    channelLabel: ch.label,
    playlistStart: start,
    pageSize: batchSize,
    signal: opts.signal,
  });

  let videos = raw;
  if (!videos.length) {
    const shuffled = [...BBC_CATALOG].sort(
      () => Math.random() - 0.5,
    );
    return {
      clips: shuffled.slice(0, pageSize),
      page: 0,
      nbPages: 1,
      nbHits: shuffled.length,
      query: "",
      source: "curated-fallback",
      cursor: encodeCursor((channelIdx + 1) % BBC_CHANNELS.length, 1),
      hasNextPage: true,
    };
  }

  const gated = await filterVideosWithCaptions(videos, {
    maxChecks: Math.min(18, videos.length),
    signal: opts.signal,
  });

  const clips = (gated.length ? gated : videos)
    .slice(0, pageSize)
    .map(ytToClip);

  const nextChannel = gated.length ? channelIdx : (channelIdx + 1) % BBC_CHANNELS.length;
  const nextStart = start + batchSize;

  return {
    clips,
    page: 0,
    nbPages: 2,
    nbHits: clips.length,
    query: "",
    source: gated.length ? "youtube-live" : "curated-fallback",
    cursor: encodeCursor(nextChannel, nextStart),
    hasNextPage: true,
  };
}
