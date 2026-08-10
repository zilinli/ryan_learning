import { normalizeVoiceId, type TutorVoiceId } from "./voices";
import type { DictLang } from "./dict-types";

/** Languages the STT backend understands */
export type SttLang = "auto" | "en" | "zh" | "yue" | "es" | "fr" | "ms" | "teo" | "hak" | "sha";

/**
 * Dictionary / Translation language → tutor voice id for TTS.
 * teo/hak use the same providers as the main tutor (Bailian / FormoSpeech).
 */
export function voiceIdFromDictLang(lang: DictLang | string | null): TutorVoiceId {
  switch (lang) {
    case "en":
      return "ryan";
    case "zh":
      return "yunxi";
    case "yue":
      return "wanLung";
    case "es":
      return "alvaro";
    case "fr":
      return "henri";
    case "ms":
      return "osman";
    case "teo":
      return "teochew";
    case "hak":
      return "hakka";
    case "sha":
      return "shanghainese";
    default:
      return "auto";
  }
}

/** Map tutor voice preference → recognition language hint */
export function sttLangFromVoice(voiceId: TutorVoiceId | string | null): SttLang {
  switch (normalizeVoiceId(voiceId)) {
    case "ava":
    case "ryan":
      return "en";
    case "yunxi":
      return "zh";
    case "wanLung":
      return "yue";
    case "alvaro":
    case "jorge":
      return "es";
    case "henri":
      return "fr";
    case "osman":
      return "ms";
    case "teochew":
      // Dedicated dialect STT path — Whisper with Teochew function-word
      // initial_prompt biases the decoder toward dialect characters.
      return "teo";
    case "hakka":
      return "hak";
    case "shanghainese":
      return "sha";
    case "auto":
    default:
      return "auto";
  }
}

/**
 * Dictionary language pill → STT hint (same codes as /api/transcribe).
 * teo/hak → Bailian Fun-ASR primary (identical to main tutor).
 */
export function sttLangFromDictLang(lang: DictLang | string | null): SttLang {
  switch (lang) {
    case "en":
    case "es":
    case "fr":
    case "zh":
    case "yue":
      return lang;
    case "teo":
      return "teo";
    case "hak":
      return "hak";
    case "sha":
      return "sha";
    case "ms":
      return "ms";
    default:
      return "auto";
  }
}
