/**
 * GET /api/dict?word=hello&lang=en
 *
 * Lookup chain: cache → Merriam-Webster → FreeDict → local seeds →
 * fuzzy suggestions (Datamuse + seeds) with auto-correct for close typos.
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

const VALID_LANGS = Object.keys(DICT_LANG_LABELS) as DictLang[];

// Per-IP rate limit — raised because typing used to flood before debounce fix
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

async function exactLookup(
  wordLower: string,
  lang: DictLang,
): Promise<{ result: DictResponse | null; source: string }> {
  // Cache (including local-seed)
  for (const src of ["mw", "mw-es", "freedict", "cantonese-local", "local-seed"]) {
    const cached = readFromCache(src, lang, wordLower);
    if (cached) return { result: cached, source: src };
  }

  if (lang === "en") {
    const mw = await mwCollegiateLookup(wordLower);
    if (mw?.entries.length) return { result: mw, source: "mw" };
    const fd = await freeDictLookup(wordLower, "en");
    if (fd?.entries.length) return { result: fd, source: "freedict" };
  } else if (lang === "es") {
    const mw = await mwSpanishLookup(wordLower);
    if (mw?.entries.length) return { result: mw, source: "mw-es" };
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

  return { result: null, source: "" };
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

  // Serve cache without counting against rate limit
  for (const src of ["mw", "mw-es", "freedict", "cantonese-local", "local-seed"]) {
    const cached = readFromCache(src, langParam, wordLower);
    if (cached) return NextResponse.json(cached);
  }

  if (rateLimited(ip)) {
    // Still allow local seed / fuzzy offline path when rate-limited
    const seed = localSeedLookup(wordLower, langParam);
    if (seed) return NextResponse.json(seed);
    const suggestions = await buildSuggestions(wordLower, langParam, 5);
    return NextResponse.json({
      word,
      lang: langParam,
      entries: [],
      suggestions,
    } as DictResponse);
  }

  const { result, source } = await exactLookup(wordLower, langParam);
  if (result && result.entries.length > 0) {
    if (source && source !== "local-seed") {
      // local-seed already written below; avoid double-write noise
    }
    writeToCache(source || "freedict", langParam, wordLower, result);
    return NextResponse.json(result);
  }

  // ── Fuzzy: suggestions + auto-correct for EN / ES / FR (and others) ──
  const suggestions = await buildSuggestions(wordLower, langParam, 5);
  const auto = pickAutoCorrect(wordLower, suggestions);

  if (auto) {
    const corrected = await exactLookup(auto.toLowerCase(), langParam);
    if (corrected.result && corrected.result.entries.length > 0) {
      const payload: DictResponse = {
        ...corrected.result,
        word: corrected.result.word || auto,
        correctedFrom: word,
        suggestions: suggestions.filter(
          (s) => s.toLowerCase() !== auto.toLowerCase(),
        ),
      };
      // Cache under the typo key so repeat lookups are instant
      writeToCache("local-seed", langParam, wordLower, payload);
      if (corrected.source) {
        writeToCache(corrected.source, langParam, auto.toLowerCase(), corrected.result);
      }
      return NextResponse.json(payload);
    }
  }

  return NextResponse.json({
    word,
    lang: langParam,
    entries: [],
    suggestions,
  } as DictResponse);
}
