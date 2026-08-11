import type { TutorVoiceId } from "./voices";
import { TUTOR_VOICES } from "./voices";

/**
 * AUDIT8.8 — voice picker groups (no language removal).
 * Core = preload-friendly defaults; More = first-use expand.
 */

export const CORE_VOICE_IDS: TutorVoiceId[] = [
  "auto",
  "wanLung",
  "ryan",
  "yunxi",
];

const CORE_SET = new Set<string>(CORE_VOICE_IDS);

export function moreVoiceIds(): TutorVoiceId[] {
  return TUTOR_VOICES.map((v) => v.id).filter((id) => !CORE_SET.has(id));
}

export function isCoreVoiceId(id: TutorVoiceId | string): boolean {
  return CORE_SET.has(id);
}
