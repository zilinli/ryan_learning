/**
 * Free Dictionary API client (https://api.dictionaryapi.dev).
 *
 * Covers English, Spanish, French, Chinese (Mandarin), and many more.
 * Rate limit: 1,000 requests/hour per IP (no API key required).
 * Used as primary for French & Chinese, fallback for English & Spanish.
 */

import type { DictEntry, DictLang, DictResponse } from "./dict-types";

const FREE_DICT_BASE = "https://api.dictionaryapi.dev/api/v2/entries";

/** Map our lang codes to FreeDict ISO 639-1 codes. */
const LANG_MAP: Record<string, string> = {
  en: "en", es: "es", fr: "fr", zh: "zh",
};

type FreeDictEntry = {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }[];
  }[];
  sourceUrls?: string[];
};

export function parseFreeDict(
  data: FreeDictEntry[],
  word: string,
  lang: DictLang,
): DictEntry[] {
  const entries: DictEntry[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    if (!item.meanings) continue;
    for (const meaning of item.meanings) {
      const pos = meaning.partOfSpeech;
      const defTexts = meaning.definitions.map((d) => d.definition).join(" | ");
      const dedupKey = `${pos}:${defTexts.slice(0, 80)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      entries.push({
        headword: item.word || word,
        pronunciation:
          item.phonetic ||
          item.phonetics?.find((p) => p.text)?.text ||
          undefined,
        audioUrl: item.phonetics?.find((p) => p.audio)?.audio || undefined,
        partOfSpeech: meaning.partOfSpeech,
        senses: meaning.definitions.map((d) => ({
          definition: d.definition,
          example: d.example || undefined,
        })),
        source: "freedict" as const,
      });
    }
  }
  return entries;
}

export async function freeDictLookup(
  word: string,
  lang: DictLang,
): Promise<DictResponse | null> {
  const iso = LANG_MAP[lang];
  if (!iso) return null;
  try {
    const url = `${FREE_DICT_BASE}/${iso}/${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as FreeDictEntry[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const entries = parseFreeDict(data, word, lang);
    if (entries.length === 0) return null;
    return { word, lang, entries };
  } catch {
    return null;
  }
}
