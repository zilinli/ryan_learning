/**
 * Podcast RSS 2.0 parsing with zero npm dependencies.
 *
 * We deliberately avoid fast-xml-parser: the deploy runs `next start` from a
 * prebuilt .next and adding a dependency would force a fresh `npm install` on
 * the 4GB VPS. Regex-based parsing is sufficient for the well-formed feeds of
 * the curated catalog (Simplecast / Omny / Acast / Megaphone / Art19 / VPR).
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type PodcastEpisode = {
  guid: string;
  title: string;
  description: string;
  audioUrl: string;
  durationSec: number;
  pubDate: string;
};

let FEED_DIR = path.join(process.cwd(), "data", "podcast-cache", "feeds");
const FEED_TTL_MS = 6 * 60 * 60 * 1000; // 6h — episode lists stay reasonably fresh
const MAX_EPISODES = 40;

function feedCachePath(feedUrl: string): string {
  const h = createHash("sha256").update(feedUrl).digest("hex").slice(0, 16);
  return path.join(FEED_DIR, `feed_${h}.xml`);
}

async function readRawFeedCache(feedUrl: string): Promise<string | null> {
  try {
    const p = feedCachePath(feedUrl);
    const st = await fs.stat(p);
    if (Date.now() - st.mtimeMs > FEED_TTL_MS) return null;
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function writeRawFeedCache(feedUrl: string, xml: string): Promise<void> {
  try {
    await fs.mkdir(FEED_DIR, { recursive: true });
    await fs.writeFile(feedCachePath(feedUrl), xml, "utf8");
  } catch {
    /* cache is best-effort */
  }
}

export async function fetchPodcastFeedRaw(feedUrl: string): Promise<string> {
  const cached = await readRawFeedCache(feedUrl);
  if (cached) return cached;
  const res = await fetch(feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": "SparkTutor/1.0 (family education; RSS feed fetch)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Podcast feed HTTP ${res.status}`);
  const xml = await res.text();
  if (!xml || xml.length < 100) throw new Error("Podcast feed is empty");
  await writeRawFeedCache(feedUrl, xml);
  return xml;
}

/** Strip CDATA wrappers and decode common entities. */
function cleanText(raw: string): string {
  let t = (raw || "").trim();
  t = t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = t.replace(/<[^>]+>/g, " "); // drop any stray inline HTML
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  return t.replace(/\s+/g, " ").trim();
}

/** itunes:duration → seconds ("3600", "1:00:00", "12:34"). */
export function parseDurationSec(raw: string): number {
  const s = String(raw || "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10));
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return 0;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return Math.max(0, sec);
}

function firstTag(content: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(content);
  return m?.[1]?.trim() ?? "";
}

function firstAttr(content: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*?\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = re.exec(content);
  return m?.[1]?.trim() ?? "";
}

function episodeGuidFrom(ep: string, index: number): string {
  const guid = cleanText(firstTag(ep, "guid")).slice(0, 240);
  if (guid) return guid;
  const link = firstTag(ep, "link").slice(0, 240);
  if (link) return link;
  const title = cleanText(firstTag(ep, "title")).slice(0, 120);
  if (title) return `ep_${index}_${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return `ep_${index}`;
}

/** Parse a full RSS document into episodes (most recent first). */
export function parsePodcastFeed(xml: string): PodcastEpisode[] {
  const items: string[] = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < MAX_EPISODES) {
    items.push(m[0]);
  }

  const episodes: PodcastEpisode[] = items.map((ep, i) => {
    const title = cleanText(firstTag(ep, "title")).slice(0, 240);
    const description = cleanText(firstTag(ep, "description")).slice(0, 1200);
    const audioUrl = firstAttr(ep, "enclosure", "url").trim();
    const pubDate = firstTag(ep, "pubDate").trim();
    const durationRaw = firstTag(ep, "itunes:duration") || firstTag(ep, "duration");
    return {
      guid: episodeGuidFrom(ep, i),
      title: title || `Episode ${i + 1}`,
      description,
      audioUrl: /^https?:\/\//i.test(audioUrl) ? audioUrl : "",
      durationSec: parseDurationSec(durationRaw),
      pubDate,
    };
  });

  // RSS items are newest-first for these hosts; if we somehow get ascending,
  // most feeds already list newest first — keep original order.
  return episodes.filter((e) => e.audioUrl);
}

/** Fetch + parse a show's feed (network is bypassed by the 6h disk cache). */
export async function fetchPodcastEpisodes(
  feedUrl: string,
): Promise<PodcastEpisode[]> {
  const xml = await fetchPodcastFeedRaw(feedUrl);
  return parsePodcastFeed(xml);
}

/** Export for tests — override the cache dir to a temp path. */
export function setPodcastFeedCacheDirForTests(dir: string): void {
  (FEED_DIR as string) = dir;
}
