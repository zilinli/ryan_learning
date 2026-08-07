import { normalizeVoiceId, type TutorVoiceId } from "./voices";
import type { DictLang } from "./dict-types";

/** Languages the STT backend understands */
export type SttLang = "auto" | "en" | "zh" | "yue" | "es" | "fr";

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
    case "auto":
    default:
      return "auto";
  }
}

/** Map dictionary language pill → STT hint (same codes as /api/transcribe). */
export function sttLangFromDictLang(lang: DictLang | string | null): SttLang {
  switch (lang) {
    case "en":
    case "es":
    case "fr":
    case "zh":
    case "yue":
      return lang;
    default:
      return "auto";
  }
}
