export type TutorVoiceId = "ava" | "ryan";

export type TutorVoice = {
  id: TutorVoiceId;
  label: string;
  edgeVoice: string;
  preview: string;
};

export const TUTOR_VOICES: TutorVoice[] = [
  {
    id: "ava",
    label: "Ava · US ♀",
    edgeVoice: "en-US-AvaNeural",
    preview: "Hi, I'm Spark. I'll read replies in this voice.",
  },
  {
    id: "ryan",
    label: "Ryan · UK ♂",
    edgeVoice: "en-GB-RyanNeural",
    preview: "Hi, I'm Spark. I'll read replies in this British voice.",
  },
];

export const DEFAULT_VOICE_ID: TutorVoiceId = "ava";

export function getTutorVoice(id: string | null | undefined): TutorVoice {
  return TUTOR_VOICES.find((v) => v.id === id) ?? TUTOR_VOICES[0]!;
}

export function loadVoiceId(): TutorVoiceId {
  if (typeof window === "undefined") return DEFAULT_VOICE_ID;
  try {
    const saved = window.localStorage.getItem("spark.ttsVoice");
    if (saved === "ava" || saved === "ryan") return saved;
  } catch {
    // ignore
  }
  return DEFAULT_VOICE_ID;
}

export function saveVoiceId(id: TutorVoiceId) {
  try {
    window.localStorage.setItem("spark.ttsVoice", id);
  } catch {
    // ignore
  }
}

const SPEAK_ENABLED_KEY = "spark.speakEnabled";

/** Default ON — replies should be read aloud unless the student turns it off. */
export function loadSpeakEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem(SPEAK_ENABLED_KEY);
    if (saved === "0" || saved === "false") return false;
    if (saved === "1" || saved === "true") return true;
  } catch {
    // ignore
  }
  return true;
}

export function saveSpeakEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(SPEAK_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}
