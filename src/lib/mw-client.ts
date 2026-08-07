/**
 * Merriam-Webster Dictionary API client.
 *
 * Reference APIs (free tier, 1000 queries/day each):
 *   - School Dictionary (`sd4`) — learner-friendly English (grades 9–11)
 *   - Collegiate Dictionary — full English (optional fallback key)
 *   - Spanish-English Dictionary — bidirectional ES↔EN
 *
 * When API keys are absent, returns null so the route can fall back to FreeDict.
 */

import type { DictEntry, DictResponse } from "./dict-types";

const MW_BASE = "https://www.dictionaryapi.com/api/v3/references";

function key(name: "school" | "collegiate" | "spanish"): string | undefined {
  const env =
    name === "school"
      ? process.env.MERRIAM_WEBSTER_SCHOOL_KEY
      : name === "collegiate"
        ? process.env.MERRIAM_WEBSTER_COLLEGIATE_KEY
        : process.env.MERRIAM_WEBSTER_SPANISH_KEY;
  if (!env || env === "your-key-here") return undefined;
  return env.trim() || undefined;
}

// ── Collegiate (English monolingual) ──

type MwCollegiateEntry = {
  meta: { id: string; uuid: string; stems: string[] };
  hwi: { hw: string; prs?: { mw: string; sound?: { audio: string } }[] };
  fl: string;
  shortdef: string[];
  ins?: { if: string }[];
  def?: { sseq: unknown[][] }[];
  et?: string[][];
  date?: string;
};

function mwAudioUrl(audio: string): string {
  const subdir =
    audio.startsWith("bix") ? "bix"
    : audio.startsWith("gg") ? "gg"
    : /^[0-9]/.test(audio) ? "number"
    : audio[0]!;
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audio}.mp3`;
}

/** Parse MW Collegiate / School Dictionary JSON into unified DictEntry[]. */
function mwExampleText(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const t = raw.replace(/\{[^}]+\}/g, "").trim();
    return t || undefined;
  }
  if (Array.isArray(raw)) {
    const parts = raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "t" in item) {
          const t = (item as { t?: unknown }).t;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .join(" ")
      .replace(/\{[^}]+\}/g, "")
      .trim();
    return parts || undefined;
  }
  return undefined;
}

export function parseMwCollegiate(
  data: MwCollegiateEntry[],
  word: string,
): DictEntry[] {
  return data
    .filter((d): d is MwCollegiateEntry => typeof d === "object" && "shortdef" in d)
    .map((d) => {
      const prs = d.hwi.prs?.[0];
      return {
        headword: d.hwi.hw.replace(/\*/g, ""),
        pronunciation: prs?.mw ?? undefined,
        audioUrl: prs?.sound ? mwAudioUrl(prs.sound.audio) : undefined,
        partOfSpeech: d.fl,
        senses: (d.shortdef ?? []).map((def, i) => {
          const exGroup = d.def?.[0]?.sseq?.[i]?.[0]?.[1] as
            | { dt?: [string, unknown][] }
            | undefined;
          const vis = exGroup?.dt?.find(([tag]) => tag === "vis")?.[1];
          return {
            definition: String(def ?? "").replace(/\{[^}]+\}/g, ""),
            example: mwExampleText(vis),
          };
        }),
        source: "merriam-webster" as const,
      };
    });
}

async function mwEnglishReferenceLookup(
  word: string,
  ref: "sd4" | "collegiate",
  apiKey: string,
): Promise<DictResponse | null> {
  try {
    const url = `${MW_BASE}/${ref}/json/${encodeURIComponent(word)}?key=${apiKey}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MwCollegiateEntry[];
    if (!Array.isArray(data) || data.length === 0) return null;
    // Suggestion-only responses are string arrays
    if (typeof data[0] === "string") return null;
    const entries = parseMwCollegiate(data, word);
    if (!entries.length) return null;
    return { word, lang: "en", entries };
  } catch {
    return null;
  }
}

/**
 * English lookup: prefer School Dictionary (learner definitions), then Collegiate.
 */
export async function mwCollegiateLookup(
  word: string,
): Promise<DictResponse | null> {
  const schoolKey = key("school");
  if (schoolKey) {
    const school = await mwEnglishReferenceLookup(word, "sd4", schoolKey);
    if (school) return school;
  }
  const collegiateKey = key("collegiate");
  if (collegiateKey) {
    return mwEnglishReferenceLookup(word, "collegiate", collegiateKey);
  }
  return null;
}

// ── Spanish-English (bilingual bidirectional) ──

type MwSpanishEntry = {
  meta: { id: string; uuid: string };
  src: string; // "español" or "english"
  hwi: { hw: string; prs?: { mw: string; sound?: { audio: string } }[] };
  fl: string;
  shortdef: string[];
  def?: { sseq: unknown[][] }[];
};

function mwSpanishAudioUrl(audio: string): string {
  const lang = audio.startsWith("ses") ? "es" : "en";
  const subdir =
    audio.startsWith("bix") ? "bix"
    : audio.startsWith("gg") ? "gg"
    : /^[0-9]/.test(audio) ? "number"
    : audio[0]!;
  return `https://media.merriam-webster.com/audio/prons/${lang}/me/mp3/${subdir}/${audio}.mp3`;
}

export function parseMwSpanish(
  data: MwSpanishEntry[],
  word: string,
): DictEntry[] {
  return data
    .filter((d): d is MwSpanishEntry => typeof d === "object" && "shortdef" in d)
    .map((d) => {
      const prs = d.hwi.prs?.[0];
      const isSpanSrc = d.src === "español";
      return {
        headword: d.hwi.hw,
        pronunciation: prs?.mw ?? undefined,
        audioUrl: prs?.sound ? mwSpanishAudioUrl(prs.sound.audio) : undefined,
        partOfSpeech: d.fl,
        senses: d.shortdef.map((def) => ({
          definition: def,
          translations: [
            { lang: (isSpanSrc ? "en" : "es") as "en" | "es", text: def },
          ],
        })),
        source: "merriam-webster" as const,
      };
    });
}

export async function mwSpanishLookup(
  word: string,
): Promise<DictResponse | null> {
  const k = key("spanish");
  if (!k) return null;
  try {
    const url = `${MW_BASE}/spanish/json/${encodeURIComponent(word)}?key=${k}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MwSpanishEntry[];
    if (!Array.isArray(data) || data.length === 0) return null;
    if (typeof data[0] === "string" || !("shortdef" in (data[0] ?? {}))) {
      return null;
    }
    return {
      word,
      lang: "es",
      entries: parseMwSpanish(data, word),
    };
  } catch {
    return null;
  }
}
