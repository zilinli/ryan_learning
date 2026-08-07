/** Shared types for the multilingual dictionary system. */

export type DictLang = "en" | "es" | "fr" | "zh" | "yue";

export const DICT_LANG_LABELS: Record<DictLang, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  zh: "中文",
  yue: "粵語",
};

/** A single sense/translation within an entry. */
export type DictSense = {
  /** Definition text */
  definition: string;
  /** Example sentence (optional) */
  example?: string;
  /** Translation of the example (optional) */
  exampleTranslation?: string;
  /** For bilingual lookups — translations to other languages */
  translations?: { lang: DictLang; text: string }[];
};

/** A single dictionary entry (one part-of-speech grouping). */
export type DictEntry = {
  /** Canonical headword */
  headword: string;
  /** IPA pronunciation or phonetic */
  pronunciation?: string;
  /** URL to audio pronunciation file */
  audioUrl?: string;
  /** Part of speech */
  partOfSpeech: string;
  /** Definitions / senses */
  senses: DictSense[];
  /** Inflected forms */
  inflections?: { label: string; form: string }[];
  /** Data source label */
  source: "merriam-webster" | "freedict" | "cantonese-local" | "translate";
};

/** Top-level response from /api/dict */
export type DictResponse = {
  word: string;
  lang: DictLang;
  entries: DictEntry[];
  /** Original query when we auto-corrected a typo */
  correctedFrom?: string;
  /** Spelling suggestions when exact match fails (or alongside a correction) */
  suggestions?: string[];
  /**
   * Cross-language headword translations:
   * - lang=en → ES / FR / ZH / 粵
   * - other langs → English
   */
  crossTranslations?: { lang: DictLang; text: string }[];
};

/** Client-side recent search */
export type RecentSearch = {
  word: string;
  lang: DictLang;
  ts: number;
};

/** Page mode on /dict */
export type DictPageMode = "word" | "sentence";

/** Target/source for sentence translation (auto = detect). */
export type TranslateLang = DictLang | "auto";

export const TRANSLATE_LANG_LABELS: Record<TranslateLang, string> = {
  auto: "Auto-detect",
  ...DICT_LANG_LABELS,
};

/** Photo / image attached to a sentence translation request. */
export type TranslateImagePayload = {
  name: string;
  mimeType: string;
  /** Raw base64 (no data: prefix) */
  data: string;
  /** Optional preview data URL for the UI */
  dataUrl?: string;
};

/** POST /api/dict/translate body */
export type SentenceTranslateRequest = {
  text?: string;
  from: TranslateLang;
  to: DictLang;
  images?: TranslateImagePayload[];
};

/** Structured LLM translation result */
export type SentenceTranslateResponse = {
  detectedSourceLang?: string;
  sourceText: string;
  translation: string;
  notes?: string;
  from: TranslateLang;
  to: DictLang;
};
