/**
 * GET /api/dict?word=hello&lang=en
 *
 * Lookup chain: cache → Merriam-Webster → FreeDict → local seeds →
 * translate fallback (ES/FR/ZH/Yue) → fuzzy suggestions + auto-correct →
 * cross-language translation enrichment.
 */

import { NextResponse } from "next/server";
import type { DictLang, DictResponse } from "@/lib/dict-types";
import { DICT_LANG_LABELS } from "@/lib/dict-types";
import { readFromCache, writeToCache } from "@/lib/dict-cache";
import { mwCollegiateLookup, mwSpanishLookup } from "@/lib/mw-client";
import { freeDictLookup } from "@/lib/freedict-client";
import { cantoneseLookup } from "@/lib/cantonese-dict";
import { localSeedLookup } from "@/lib/local-seeds";
import {
  buildSuggestions,
  pickAutoCorrect,
} from "@/lib/dict-suggest";
import {
  enrichDictResponse,
  needsTranslationEnrichment,
  translateFallbackLookup,
} from "@/lib/dict-translate";

const VALID_LANGS = Object.keys(DICT_LANG_LABELS) as DictLang[];

const MW_CACHE_SOURCES = ["mw", "mw-es"] as const;
const FALLBACK_CACHE_SOURCES = [
  "freedict",
  "cantonese-local",
  "local-seed",
  "translate",
] as const;
const CACHE_SOURCES = [...MW_CACHE_SOURCES, ...FALLBACK_CACHE_SOURCES] as const;

const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 120;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = now - 60_000;
  const hits = (rateMap.get(ip) ?? []).filter((t) => t > window);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

function readCached(
  sources: readonly string[],
  lang: DictLang,
  wordLower: string,
): { result: DictResponse; source: string } | null {
  for (const src of sources) {
    const cached = readFromCache(src, lang, wordLower);
    if (cached?.entries?.length) return { result: cached, source: src };
  }
  return null;
}

async function exactLookup(
  wordLower: string,
  lang: DictLang,
  opts?: { allowTranslateFallback?: boolean },
): Promise<{ result: DictResponse | null; source: string }> {
  const allowTranslate = opts?.allowTranslateFallback !== false;

  // Prefer Merriam-Webster cache, then live MW, before weaker FreeDict/translate caches
  const mwCached = readCached(MW_CACHE_SOURCES, lang, wordLower);
  if (mwCached) return mwCached;

  if (lang === "en") {
    const mw = await mwCollegiateLookup(wordLower);
    if (mw?.entries.length) return { result: mw, source: "mw" };
  } else if (lang === "es") {
    const mw = await mwSpanishLookup(wordLower);
    if (mw?.entries.length) return { result: mw, source: "mw-es" };
  }

  const weakCached = readCached(FALLBACK_CACHE_SOURCES, lang, wordLower);
  if (weakCached) return weakCached;

  if (lang === "en") {
    const fd = await freeDictLookup(wordLower, "en");
    if (fd?.entries.length) return { result: fd, source: "freedict" };
  } else if (lang === "es") {
    const fd = await freeDictLookup(wordLower, "es");
    if (fd?.entries.length) return { result: fd, source: "freedict" };
  } else if (lang === "fr") {
    const fd = await freeDictLookup(wordLower, "fr");
    if (fd?.entries.length) return { result: fd, source: "freedict" };
  } else if (lang === "zh") {
    const fd = await freeDictLookup(wordLower, "zh");
    if (fd?.entries.length) return { result: fd, source: "freedict" };
  } else if (lang === "yue") {
    const yue = cantoneseLookup(wordLower);
    if (yue.entries.length > 0) return { result: yue, source: "cantonese-local" };
    const fd = await freeDictLookup(wordLower, "zh");
    if (fd?.entries.length) return { result: fd, source: "freedict" };
  }

  const seed = localSeedLookup(wordLower, lang);
  if (seed?.entries.length) return { result: seed, source: "local-seed" };

  // FreeDict ES/FR/ZH is effectively empty for most standard vocabulary.
  // Translate → English gloss so learners still get a usable entry.
  if (allowTranslate && lang !== "en") {
    const fb = await translateFallbackLookup(wordLower, lang);
    if (fb?.entries.length) return { result: fb, source: "translate" };
  }

  return { result: null, source: "" };
}

