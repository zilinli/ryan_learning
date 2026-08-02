export type TutorVoiceId =
  | "auto"
  | "ava"
  | "ryan"
  | "yunxi"
  | "wanLung"
  | "alvaro"
  | "jorge";

export type SpeechLang = "en" | "zh" | "es";

export type TutorVoice = {
  id: TutorVoiceId;
  label: string;
  /** Fixed edge-tts voice; unused when id === "auto" */
  edgeVoice: string;
  preview: string;
  lang: SpeechLang | "auto";
};

/** Older picker ids → current male-voice ids (localStorage / open tabs). */
const LEGACY_VOICE_IDS: Record<string, TutorVoiceId> = {
  xiaoxiao: "yunxi",
  hiuMaan: "wanLung",
  elvira: "alvaro",
  dalia: "jorge",
};

export const DEFAULT_VOICE_ID: TutorVoiceId = "auto";

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
    id: "yunxi",
    label: "云希 · 普通话 ♂",
    edgeVoice: "zh-CN-YunxiNeural",
    preview: "你好，我是 Spark。我会用普通话朗读回复。",
    lang: "zh",
  },
  {
    id: "wanLung",
    label: "雲龍 · 粤语 ♂",
    edgeVoice: "zh-HK-WanLungNeural",
    preview: "你好，我係 Spark。我會用廣東話讀出回覆。",
    lang: "zh",
  },
  {
    id: "alvaro",
    label: "Álvaro · Español ♂",
    edgeVoice: "es-ES-AlvaroNeural",
    preview: "Hola, soy Spark. Leeré las respuestas en español de España.",
    lang: "es",
  },
  {
    id: "jorge",
    label: "Jorge · Español MX ♂",
    edgeVoice: "es-MX-JorgeNeural",
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
  "es-ES-AlvaroNeural",
  "es-MX-DaliaNeural",
  "es-MX-JorgeNeural",
  "es-US-PalomaNeural",
] as const;

const VOICE_IDS = new Set<string>(TUTOR_VOICES.map((v) => v.id));

export function normalizeVoiceId(
  id: string | null | undefined,
): TutorVoiceId {
  if (!id) return DEFAULT_VOICE_ID;
  if (LEGACY_VOICE_IDS[id]) return LEGACY_VOICE_IDS[id]!;
  if (VOICE_IDS.has(id)) return id as TutorVoiceId;
  return DEFAULT_VOICE_ID;
}

export function getTutorVoice(id: string | null | undefined): TutorVoice {
  const normalized = normalizeVoiceId(id);
  return TUTOR_VOICES.find((v) => v.id === normalized) ?? TUTOR_VOICES[0]!;
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
  const id = normalizeVoiceId(voiceId);

  if (id === "auto") {
    const lang = detectSpeechLang(text);
    if (lang === "zh") return "zh-CN-YunxiNeural";
    if (lang === "es") return "es-ES-AlvaroNeural";
    return "en-US-AvaNeural";
  }

  // Fixed voice — but if English voice + Chinese/Spanish text, switch so TTS isn't garbled
  const fixed = getTutorVoice(id);
  if (fixed.lang === "en") {
    const lang = detectSpeechLang(text);
    if (lang === "zh") return "zh-CN-YunxiNeural";
    if (lang === "es") return "es-ES-AlvaroNeural";
  }
  // Cantonese / Mandarin / Spanish fixed voices: always use them
  return fixed.edgeVoice;
}

export function loadVoiceId(): TutorVoiceId {
  if (typeof window === "undefined") return DEFAULT_VOICE_ID;
  try {
    const saved = window.localStorage.getItem("spark.ttsVoice");
    return normalizeVoiceId(saved);
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

/** Reply language locked by the voice picker (Auto = follow the student). */
export type ReplyLangMode = "auto" | "en" | "zh" | "yue" | "es";

export function replyLangFromVoice(
  voiceId: TutorVoiceId | string | null | undefined,
): ReplyLangMode {
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

/** Strong system instructions so the tutor stays in the selected language. */
export function replyLanguageInstructions(mode: ReplyLangMode): string[] {
  if (mode === "auto") {
    return [
      "",
      "[Reply language — Auto]",
      "- Match the student's language (English / 普通话 / 粤语 / Español).",
      "- If the message mixes languages, follow the student's main language.",
      "- Homework photos may be in English even if the student chats in Chinese/Spanish — still reply in the student's chat language, and quote the photo text exactly as written.",
    ];
  }
  if (mode === "en") {
    return [
      "",
      "[Reply language — English — REQUIRED]",
      "- Reply almost entirely in clear English.",
      "- Do NOT switch to Chinese or Spanish unless quoting the worksheet.",
      "- Quotes from photos/PDFs stay in the original language.",
    ];
  }
  if (mode === "zh") {
    return [
      "",
      "[Reply language — 普通话 — REQUIRED]",
      "- 请用自然、口语化的【简体中文普通话】回答，这是主要语言。",
      "- 不要用英语整段讲解；英语仅用于引用题目原文或专有名词。",
      "- 引用照片/PDF 时保持原文不改写。",
      "- 引导式提问也要用中文，例如：「你先看看这一句，说说你的理解？」",
      "- LaTeX 数学公式可保留；说明文字用中文。",
    ];
  }
  if (mode === "yue") {
    return [
      "",
      "[Reply language — 粤语 — REQUIRED]",
      "- 请用【粤语】同学生倾偈（可用粤语书面语 / 繁体，口语自然嘅粤语表达）。",
      "- 主要语言必须系粤语，唔好成段用英文教。",
      "- 英文只用于引用题目原文；引用要照抄。",
      "- 提问同提示都用粤语，例如：「你睇吓呢一句，你觉得系咩意思？」",
      "- 数学用 LaTeX；解释用粤语。",
    ];
  }
  // es
  return [
    "",
    "[Reply language — Español — REQUIRED]",
    "- Responde casi todo en español natural y claro (prioridad absoluta).",
    "- No expliques en inglés salvo al citar el texto original del ejercicio.",
    "- Las citas de fotos/PDF deben quedar en el idioma original.",
    "- Preguntas y pistas también en español, p. ej.: «Mira esta frase: ¿qué crees que significa?»",
    "- Las fórmulas pueden ir en LaTeX; las explicaciones en español.",
  ];
}
