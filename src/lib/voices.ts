export type TutorVoiceId =
  | "auto"
  | "ava"
  | "ryan"
  | "xiaoxiao"
  | "hiuMaan"
  | "elvira"
  | "dalia";

export type SpeechLang = "en" | "zh" | "es";

export type TutorVoice = {
  id: TutorVoiceId;
  label: string;
  /** Fixed edge-tts voice; unused when id === "auto" */
  edgeVoice: string;
  preview: string;
  lang: SpeechLang | "auto";
};

export const TUTOR_VOICES: TutorVoice[] = [
  {
    id: "auto",
    label: "Auto · 自动",
    edgeVoice: "en-US-AvaNeural",
    preview: "Hi — 你好 — Hola. I'll match the language of each reply.",
    lang: "auto",
  },
  {
    id: "ava",
    label: "Ava · English ♀",
    edgeVoice: "en-US-AvaNeural",
    preview: "Hi, I'm Spark. I'll read replies in this voice.",
    lang: "en",
  },
  {
    id: "ryan",
    label: "Ryan · English ♂",
    edgeVoice: "en-GB-RyanNeural",
    preview: "Hi, I'm Spark. I'll read replies in this British voice.",
    lang: "en",
  },
  {
    id: "xiaoxiao",
    label: "晓晓 · 普通话 ♀",
    edgeVoice: "zh-CN-XiaoxiaoNeural",
    preview: "你好，我是 Spark。我会用普通话朗读回复。",
    lang: "zh",
  },
  {
    id: "hiuMaan",
    label: "曉曼 · 粤语 ♀",
    edgeVoice: "zh-HK-HiuMaanNeural",
    preview: "你好，我係 Spark。我會用廣東話讀出回覆。",
    lang: "zh",
  },
  {
    id: "elvira",
    label: "Elvira · Español ♀",
    edgeVoice: "es-ES-ElviraNeural",
    preview: "Hola, soy Spark. Leeré las respuestas en español de España.",
    lang: "es",
  },
  {
    id: "dalia",
    label: "Dalia · Español MX ♀",
    edgeVoice: "es-MX-DaliaNeural",
    preview: "Hola, soy Spark. Leeré las respuestas en español de México.",
    lang: "es",
  },
];

/** All edge-tts ShortNames we allow through the API */
export const ALLOWED_EDGE_VOICES = [
  "en-US-AvaNeural",
  "en-GB-RyanNeural",
  "en-US-JennyNeural",
  "en-GB-ThomasNeural",
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-YunxiNeural",
  "zh-HK-HiuMaanNeural",
  "zh-HK-WanLungNeural",
  "es-ES-ElviraNeural",
  "es-MX-DaliaNeural",
  "es-US-PalomaNeural",
] as const;

export const DEFAULT_VOICE_ID: TutorVoiceId = "auto";

const VOICE_IDS = new Set<string>(TUTOR_VOICES.map((v) => v.id));

export function getTutorVoice(id: string | null | undefined): TutorVoice {
  return TUTOR_VOICES.find((v) => v.id === id) ?? TUTOR_VOICES[0]!;
}

/**
 * Detect dominant language of a TTS chunk.
 * Chinese characters win when common; Spanish via ñ/¿/¡ and common words.
 */
export function detectSpeechLang(text: string): SpeechLang {
  const t = text || "";
  const han = (t.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const letters = (t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  const spanishMarks = (t.match(/[ñÑ¿¡]/g) || []).length;
  const strongEs =
    /\b(hola|gracias|porque|también|niño|niña|señor|señora|usted|está|están|qué|cómo|cuándo|dónde|buenos|días|mucho|gusto|español|lectura|pregunta)\b/i.test(
      t,
    );

  if (han >= 1 && han * 2 >= Math.max(letters, 1)) return "zh";
  if (han >= 4) return "zh";
  if (spanishMarks >= 1 || strongEs) return "es";
  // Accented Spanish vowels without ñ (e.g. "está", "matemáticas")
  if (
    /[áéíóúüÁÉÍÓÚÜ]/.test(t) &&
    /\b(el|la|los|las|de|que|en|un|una|es|por|para|con|del|al)\b/i.test(t)
  ) {
    return "es";
  }
  return "en";
}

/** Map preference + chunk text → edge-tts ShortName */
export function resolveEdgeVoice(
  voiceId: TutorVoiceId | string | null | undefined,
  text: string,
): string {
  const id = (voiceId && VOICE_IDS.has(voiceId) ? voiceId : "auto") as TutorVoiceId;

  if (id === "auto") {
    const lang = detectSpeechLang(text);
    if (lang === "zh") return "zh-CN-XiaoxiaoNeural";
    if (lang === "es") return "es-ES-ElviraNeural";
    return "en-US-AvaNeural";
  }

  // Fixed voice — but if English voice + Chinese text, still switch so it isn't silent/garbled
  const fixed = getTutorVoice(id);
  if (fixed.lang === "en") {
    const lang = detectSpeechLang(text);
    if (lang === "zh") return "zh-CN-XiaoxiaoNeural";
    if (lang === "es") return "es-ES-ElviraNeural";
  }
  // Cantonese / Mandarin / Spanish fixed voices: always use them
  return fixed.edgeVoice;
}

export function loadVoiceId(): TutorVoiceId {
  if (typeof window === "undefined") return DEFAULT_VOICE_ID;
  try {
    const saved = window.localStorage.getItem("spark.ttsVoice");
    if (saved && VOICE_IDS.has(saved)) return saved as TutorVoiceId;
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
