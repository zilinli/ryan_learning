export type TutorVoiceId =
  | "auto"
  | "ava"
  | "ryan"
  | "yunxi"
  | "wanLung"
  | "alvaro"
  | "jorge";

export type SpeechLang = "en" | "zh" | "yue" | "es";

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
    label: "Auto · 自动（中文默认粤语）",
    edgeVoice: "zh-HK-WanLungNeural",
    preview:
      "Hi — 你好，我用广东话同你学 — Hola. Chinese defaults to Cantonese; pick 云希 for 普通话.",
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
    lang: "yue",
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
 * Cantonese written markers (particles / lexicon) that Mandarin rarely uses.
 * Includes both 繁体 and common 简体 informal spellings from tutor replies.
 */
const YUE_CHAR_RE =
  /[嘅係唔喺咗喇咩啲冇佢嚟嘢噃㗎喎囉噉咁哋畀諗睇嗰啱嗱嘞唓]/g;
const YUE_WORD_RE =
  /點解|点解|點樣|点样|邊度|边度|幾時|几时|係咪|系咪|係唔係|系唔系|唔係|唔系|唔好|唔知|唔使|咁樣|咁样|返嚟|出嚟|鍾意|钟意|傾偈|倾偈|嗰個|嗰个|呢度|嗰度|做咩|乜嘢|邊個|边个|幾多|几多|吓啦|喺度|睇吓|講吓|讲吓|你哋|我哋|佢哋|咗喇|嘅啦|先至|仲有|嚟喇|係咩|系咩/g;

/** Exported for unit tests */
export function countYueSignals(text: string): number {
  const chars = text.match(YUE_CHAR_RE)?.length ?? 0;
  const words = text.match(YUE_WORD_RE)?.length ?? 0;
  return chars + words * 2;
}

/**
 * Detect dominant language of a TTS / Auto-reply chunk.
 * Chinese → Cantonese (粤语) by default; Mandarin only via the 云希 voice.
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

  const isChinese =
    (han >= 1 && han * 2 >= Math.max(letters, 1)) || han >= 4;
  if (isChinese) {
    // Family default: all Chinese speech uses Cantonese TTS (云希 locks Mandarin).
    return "yue";
  }
  if (spanishMarks >= 1 || strongEs) return "es";
  if (
    /[áéíóúüÁÉÍÓÚÜ]/.test(t) &&
    /\b(el|la|los|las|de|que|en|un|una|es|por|para|con|del|al)\b/i.test(t)
  ) {
    return "es";
  }
  return "en";
}

function edgeVoiceForLang(lang: SpeechLang): string {
  if (lang === "yue") return "zh-HK-WanLungNeural";
  if (lang === "zh") return "zh-CN-YunxiNeural";
  if (lang === "es") return "es-ES-AlvaroNeural";
  return "en-US-AvaNeural";
}

/** Map preference + chunk text → edge-tts ShortName */
export function resolveEdgeVoice(
  voiceId: TutorVoiceId | string | null | undefined,
  text: string,
): string {
  const id = normalizeVoiceId(voiceId);

  if (id === "auto") {
    return edgeVoiceForLang(detectSpeechLang(text));
  }

  // Fixed voice — but if English voice + Chinese/Spanish text, switch so TTS isn't garbled
  const fixed = getTutorVoice(id);
  if (fixed.lang === "en") {
    const lang = detectSpeechLang(text);
    if (lang !== "en") return edgeVoiceForLang(lang);
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

/**
 * Resolve reply language for this turn.
 * Fixed voices lock language; Auto inspects the student message (粤语 vs English…).
 */
export function resolveReplyLanguage(
  voiceId: TutorVoiceId | string | null | undefined,
  userText?: string,
  preferredChinese: "zh" | "yue" = "yue",
): ReplyLangMode {
  const locked = replyLangFromVoice(voiceId);
  if (locked !== "auto") return locked;
  const text = (userText || "").trim();
  if (!text) return "auto";
  // Explicit ask for Chinese → prefer family dialect (粤语 by default)
  if (
    preferredChinese === "yue" &&
    /(?:\bchinese\b|中文|粤语|粵語|广东话|廣東話|粤语|翻譯成中文|翻译成中文)/i.test(
      text,
    )
  ) {
    return "yue";
  }
  if (
    preferredChinese === "zh" &&
    /(?:\bmandarin\b|普通话|国语|國語)/i.test(text)
  ) {
    return "zh";
  }
  const detected = detectSpeechLang(text);
  if (detected === "yue") return preferredChinese === "zh" ? "zh" : "yue";
  if (detected === "zh") return preferredChinese === "yue" ? "yue" : "zh";
  if (detected === "es") return "es";
  if (detected === "en") {
    // Pure English → stay Auto so agent can still match if later turns switch
    return "auto";
  }
  return "auto";
}

/** Strong system instructions so the tutor stays in the selected language. */
export function replyLanguageInstructions(mode: ReplyLangMode): string[] {
  if (mode === "auto") {
    return [
      "",
      "[Reply language — Auto — Chinese defaults to 粤语 / 广东话]",
      "- Match the student's language (English / 粤语 / 普通话 / Español).",
      "- When producing Chinese (including translations), write in 【粤语 / 广东话】by default (口语自然，可用粤语书面语).",
      "- Use 【简体中文普通话】only if the student clearly asks for 普通话/国语/Mandarin.",
      "- If the message mixes languages, follow the student's main language.",
      "- Homework photos may be in English even if the student chats in Chinese — still reply in the student's chat language, and quote the photo text exactly as written.",
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
