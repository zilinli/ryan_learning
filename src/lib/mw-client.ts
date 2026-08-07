/**
 * Merriam-Webster Dictionary API client.
 *
 * Two reference APIs (free tier, 1000 queries/day each):
 *   - Collegiate Dictionary (English definitions, audio, etymology)
 *   - Spanish-English Dictionary (bidirectional ES↔EN)
 *
 * When API keys are absent, returns null so the route can fall back to FreeDict.
 */

import type { DictEntry, DictResponse } from "./dict-types";

const MW_BASE = "https://www.dictionaryapi.com/api/v3/references";

function key(name: "collegiate" | "spanish"): string | undefined {
  const env =
    name === "collegiate"
      ? process.env.MERRIAM_WEBSTER_COLLEGIATE_KEY
      : process.env.MERRIAM_WEBSTER_SPANISH_KEY;
  if (!env || env === "your-key-here") return undefined;
  return env;
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

/** Parse MW Collegiate JSON response into unified DictEntry[]. */
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
        senses: d.shortdef.map((def, i) => {
          const exGroup = d.def?.[0]?.sseq?.[i]?.[0]?.[1] as
            | { dt?: [string, string][] }
            | undefined;
          const exampleText = exGroup?.dt?.find(
            ([tag]) => tag === "vis",
          )?.[1]?.replace(/\{[^}]+\}/g, "");
          return {
            definition: def.replace(/\{[^}]+\}/g, ""),
            example: exampleText || undefined,
          };
        }),
        source: "merriam-webster" as const,
      };
    });
}

export async function mwCollegiateLookup(
  word: string,
): Promise<DictResponse | null> {
  const k = key("collegiate");
  if (!k) return null;
  try {
    const url = `${MW_BASE}/collegiate/json/${encodeURIComponent(word)}?key=${k}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as MwCollegiateEntry[];
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      word,
      lang: "en",
      entries: parseMwCollegiate(data, word),
    };
  } catch {
    return null;
  }
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
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as MwSpanishEntry[];
    if (!Array.isArray(data) || data.length === 0 || !("shortdef" in (data[0] ?? {}))) return null;
    return {
      word,
      lang: "es",
      entries: parseMwSpanish(data, word),
    };
  } catch {
    return null;
  }
}
