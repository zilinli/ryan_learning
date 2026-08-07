/**
 * Cross-language translation enrichment for dictionary responses.
 *
 * - Non-English lookup → attach English gloss/translation
 * - English lookup → attach ES / FR / ZH / 粵 translations of the headword
 *
 * Prefers local seed/Cantonese maps (offline, accurate for learners),
 * then Google gtx translate as fallback.
 */

import type { DictEntry, DictLang, DictResponse, DictSense } from "./dict-types";
import { localSeedLookup, listSeedWords } from "./local-seeds";
import { searchCantonese } from "./cantonese-dict";
import { freeDictLookup } from "./freedict-client";

/** Target languages shown when the query language is English. */
export const EN_CROSS_TARGETS: DictLang[] = ["es", "fr", "zh", "yue"];

const GTX_CODES: Record<DictLang, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  zh: "zh-CN",
  yue: "zh-TW", // closest free MT proxy; prefer local Cantonese when available
};

/** Extract a short English gloss from a seed-style definition. */
export function primaryGloss(definition: string): string {
  const raw = (definition || "").trim();
  if (!raw) return "";
  // "hello, hi" → "hello"; "to eat / learning" → "to eat"
  const first = raw.split(/[,;/]| - /)[0]?.trim() || raw;
  return first.replace(/^(to be|to)\s+/i, (m) => m.toLowerCase()).trim();
}

function looksEnglish(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Mostly Latin letters / spaces — typical of our EN glosses
  const letters = t.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 2 && letters.length >= t.replace(/\s/g, "").length * 0.6;
}

/** Build local bilingual edges from seed lexicons (lazy). */
let LOCAL_MAP: Map<string, string> | null = null;

function mapKey(from: DictLang, to: DictLang, word: string): string {
  return `${from}|${to}|${word.toLowerCase().trim()}`;
}

function ensureLocalMap(): Map<string, string> {
  if (LOCAL_MAP) return LOCAL_MAP;
  LOCAL_MAP = new Map();

  for (const lang of ["en", "es", "fr", "zh"] as DictLang[]) {
    for (const head of listSeedWords(lang)) {
      const resp = localSeedLookup(head, lang);
      if (!resp?.entries.length) continue;
      const def = resp.entries[0]?.senses[0]?.definition || "";
      const gloss = primaryGloss(def);
      if (!gloss) continue;

      if (lang !== "en" && looksEnglish(gloss)) {
        // foreign → English
        LOCAL_MAP.set(mapKey(lang, "en", head), gloss);
        LOCAL_MAP.set(mapKey(lang, "en", resp.word), gloss);
        // English → foreign (first wins)
        const enKey = mapKey("en", lang, gloss.toLowerCase());
        if (!LOCAL_MAP.has(enKey)) LOCAL_MAP.set(enKey, resp.word);
        // Also index individual comma parts already handled by primaryGloss
        const enWordKey = mapKey("en", lang, gloss.split(/\s+/)[0]!.toLowerCase());
        if (gloss.split(/\s+/).length === 1 && !LOCAL_MAP.has(enWordKey)) {
          LOCAL_MAP.set(enWordKey, resp.word);
        }
      }

      if (lang === "en") {
        // EN seeds define English words — no foreign target here
      }
    }
  }

  // Explicit high-value EN → * pairs from common learner words
  const extras: [string, DictLang, string][] = [
    ["hello", "es", "hola"],
    ["hello", "fr", "bonjour"],
    ["hello", "zh", "你好"],
    ["hello", "yue", "你好"],
    ["thank you", "es", "gracias"],
    ["thank you", "fr", "merci"],
    ["thank you", "zh", "谢谢"],
    ["thank you", "yue", "唔該"],
    ["water", "es", "agua"],
    ["water", "fr", "eau"],
    ["water", "zh", "水"],
    ["water", "yue", "水"],
    ["book", "es", "libro"],
    ["book", "fr", "livre"],
    ["book", "zh", "书"],
    ["book", "yue", "書"],
    ["school", "es", "escuela"],
    ["school", "fr", "école"],
    ["school", "zh", "学校"],
    ["school", "yue", "學校"],
    ["friend", "es", "amigo"],
    ["friend", "fr", "ami"],
    ["friend", "zh", "朋友"],
    ["friend", "yue", "朋友"],
    ["beautiful", "es", "bonito"],
    ["beautiful", "fr", "beau"],
    ["beautiful", "zh", "美丽"],
    ["beautiful", "yue", "靚"],
    ["dictionary", "es", "diccionario"],
    ["dictionary", "fr", "dictionnaire"],
    ["dictionary", "zh", "字典"],
    ["love", "es", "amor"],
    ["love", "fr", "amour"],
    ["love", "zh", "爱"],
    ["goodbye", "es", "adiós"],
    ["goodbye", "fr", "au revoir"],
    ["yes", "es", "sí"],
    ["yes", "fr", "oui"],
    ["no", "es", "no"],
    ["no", "fr", "non"],
    ["please", "es", "por favor"],
    ["please", "fr", "s'il vous plaît"],
    ["I", "yue", "我"],
    ["me", "yue", "我"],
    ["you", "yue", "你"],
  ];
  for (const [en, lang, text] of extras) {
    const k = mapKey("en", lang, en);
    if (!LOCAL_MAP.has(k)) LOCAL_MAP.set(k, text);
    const back = mapKey(lang, "en", text);
    if (!LOCAL_MAP.has(back)) LOCAL_MAP.set(back, en);
  }

  return LOCAL_MAP;
}