async function finalize(
  result: DictResponse,
  lang: DictLang,
  wordLower: string,
  source: string,
): Promise<DictResponse> {
  const enriched = await enrichDictResponse(result);
  // Prefer caching the enriched payload so repeat hits stay bilingual
  writeToCache(source || "freedict", lang, wordLower, enriched);
  return enriched;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word")?.trim();
  const langParam = (searchParams.get("lang")?.trim() || "en") as DictLang;

  if (!word) {
    return NextResponse.json(
      { error: "Missing 'word' parameter" },
      { status: 400 },
    );
  }
  if (!VALID_LANGS.includes(langParam)) {
    return NextResponse.json(
      { error: `Invalid 'lang'. Must be one of: ${VALID_LANGS.join(", ")}` },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const wordLower = word.toLowerCase().trim();

  // Prefer Merriam-Webster cache hits; do not let weaker caches skip live MW
  const mwHit = readCached(MW_CACHE_SOURCES, langParam, wordLower);
  if (mwHit) {
    if (!needsTranslationEnrichment(mwHit.result)) {
      return NextResponse.json(mwHit.result);
    }
    const enriched = await enrichDictResponse(mwHit.result);
    writeToCache(mwHit.source, langParam, wordLower, enriched);
    return NextResponse.json(enriched);
  }

  if (rateLimited(ip)) {
    const weak = readCached(FALLBACK_CACHE_SOURCES, langParam, wordLower);
    if (weak) {
      return NextResponse.json(
        needsTranslationEnrichment(weak.result)
          ? await enrichDictResponse(weak.result)
          : weak.result,
      );
    }
    const seed = localSeedLookup(wordLower, langParam);
    if (seed) {
      return NextResponse.json(await enrichDictResponse(seed));
    }
    // Still allow translate fallback under rate limit — it doesn't hit FreeDict
    if (langParam !== "en") {
      const fb = await translateFallbackLookup(wordLower, langParam);
      if (fb?.entries.length) {
        writeToCache("translate", langParam, wordLower, fb);
        return NextResponse.json(fb);
      }
    }
    const suggestions = await buildSuggestions(wordLower, langParam, 5);
    return NextResponse.json({
      word,
      lang: langParam,
      entries: [],
      suggestions,
    } as DictResponse);
  }

  const { result, source } = await exactLookup(wordLower, langParam, {
    allowTranslateFallback: false,
  });
  if (result && result.entries.length > 0) {
    return NextResponse.json(
      await finalize(result, langParam, wordLower, source),
    );
  }

  const suggestions = await buildSuggestions(wordLower, langParam, 5);
  const auto = pickAutoCorrect(wordLower, suggestions);

  if (auto) {
    const corrected = await exactLookup(auto.toLowerCase(), langParam, {
      allowTranslateFallback: false,
    });
    if (corrected.result && corrected.result.entries.length > 0) {
      const enriched = await enrichDictResponse({
        ...corrected.result,
        word: corrected.result.word || auto,
        correctedFrom: word,
        suggestions: suggestions.filter(
          (s) => s.toLowerCase() !== auto.toLowerCase(),
        ),
      });
      writeToCache("local-seed", langParam, wordLower, enriched);
      if (corrected.source) {
        writeToCache(
          corrected.source,
          langParam,
          auto.toLowerCase(),
          enriched,
        );
      }
      return NextResponse.json(enriched);
    }
  }

  // FreeDict ES/FR/ZH rarely has entries — translate into an English gloss.
  if (langParam !== "en") {
    const fb = await exactLookup(wordLower, langParam, {
      allowTranslateFallback: true,
    });
    if (fb.result && fb.result.entries.length > 0) {
      return NextResponse.json(
        await finalize(fb.result, langParam, wordLower, fb.source || "translate"),
      );
    }
  }

  return NextResponse.json({
    word,
    lang: langParam,
    entries: [],
    suggestions,
  } as DictResponse);
}
