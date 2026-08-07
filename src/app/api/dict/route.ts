/**
 * GET /api/dict?word=hello&lang=en
 *
 * Orchestrates dictionary lookups across Merriam-Webster, Free Dictionary API,
 * and local Cantonese dataset. Response follows the unified DictResponse schema.
 */

import { NextResponse } from "next/server";
import type { DictLang, DictResponse } from "@/lib/dict-types";
import { DICT_LANG_LABELS } from "@/lib/dict-types";
import { readFromCache, writeToCache } from "@/lib/dict-cache";
import { mwCollegiateLookup, mwSpanishLookup } from "@/lib/mw-client";
import { freeDictLookup } from "@/lib/freedict-client";
import { cantoneseLookup } from "@/lib/cantonese-dict";
import { localSeedLookup } from "@/lib/local-seeds";

const VALID_LANGS = Object.keys(DICT_LANG_LABELS) as DictLang[];

// Simple in-memory rate limiter (per-IP, 30 req/min)
const rateMap = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = now - 60_000;
  const hits = (rateMap.get(ip) ?? []).filter((t) => t > window);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length > 30;
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

  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const wordLower = word.toLowerCase().trim();

  // ── Check cache first ──
  const cacheSources = ["mw", "mw-es", "freedict", "cantonese-local"];
  for (const src of cacheSources) {
    const cached = readFromCache(src, langParam, wordLower);
    if (cached) return NextResponse.json(cached);
  }

  let result: DictResponse | null = null;
  const sourceLabel = (src: string) => src;

  // ── Language-specific lookup chains ──
  if (langParam === "en") {
    // English: MW Collegiate → FreeDict (always available via Wiktionary)
    result = await mwCollegiateLookup(wordLower);
    if (result) {
      writeToCache(sourceLabel("mw"), langParam, wordLower, result);
      return NextResponse.json(result);
    }
    result = await freeDictLookup(wordLower, "en");
  } else if (langParam === "es") {
    // Spanish: MW Spanish-English (bidirectional) → FreeDict
    result = await mwSpanishLookup(wordLower);
    if (result) {
      writeToCache(sourceLabel("mw-es"), langParam, wordLower, result);
      return NextResponse.json(result);
    }
    result = await freeDictLookup(wordLower, "es");
  } else if (langParam === "fr") {
    // French: MW Spanish doesn't cover French, FreeDict may have limited coverage
    result = await freeDictLookup(wordLower, "fr");
  } else if (langParam === "zh") {
    // Chinese (Mandarin): FreeDict
    result = await freeDictLookup(wordLower, "zh");
  } else if (langParam === "yue") {
    // Cantonese: local dataset only
    result = cantoneseLookup(wordLower);
    if (result.entries.length > 0) {
      writeToCache(sourceLabel("cantonese-local"), langParam, wordLower, result);
      return NextResponse.json(result);
    }
    result = await freeDictLookup(wordLower, "zh");
  }

  if (result && result.entries.length > 0) {
    writeToCache(sourceLabel("freedict"), langParam, wordLower, result);
    return NextResponse.json(result);
  }

  // ── Final fallback: local seed lexicon ──
  const seedResult = localSeedLookup(wordLower, langParam);
  if (seedResult) {
    writeToCache(sourceLabel("local-seed"), langParam, wordLower, seedResult);
    return NextResponse.json(seedResult);
  }

  return NextResponse.json({
    word,
    lang: langParam,
    entries: [],
  } as DictResponse);
}
