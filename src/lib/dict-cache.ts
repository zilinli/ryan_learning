/**
 * Server-side file cache for dictionary API responses.
 *
 * Caches unified DictResponse JSON in data/dict-cache/{source}/{lang}/{word}.json
 * with TTL enforcement (default 24h). Auto-evicts oldest when per-source limit hit.
 */

import fs from "node:fs";
import path from "node:path";
import type { DictResponse } from "./dict-types";

const CACHE_ROOT = path.join(process.cwd(), "data", "dict-cache");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_PER_SOURCE = 512;

function cachePath(source: string, lang: string, word: string): string {
  const safe = word.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_").slice(0, 64);
  return path.join(CACHE_ROOT, source, lang, `${encodeURIComponent(safe)}.json`);
}

export function readFromCache(
  source: string,
  lang: string,
  word: string,
): DictResponse | null {
  try {
    const p = cachePath(source, lang, word);
    if (!fs.existsSync(p)) return null;
    const stat = fs.statSync(p);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
      fs.unlinkSync(p);
      return null;
    }
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as DictResponse;
    // Don't serve cached empty results — let the chain retry
    if (!parsed.entries || parsed.entries.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeToCache(
  source: string,
  lang: string,
  word: string,
  data: DictResponse,
): void {
  try {
    const dir = path.dirname(cachePath(source, lang, word));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath(source, lang, word), JSON.stringify(data), "utf-8");

    // Evict oldest entries if over limit
    const entries = fs.readdirSync(dir).map((f) => {
      const p = path.join(dir, f);
      try {
        return { file: p, mtime: fs.statSync(p).mtimeMs };
      } catch {
        return { file: p, mtime: 0 };
      }
    });
    if (entries.length > MAX_PER_SOURCE) {
      entries.sort((a, b) => a.mtime - b.mtime);
      for (const e of entries.slice(0, entries.length - MAX_PER_SOURCE)) {
        try { fs.unlinkSync(e.file); } catch { /* ignore */ }
      }
    }
  } catch {
    // Cache write failures are non-critical
  }
}
