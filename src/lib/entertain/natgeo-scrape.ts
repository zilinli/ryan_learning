/**
 * NatGeo article scraper — fetches live article body from
 * kids.nationalgeographic.com when a slug is not in the curated catalog.
 *
 * Uses __NEXT_DATA__ JSON extraction with 7-day disk cache.
 * Falls back to the catalog on any failure.
 */

import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import type { NatGeoArticle } from "./natgeo-catalog";
import { NATGEO_CATALOG } from "./natgeo-catalog";

const CACHE_DIR = "data/natgeo-cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CHARS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;

function hashSlug(slug: string): string {
  return crypto.createHash("sha256").update(slug).digest("hex");
}

async function cacheDir(): Promise<string> {
  const dir = path.join(process.cwd(), CACHE_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function readCache(slug: string): Promise<{
  article: NatGeoArticle;
  ts: number;
} | null> {
  try {
    const file = path.join(await cacheDir(), `${hashSlug(slug)}.json`);
    const raw = await fs.readFile(file, "utf-8");
    const entry = JSON.parse(raw) as { article: NatGeoArticle; ts: number };
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(slug: string, article: NatGeoArticle): Promise<void> {
  try {
    const file = path.join(await cacheDir(), `${hashSlug(slug)}.json`);
    await fs.writeFile(
      file,
      JSON.stringify({ article, ts: Date.now() }),
      "utf-8",
    );
  } catch {
    // non-critical
  }
}

/**
 * Fetch the live article body from kids.nationalgeographic.com.
 * On any failure, returns the catalog entry if it exists, or null.
 */
export async function fetchNatGeoArticle(
  slug: string,
): Promise<NatGeoArticle | null> {
  // Try cache first
  const cached = await readCache(slug);
  if (cached) return cached.article;

  // Try curated catalog
  const cat = NATGEO_CATALOG.find((a) => a.slug === slug);
  if (cat) return cat; // catalog is always available

  // Live scrape attempt
  try {
    const url = `https://kids.nationalgeographic.com/animals/article/${slug}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SparkLearningBot/1.0; educational use)",
        Accept: "text/html,application/json",
      },
    });

    clearTimeout(timer);
    if (!res.ok) return null;

    const html = await res.text();

    // Try __NEXT_DATA__ pattern
    const body = extractFromNextData(html);

    // Fallback: generic paragraph extraction
    const fallbackBody = extractBodyFallback(html);
    const finalBody = body || fallbackBody;

    if (!finalBody || finalBody.length < 100) return null;

    const article: NatGeoArticle = {
      slug,
      title: extractTitle(html) || slug.replace(/-/g, " "),
      topic: extractTopic(html) || "science",
      gradeMin: 4,
      gradeMax: 9,
      readingTimeMin: Math.max(1, Math.round(finalBody.split(/\s+/).length / 200)),
      blurb: finalBody.slice(0, 200).trim() + "...",
      imageUrl: url,
      body: finalBody.slice(0, MAX_CHARS),
    };

    await writeCache(slug, article);
    return article;
  } catch {
    return null;
  }
}

function extractFromNextData(html: string): string | null {
  // Look for __NEXT_DATA__ JSON blob
  const patterns = [
    /"__NEXT_DATA__"[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/i,
    /<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/i,
    /"props":\s*\{[\s\S]*?"body"\s*:\s*"([\s\S]*?)(?:"\}\s*\}|"\})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (!match) continue;

    try {
      const data = JSON.parse(match[1]);
      // Walk common key paths
      const candidates = [
        data?.props?.pageProps?.article?.body,
        data?.props?.pageProps?.body,
        data?.props?.pageProps?.content,
        data?.props?.pageProps?.articleBody,
      ];
      for (const c of candidates) {
        if (typeof c === "string" && c.trim().length > 100) {
          return cleanHtmlText(c);
        }
      }
    } catch {
      // If match[1] is raw body text (from the string-capture pattern)
      if (match[1] && !match[1].startsWith("{")) {
        return cleanHtmlText(match[1]);
      }
    }
  }

  return null;
}

function extractBodyFallback(html: string): string {
  // Generic paragraph extraction from any <p> or <article> elements
  const paragraphs: string[] = [];

  // Try <p> tags
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRegex.exec(html))) {
    const text = cleanHtmlText(pm[1]);
    if (text.length > 20) paragraphs.push(text);
  }

  if (paragraphs.length >= 3) return paragraphs.join("\n\n");

  // Try divs with text content
  const divRegex = /<div[^>]*>\s*([\s\S]{50,}?)\s*<\/div>/gi;
  let dm;
  while ((dm = divRegex.exec(html))) {
    const text = cleanHtmlText(stripTags(dm[1]));
    if (text.length > 50 && text.split(/\s+/).length > 10) {
      paragraphs.push(text);
    }
  }

  return paragraphs.join("\n\n") || null;
}

function extractTitle(html: string): string | null {
  const patterns = [
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /"title"\s*:\s*"([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = p.exec(html);
    if (m?.[1]) {
      return cleanHtmlText(m[1]).split("|")[0].trim().slice(0, 200);
    }
  }
  return null;
}

function extractTopic(html: string): "animals" | null {
  // Quick heuristic: look for common NatGeo Kids topic indicators
  const lower = html.toLowerCase();
  if (
    lower.includes("mammal") ||
    lower.includes("bird") ||
    lower.includes("reptile") ||
    lower.includes("fish") ||
    lower.includes("invertebrate")
  ) {
    return "animals";
  }
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanHtmlText(raw: string): string {
  return stripTags(raw)
    .replace(/\s+/g, " ")
    .trim();
}
