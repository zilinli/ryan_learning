/**
 * Fetch TED English transcript for quiz generation only (not a transcript product).
 * Tries public subtitle endpoints + page __NEXT_DATA__; caches under data/ted-cache.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), "data", "ted-cache");
const MAX_CHARS = 12_000;

function cachePath(slug: string): string {
  const h = createHash("sha256").update(slug).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${slug.slice(0, 40)}_${h}.txt`);
}

async function readCache(slug: string): Promise<string | null> {
  try {
    const p = cachePath(slug);
    const st = await fs.stat(p);
    if (Date.now() - st.mtimeMs > 7 * 86_400_000) return null;
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function writeCache(slug: string, text: string): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachePath(slug), text, "utf8");
}

function cuesToText(cues: unknown): string {
  if (!Array.isArray(cues)) return "";
  const parts: string[] = [];
  for (const c of cues) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const content = o.content ?? o.text ?? o.cue;
    if (typeof content === "string" && content.trim()) parts.push(content.trim());
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchSubtitlesJson(slug: string): Promise<string | null> {
  const urls = [
    `https://www.ted.com/talks/${slug}/transcript.json?language=en`,
    `https://hls.ted.com/talks/${encodeURIComponent(slug)}/subtitles/en/full.json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "SparkTutor/1.0 (family education; transcript for comprehension)",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as unknown;
      if (typeof data === "string" && data.length > 80) return data;
      if (data && typeof data === "object") {
        const o = data as Record<string, unknown>;
        const fromCues = cuesToText(o.cues || o.captions || o.paragraphs);
        if (fromCues.length > 80) return fromCues;
        if (typeof o.transcript === "string" && o.transcript.length > 80) {
          return o.transcript;
        }
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchFromTalkPage(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.ted.com/talks/${slug}/transcript`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "SparkTutor/1.0 (family education)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html,
    );
    if (m?.[1]) {
      try {
        const data = JSON.parse(m[1]) as unknown;
        const flat = JSON.stringify(data);
        const cueMatch = /"content":"([^"\\]|\\.)*"/g;
        const bits: string[] = [];
        let cm: RegExpExecArray | null;
        while ((cm = cueMatch.exec(flat)) && bits.length < 400) {
          try {
            const parsed = JSON.parse(`{${cm[0]}}`) as { content?: string };
            if (parsed.content && parsed.content.length > 2) bits.push(parsed.content);
          } catch {
            /* skip */
          }
        }
        if (bits.length > 5) return bits.join(" ").replace(/\s+/g, " ").trim();
      } catch {
        /* fall through */
      }
    }
    // Strip tags crudely from transcript page paragraphs
    const paras = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (paras.length > 400) return paras.slice(0, MAX_CHARS);
  } catch {
    return null;
  }
  return null;
}

export async function fetchTedTranscript(slug: string): Promise<{
  text: string;
  source: "cache" | "subtitles" | "page" | "empty";
}> {
  const safe = slug.replace(/[^a-z0-9_]/gi, "").toLowerCase();
  if (!safe) return { text: "", source: "empty" };

  const cached = await readCache(safe);
  if (cached) return { text: cached.slice(0, MAX_CHARS), source: "cache" };

  const fromSubs = await fetchSubtitlesJson(safe);
  if (fromSubs) {
    const t = fromSubs.slice(0, MAX_CHARS);
    await writeCache(safe, t);
    return { text: t, source: "subtitles" };
  }

  const fromPage = await fetchFromTalkPage(safe);
  if (fromPage) {
    const t = fromPage.slice(0, MAX_CHARS);
    await writeCache(safe, t);
    return { text: t, source: "page" };
  }

  return { text: "", source: "empty" };
}
