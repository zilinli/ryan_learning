/**
 * English → Spanish learner dictionary (G4-friendly).
 * Start with high-frequency function words; expand entries over time.
 */

export type SpanishGender = "m" | "f" | "n" | "mf";
export type SpanishNumber = "sg" | "pl";

export type SpanishSense = {
  /** Spanish headword / form */
  es: string;
  /** IPA-ish or syllable tip for learners (optional) */
  pronunciation?: string;
  /** Part of speech label */
  pos: string;
  gender?: SpanishGender;
  number?: SpanishNumber;
  /** Short English gloss */
  gloss: string;
  /** Kid-friendly example: English — Español */
  example?: { en: string; es: string };
  /** Extra tip (contractions, agreement, …) */
  note?: string;
};

export type SpanishDictEntry = {
  /** Normalized English lemma (lowercase) */
  en: string;
  /** Alternate English spellings / phrases that map here */
  aliases?: string[];
  senses: SpanishSense[];
};

/** Seed lexicon — “the” is the first full article paradigm. */
export const SPANISH_DICT: SpanishDictEntry[] = [
  {
    en: "the",
    senses: [
      {
        es: "el",
        pronunciation: "el",
        pos: "definite article",
        gender: "m",
        number: "sg",
        gloss: "the (masculine singular)",
        example: { en: "the book", es: "el libro" },
        note: "Use before masculine singular nouns.",
      },
      {
        es: "la",
        pronunciation: "lah",
        pos: "definite article",
        gender: "f",
        number: "sg",
        gloss: "the (feminine singular)",
        example: { en: "the house", es: "la casa" },
        note: "Use before feminine singular nouns.",
      },
      {
        es: "los",
        pronunciation: "lohs",
        pos: "definite article",
        gender: "m",
        number: "pl",
        gloss: "the (masculine plural)",
        example: { en: "the books", es: "los libros" },
      },
      {
        es: "las",
        pronunciation: "lahs",
        pos: "definite article",
        gender: "f",
        number: "pl",
        gloss: "the (feminine plural)",
        example: { en: "the houses", es: "las casas" },
      },
      {
        es: "lo",
        pronunciation: "loh",
        pos: "neuter article",
        gender: "n",
        number: "sg",
        gloss: "the (neuter / abstract)",
        example: { en: "the important thing", es: "lo importante" },
        note: "Used with adjectives for abstract ideas: lo bueno, lo mejor.",
      },
      {
        es: "al",
        pronunciation: "ahl",
        pos: "contraction",
        gender: "m",
        number: "sg",
        gloss: "to the / at the (a + el)",
        example: { en: "to the park", es: "al parque" },
        note: "a + el → al (always).",
      },
      {
        es: "del",
        pronunciation: "dehl",
        pos: "contraction",
        gender: "m",
        number: "sg",
        gloss: "of the / from the (de + el)",
        example: { en: "of the book", es: "del libro" },
        note: "de + el → del (always).",
      },
    ],
  },
  {
    en: "a",
    aliases: ["an"],
    senses: [
      {
        es: "un",
        pos: "indefinite article",
        gender: "m",
        number: "sg",
        gloss: "a / an (masculine)",
        example: { en: "a book", es: "un libro" },
      },
      {
        es: "una",
        pos: "indefinite article",
        gender: "f",
        number: "sg",
        gloss: "a / an (feminine)",
        example: { en: "a house", es: "una casa" },
      },
    ],
  },
  {
    en: "hello",
    aliases: ["hi"],
    senses: [
      {
        es: "hola",
        pronunciation: "OH-lah",
        pos: "interjection",
        gloss: "hello / hi",
        example: { en: "Hello!", es: "¡Hola!" },
      },
    ],
  },
  {
    en: "goodbye",
    aliases: ["bye"],
    senses: [
      {
        es: "adiós",
        pronunciation: "ah-DYOHS",
        pos: "interjection",
        gloss: "goodbye",
        example: { en: "Goodbye!", es: "¡Adiós!" },
      },
      {
        es: "hasta luego",
        pronunciation: "AHS-tah LWEH-go",
        pos: "phrase",
        gloss: "see you later",
        example: { en: "See you later", es: "Hasta luego" },
      },
    ],
  },
  {
    en: "yes",
    senses: [
      {
        es: "sí",
        pronunciation: "see",
        pos: "adverb",
        gloss: "yes",
        note: "Accent mark: sí (not si = if).",
      },
    ],
  },
  {
    en: "no",
    senses: [
      {
        es: "no",
        pronunciation: "noh",
        pos: "adverb",
        gloss: "no / not",
        example: { en: "No, thank you", es: "No, gracias" },
      },
    ],
  },
  {
    en: "please",
    senses: [
      {
        es: "por favor",
        pronunciation: "por fah-VOR",
        pos: "phrase",
        gloss: "please",
        example: { en: "Water, please", es: "Agua, por favor" },
      },
    ],
  },
  {
    en: "thank you",
    aliases: ["thanks"],
    senses: [
      {
        es: "gracias",
        pronunciation: "GRAH-syahs",
        pos: "interjection",
        gloss: "thank you / thanks",
        example: { en: "Thank you!", es: "¡Gracias!" },
      },
    ],
  },
  {
    en: "water",
    senses: [
      {
        es: "agua",
        pronunciation: "AH-gwah",
        pos: "noun",
        gender: "f",
        number: "sg",
        gloss: "water",
        example: { en: "the water", es: "el agua" },
        note: "Feminine noun, but uses el/un before stressed á- sound: el agua fría.",
      },
    ],
  },
  {
    en: "book",
    senses: [
      {
        es: "libro",
        pronunciation: "LEE-bro",
        pos: "noun",
        gender: "m",
        number: "sg",
        gloss: "book",
        example: { en: "the book", es: "el libro" },
      },
    ],
  },
];

function normalizeQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Build lookup map: normalized English key → entry */
function buildIndex(entries: SpanishDictEntry[]): Map<string, SpanishDictEntry> {
  const map = new Map<string, SpanishDictEntry>();
  for (const entry of entries) {
    map.set(normalizeQuery(entry.en), entry);
    for (const alias of entry.aliases ?? []) {
      map.set(normalizeQuery(alias), entry);
    }
  }
  return map;
}

const INDEX = buildIndex(SPANISH_DICT);

/** Exact English → Spanish entry lookup (case/diacritic insensitive). */
export function lookupSpanish(query: string): SpanishDictEntry | null {
  const key = normalizeQuery(query);
  if (!key) return null;
  return INDEX.get(key) ?? null;
}

/** Prefix / substring search over English lemmas and aliases. */
export function searchSpanish(query: string, limit = 20): SpanishDictEntry[] {
  const key = normalizeQuery(query);
  if (!key) return SPANISH_DICT.slice(0, limit);

  const exact = lookupSpanish(key);
  if (exact) return [exact];

  const scored: { entry: SpanishDictEntry; score: number }[] = [];
  const seen = new Set<string>();

  for (const entry of SPANISH_DICT) {
    if (seen.has(entry.en)) continue;
    const keys = [entry.en, ...(entry.aliases ?? [])].map(normalizeQuery);
    let score = 0;
    for (const k of keys) {
      if (k.startsWith(key)) score = Math.max(score, 2);
      else if (k.includes(key)) score = Math.max(score, 1);
    }
    // Also match Spanish headwords
    for (const sense of entry.senses) {
      const es = normalizeQuery(sense.es);
      if (es.startsWith(key) || es.includes(key)) score = Math.max(score, 1);
    }
    if (score > 0) {
      seen.add(entry.en);
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.entry.en.localeCompare(b.entry.en));
  return scored.slice(0, limit).map((s) => s.entry);
}

/** All English headwords currently in the dictionary. */
export function listSpanishLemmas(): string[] {
  return SPANISH_DICT.map((e) => e.en);
}
