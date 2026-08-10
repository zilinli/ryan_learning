/**
 * Prompt + response parsing for LLM sentence / photo translation.
 */

import type {
  DictLang,
  SentenceTranslateResponse,
  TranslateLang,
} from "./dict-types";
import { DICT_LANG_LABELS } from "./dict-types";

const LANG_NAME: Record<DictLang, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  zh: "Simplified Chinese (Mandarin)",
  yue: "Cantonese (written Traditional Chinese preferred)",
  teo: "Hokkien (闽南话) — written in Chinese characters with Hokkien grammar and vocabulary",
  hak: "Hakka (客家话) — written in Chinese characters with Hakka grammar and vocabulary",
  ms: "Malay (Bahasa Melayu) — natural Malay language for tutoring and conversation",
  sha: "Shanghainese (上海话) — Wu dialect, written in Chinese characters with Shanghainese vocabulary and grammar",
};

export function buildSentenceTranslatePrompt(params: {
  text: string;
  from: TranslateLang;
  to: DictLang;
  hasImages: boolean;
}): string {
  const { text, from, to, hasImages } = params;
  const target = LANG_NAME[to];
  const sourceHint =
    from === "auto"
      ? "Detect the source language automatically."
      : `Source language is ${LANG_NAME[from]} (${DICT_LANG_LABELS[from]}).`;

  const imageHint = hasImages
    ? [
        "",
        "Images are attached. Read ALL visible text in the photo(s) carefully",
        "(handwriting, worksheets, signs, screenshots). Prefer the photo text",
        "when it differs from the typed text. If both exist, merge sensibly.",
      ].join("\n")
    : "";

  return [
    "You are a careful multilingual translator for a school student (age ~10).",
    "Translate faithfully. Keep names, numbers, and proper nouns accurate.",
    "Do not tutor, quiz, or add moral advice. Translation only.",
    "",
    sourceHint,
    `Translate into ${target}.`,
    imageHint,
    "",
    "Return ONLY a single JSON object (no markdown fences, no extra prose):",
    "{",
    '  "detectedSourceLang": "en|es|fr|zh|yue|other",',
    '  "sourceText": "exact text you translated (from input and/or OCR)",',
    '  "translation": "the translation in the target language",',
    '  "notes": "optional one short learner tip (max 1 sentence), or empty string"',
    "}",
    "",
    text.trim()
      ? `[Typed text]\n${text.trim()}`
      : "[Typed text]\n(none — use the attached photo(s))",
  ].join("\n");
}

/** Extract the first JSON object from model output. */
export function parseSentenceTranslateJson(
  raw: string,
  from: TranslateLang,
  to: DictLang,
): SentenceTranslateResponse | null {
  const text = (raw || "").trim();
  if (!text) return null;

  const candidates: string[] = [text];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const brace = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (brace >= 0 && last > brace) {
    candidates.unshift(text.slice(brace, last + 1));
  }

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as Record<string, unknown>;
      const translation = String(obj.translation ?? "").trim();
      const sourceText = String(obj.sourceText ?? obj.source ?? "").trim();
      if (!translation) continue;
      const notes = String(obj.notes ?? "").trim();
      return {
        detectedSourceLang: String(obj.detectedSourceLang ?? "").trim() || undefined,
        sourceText: sourceText || "(from photo)",
        translation,
        notes: notes || undefined,
        from,
        to,
      };
    } catch {
      // try next candidate
    }
  }

  // Fallback: treat whole reply as translation if JSON failed
  if (text.length > 0 && text.length < 4000 && !text.includes("{")) {
    return {
      sourceText: "",
      translation: text,
      from,
      to,
    };
  }
  return null;
}