export function localTranslate(
  word: string,
  from: DictLang,
  to: DictLang,
): string | null {
  if (from === to) return word;
  const map = ensureLocalMap();
  const key = mapKey(from, to, word);
  const hit = map.get(key);
  if (hit) return hit;

  // Cantonese: search by English gloss or character
  if (to === "yue" && from === "en") {
    const hits = searchCantonese(word, 5);
    const exact = hits.find(
      (e) =>
        e.gloss.toLowerCase() === word.toLowerCase() ||
        e.gloss.toLowerCase().split(/\s*\/\s*|\s*,\s*/)
          .map((p) => p.trim())
          .includes(word.toLowerCase()),
    );
    if (exact) return exact.traditional;
    if (hits[0] && hits[0].gloss.toLowerCase().includes(word.toLowerCase())) {
      return hits[0].traditional;
    }
  }
  if (from === "yue" && to === "en") {
    const hits = searchCantonese(word, 3);
    if (hits[0]?.gloss) return primaryGloss(hits[0].gloss);
  }

  return null;
}

/** Google Translate unofficial gtx endpoint (no API key). */
export async function gtxTranslate(
  text: string,
  from: DictLang,
  to: DictLang,
): Promise<string | null> {
  const q = text.trim();
  if (!q || from === to) return q || null;
  // Skip absurdly long strings (definitions) — translate headwords only
  if (q.length > 80) return null;
  const sl = GTX_CODES[from];
  const tl = GTX_CODES[to];
  if (!sl || !tl) return null;
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}` +
      `&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    // Shape: [[["Hola","hello",...],...], ...]
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const parts: string[] = [];
    for (const seg of data[0] as unknown[]) {
      if (Array.isArray(seg) && typeof seg[0] === "string") parts.push(seg[0]);
    }
    const out = parts.join("").trim();
    if (!out) return null;
    // Allow same-spelling cognates (hotel, radio, no) — still useful for learners
    return out;
  } catch {
    return null;
  }
}

export async function translateWord(
  word: string,
  from: DictLang,
  to: DictLang,
): Promise<string | null> {
  const local = localTranslate(word, from, to);
  if (local) return local;
  return gtxTranslate(word, from, to);
}

export type CrossTranslation = {
  lang: DictLang;
  text: string;
};

function mergeSenseTranslations(
  sense: DictSense,
  extras: CrossTranslation[],
): DictSense {
  const existing = sense.translations ?? [];
  const seen = new Set(existing.map((t) => `${t.lang}:${t.text}`));
  const merged = [...existing];
  for (const t of extras) {
    const key = `${t.lang}:${t.text}`;
    if (seen.has(key)) continue;
    // Replace same-lang with new text if absent
    if (merged.some((m) => m.lang === t.lang)) continue;
    seen.add(key);
    merged.push(t);
  }
  return { ...sense, translations: merged.length ? merged : undefined };
}

/**
 * True when a cached/result payload still needs cross-language enrichment.
 */
