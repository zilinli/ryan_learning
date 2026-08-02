import { normalizeVoiceId, type TutorVoiceId } from "./voices";

/** Languages the STT backend understands */
export type SttLang = "auto" | "en" | "zh" | "yue" | "es";

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
    case "auto":
    default:
      return "auto";
  }
}
