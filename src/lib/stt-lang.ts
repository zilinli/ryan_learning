import type { TutorVoiceId } from "./voices";

/** Languages the STT backend understands */
export type SttLang = "auto" | "en" | "zh" | "yue" | "es";

/** Map tutor voice preference → recognition language hint */
export function sttLangFromVoice(voiceId: TutorVoiceId | string | null): SttLang {
  switch (voiceId) {
    case "ava":
    case "ryan":
      return "en";
    case "xiaoxiao":
      return "zh";
    case "hiuMaan":
      return "yue";
    case "elvira":
    case "dalia":
      return "es";
    case "auto":
    default:
      return "auto";
  }
}