export function needsTranslationEnrichment(resp: DictResponse): boolean {
  if (!resp.entries.length) return false;
  if (resp.crossTranslations && resp.crossTranslations.length > 0) return false;
  // Any sense already has translations covering the expected set?
  const langs = new Set(
    resp.entries.flatMap((e) =>
      e.senses.flatMap((s) => (s.translations ?? []).map((t) => t.lang)),
    ),
  );
  if (resp.lang === "en") {
    return !EN_CROSS_TARGETS.some((l) => langs.has(l));
  }
  return !langs.has("en");
}

/**
 * Enrich a DictResponse with cross-language translations on the headword.
 * Mutates a shallow copy — safe to cache afterward.
 */
export async function enrichDictResponse(
  resp: DictResponse,
): Promise<DictResponse> {
  if (!resp.entries.length) return resp;
  if (!needsTranslationEnrichment(resp)) return resp;

  const head = resp.word.trim();
  let cross: CrossTranslation[] = [];

  if (resp.lang === "en") {
    const results = await Promise.all(
      EN_CROSS_TARGETS.map(async (lang) => {
        const text = await translateWord(head, "en", lang);
        return text ? ({ lang, text } satisfies CrossTranslation) : null;
      }),
    );
    cross = results.filter((x): x is CrossTranslation => Boolean(x));
  } else {
    // Prefer English gloss already present on seed definitions
    let en: string | null = null;
    const firstDef = resp.entries[0]?.senses[0]?.definition || "";
    if (looksEnglish(firstDef)) {
      en = primaryGloss(firstDef);
    }
    if (!en) {
      en = await translateWord(head, resp.lang, "en");
    }
    // Cantonese often already has Mandarin in translations — keep English primary
    if (en) cross = [{ lang: "en", text: en }];
  }

  if (!cross.length) return resp;

  const entries: DictEntry[] = resp.entries.map((entry, idx) => {
    if (idx !== 0) return entry;
    return {
      ...entry,
      senses: entry.senses.map((sense, sIdx) =>
        sIdx === 0 ? mergeSenseTranslations(sense, cross) : sense,
      ),
    };
  });

  return {
    ...resp,
    entries,
    crossTranslations: cross,
  };
}

/**
 * When FreeDict/MW/seeds miss a non-English word (common — FreeDict ES/FR/ZH
 * coverage is effectively empty), build a learner entry via translation:
 * headword → English gloss, optionally enriched with the English FreeDict sense.
 */
export async function translateFallbackLookup(
  word: string,
  lang: DictLang,
): Promise<DictResponse | null> {
  const q = word.trim();
  if (!q || lang === "en") return null;

  const en = await translateWord(q, lang, "en");
  if (!en?.trim()) return null;

  const gloss = primaryGloss(en) || en.trim();
  let partOfSpeech = "word";
  let definition = gloss;

  // Prefer a single English lemma for FreeDict enrichment
  const lemma = gloss
    .replace(/^(to|a|an|the)\s+/i, "")
    .split(/\s+/)[0]
    ?.replace(/[^a-zA-Z'-]/g, "")
    .toLowerCase();
  if (lemma && lemma.length >= 2) {
    try {
      const fd = await freeDictLookup(lemma, "en");
      const entry = fd?.entries[0];
      if (entry) {
        partOfSpeech = entry.partOfSpeech || partOfSpeech;
        const enSense = entry.senses[0]?.definition?.trim();
        if (enSense) {
          definition = `${gloss} — ${enSense}`;
        }
        if (entry.senses[0]?.example) {
          return {
            word: q,
            lang,
            entries: [
              {
                headword: q,
                pronunciation: entry.pronunciation,
                partOfSpeech,
                senses: [
                  {
                    definition,
                    example: entry.senses[0].example,
                    translations: [{ lang: "en", text: gloss }],
                  },
                ],
                source: "translate",
              },
            ],
            crossTranslations: [{ lang: "en", text: gloss }],
          };
        }
      }
    } catch {
      // FreeDict optional — gloss alone is enough
    }
  }

  return {
    word: q,
    lang,
    entries: [
      {
        headword: q,
        partOfSpeech,
        senses: [
          {
            definition,
            translations: [{ lang: "en", text: gloss }],
          },
        ],
        source: "translate",
      },
    ],
    crossTranslations: [{ lang: "en", text: gloss }],
  };
}
