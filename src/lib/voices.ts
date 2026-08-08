export type TutorVoiceId =
  | "auto"
  | "ava"
  | "ryan"
  | "yunxi"
  | "wanLung"
  | "alvaro"
  | "jorge"
  | "henri"
  | "teochew"
  | "hakka";

import { FLAT_KEYS, nsKey, readFlatKey, RYAN_ACCOUNT } from "./tenant-storage";

export type SpeechLang = "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak";

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
    label: "Auto (粤语优先)",
    edgeVoice: "zh-HK-WanLungNeural",
    preview:
      "Hi — I'll match your language. Chinese defaults to Cantonese.",
    lang: "auto",
  },
  {
    id: "ryan",
    label: "Ryan (British English)",
    edgeVoice: "en-GB-RyanNeural",
    preview: "Hi, I'm Spark. I'll read replies in this British voice.",
    lang: "en",
  },
  {
    id: "ava",
    label: "Ava (American English)",
    edgeVoice: "en-US-AvaNeural",
    preview: "Hi, I'm Spark. I'll read replies in this American voice.",
    lang: "en",
  },
  {
    id: "yunxi",
    label: "Yunxi (Mandarin)",
    edgeVoice: "zh-CN-YunxiNeural",
    preview: "你好，我是 Spark。我会用普通话朗读回复。",
    lang: "zh",
  },
  {
    id: "wanLung",
    label: "WanLung (Cantonese)",
    edgeVoice: "zh-HK-WanLungNeural",
    preview: "你好，我係 Spark。我會用廣東話讀出回覆。",
    lang: "yue",
  },
  {
    id: "alvaro",
    label: "Álvaro (Spanish)",
    edgeVoice: "es-ES-AlvaroNeural",
    preview: "Hola, soy Spark. Leeré las respuestas en español de España.",
    lang: "es",
  },
  {
    id: "jorge",
    label: "Jorge (Spanish MX)",
    edgeVoice: "es-MX-JorgeNeural",
    preview: "Hola, soy Spark. Leeré las respuestas en español de México.",
    lang: "es",
  },
  {
    id: "henri",
    label: "Henri (French)",
    edgeVoice: "fr-FR-HenriNeural",
    preview: "Bonjour, je suis Spark. Je lirai les réponses en français.",
    lang: "fr",
  },
  {
    id: "teochew",
    label: "Teochew (潮汕话 STT + Cantonese TTS)",
    edgeVoice: "zh-HK-WanLungNeural",
    preview: "汝好，我係 Spark，我会用潮汕话同汝倾。",
    lang: "teo",
  },
  {
    id: "hakka",
    label: "Hakka (客家话 STT + Cantonese TTS)",
    edgeVoice: "zh-HK-WanLungNeural",
    preview: "你好，我係 Spark，我会用客家话同你倾。",
    lang: "hak",
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
  "fr-FR-HenriNeural",
  "fr-FR-DeniseNeural",
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
  const letters = (t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀÂÄÈÊËÏÎÔÙÛÜŸÇàâäèêëïîôùûüÿç]/g) || []).length;
  const spanishMarks = (t.match(/[ñÑ¿¡]/g) || []).length;
  const frenchMarks = (t.match(/[àâäèêëïîôùûüÿçÀÂÄÈÊËÏÎÔÙÛÜŸÇœŒæÆ]/g) || []).length;
  const strongEs =
    /\b(hola|gracias|porque|también|niño|niña|señor|señora|usted|está|están|qué|cómo|cuándo|dónde|buenos|días|mucho|gusto|español|lectura|pregunta)\b/i.test(
      t,
    );
  const strongFr =
    /\b(bonjour|bonsoir|merci|parce|aussi|français|francais|s'il|vous|nous|avec|pour|dans|cette|comment|pourquoi|aujourd'hui|élève|devoirs|lecture|question)\b/i.test(
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
  if (frenchMarks >= 1 || strongFr) return "fr";
  if (
    /[àâäèêëïîôùûüÿçÀÂÄÈÊËÏÎÔÙÛÜŸÇ]/.test(t) &&
    /\b(le|la|les|de|des|un|une|est|et|pour|dans|avec|que|qui|je|tu|il|elle|nous|vous)\b/i.test(
      t,
    )
  ) {
    return "fr";
  }
  return "en";
}

function edgeVoiceForLang(lang: SpeechLang): string {
  if (lang === "yue" || lang === "teo" || lang === "hak")
    return "zh-HK-WanLungNeural";
  if (lang === "zh") return "zh-CN-YunxiNeural";
  if (lang === "es") return "es-ES-AlvaroNeural";
  if (lang === "fr") return "fr-FR-HenriNeural";
  // English defaults to British (Ryan) — American (Ava) is the explicit choice.
  return "en-GB-RyanNeural";
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

  // Fixed voice — but if English voice + Chinese/Spanish/French text, switch so TTS isn't garbled
  const fixed = getTutorVoice(id);
  if (fixed.lang === "en") {
    const lang = detectSpeechLang(text);
    if (lang !== "en") return edgeVoiceForLang(lang);
  }
  // Cantonese / Mandarin / Spanish / French fixed voices: always use them
  return fixed.edgeVoice;
}

export function loadVoiceId(accountId: string = RYAN_ACCOUNT): TutorVoiceId {
  if (typeof window === "undefined") return DEFAULT_VOICE_ID;
  try {
    const nsKeyVal = nsKey(accountId, "ttsVoice");
    const saved = localStorage.getItem(nsKeyVal);
    if (saved) return normalizeVoiceId(saved);
    // Fallback: read flat key — ONLY for the default Ryan account
    if (accountId === RYAN_ACCOUNT) {
      const flat = readFlatKey(FLAT_KEYS.ttsVoice);
      if (flat) {
        try { localStorage.setItem(nsKeyVal, flat); } catch { /* ignore */ }
        return normalizeVoiceId(flat);
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_VOICE_ID;
}

export function saveVoiceId(id: TutorVoiceId, accountId: string = RYAN_ACCOUNT) {
  try {
    localStorage.setItem(nsKey(accountId, "ttsVoice"), id);
  } catch {
    // ignore
  }
}

const SPEAK_ENABLED_KEY = FLAT_KEYS.speakEnabled;

/** Default ON — replies should be read aloud unless the student turns it off. */
export function loadSpeakEnabled(accountId: string = RYAN_ACCOUNT): boolean {
  if (typeof window === "undefined") return true;
  try {
    const nsKeyVal = nsKey(accountId, "speakEnabled");
    const saved = localStorage.getItem(nsKeyVal);
    if (saved) return saved !== "0" && saved !== "false";
    // Fallback: flat key — ONLY for the default Ryan account
    if (accountId === RYAN_ACCOUNT) {
      const flat = readFlatKey(SPEAK_ENABLED_KEY);
      if (flat) {
        try { localStorage.setItem(nsKeyVal, flat); } catch { /* ignore */ }
        return flat !== "0" && flat !== "false";
      }
    }
  } catch {
    // ignore
  }
  return true;
}

export function saveSpeakEnabled(enabled: boolean, accountId: string = RYAN_ACCOUNT) {
  try {
    localStorage.setItem(nsKey(accountId, "speakEnabled"), enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

/** Reply language locked by the voice picker (Auto = follow the student). */
export type ReplyLangMode = "auto" | "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak";

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
    case "henri":
      return "fr";
    case "teochew":
      return "teo";
    case "hakka":
      return "hak";
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
  if (detected === "fr") return "fr";
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
      "- Match the student's language (English / 粤语 / 普通话 / Español / Français).",
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
  if (mode === "fr") {
    return [
      "",
      "[Reply language — Français — REQUIRED]",
      "- Réponds presque entièrement en français naturel et clair (priorité absolue).",
      "- N'explique pas en anglais sauf pour citer le texte original de l'exercice.",
      "- Les citations de photos/PDF doivent rester dans la langue d'origine.",
      "- Questions et indices aussi en français, p. ex. : « Regarde cette phrase : qu'est-ce que tu penses que ça veut dire ? »",
      "- Les formules peuvent rester en LaTeX ; les explications en français.",
    ];
  }
  if (mode === "teo") {
    return [
      "",
      "[Reply language — 潮汕话 — REQUIRED]",
      "- 请用【潮汕话（潮州话）】与学生交流。用汉字书写，融入潮汕话的口语词汇和语法，不要用普通话。",
      "- 必用词汇替换（务必遵守）：",
      "  - 「的」→「个」　例：「我的」→「我个」",
      "  - 「不」→「唔」　例：「不是」→「唔是」",
      "  - 「不要」→「勿」　例：「不要怕」→「勿惊」",
      "  - 「没有」→「无」　例：「没有错」→「无错」",
      "  - 「吃/喝」→「食」（食饭、食水）",
      "  - 「看」→「睇」　例：「看一下」→「睇下」",
      "  - 「怎么」→「怎呢」或「做呢」",
      "  - 「什么」→「乜个」",
      "  - 「告诉」→「甲…知」　例：「告诉我」→「甲我知」",
      "  - 「这/那」→「只/许」或保留「这/那」",
      "  - 「可以」→「会」或「做得」",
      "  - 「很」→「好」　例：「很好」→「好好」",
      "  - 「和/跟」→「佮」",
      "- 语气亲切，像家里的长辈教小孩子；句子要短，潮汕话是口头语言，长句显得不自然。",
      "- 数学公式保留 LaTeX；解释和提问必须用潮汕话书面形式。",
      "- 【禁止编造生僻字】遇到不确定的方言词汇，优先使用上面列出的高频词，或直接使用标准中文词汇；禁止编造生僻方言字或 CJK 扩展区字符（大多数设备字体不支持渲染）。",
      "- 开场示例：「汝好！来，睇下只道题，汝觉得应该怎呢做？」",
      "",
      "[潮汕话对话示例（few-shot，模仿这个感觉写，不要照抄内容）]",
      "学生：这一题我不会。",
      "老师：勿惊。汝先睇下只道题，题目甲汝讲乜个？",
      "学生：讲要算面积。",
      "老师：好。汝记得面积公式无？慢慢想，想出来甲我知。",
    ];
  }
  if (mode === "hak") {
    return [
      "",
      "[Reply language — 客家话 — REQUIRED]",
      "- 请用【客家话】与学生交流。用汉字书写，融入客家话的口语词汇和语法，不要用普通话。",
      "- 必用词汇替换（务必遵守）：",
      "  - 「我」→「涯」（网上最常用写法；不要用生僻字「𠊎」，字体不支持）",
      "  - 「的」→「个」　例：「我的」→「涯个」",
      "  - 「不」→「唔」或「毋」　例：「不是」→「唔係」",
      "  - 「没有」→「冇」　例：「没有错」→「冇错」",
      "  - 「不要」→「莫」或「毋好」　例：「不要怕」→「莫惊」",
      "  - 「吃/喝」→「食」（食饭、食水）",
      "  - 「看」→「看」（同普通话）或「䀴」",
      "  - 「怎么」→「仰般」或「样般」",
      "  - 「什么」→「麼个」",
      "  - 「告诉」→「讲分…知」　例：「告诉我」→「讲分涯知」",
      "  - 「这」→「呢」或保留「这」",
      "  - 「可以」→「做得」",
      "  - 「很」→「當」或「好」　例：「很好」→「當好」",
      "  - 「但是」→「但係」",
      "- 语气亲切稳重，像耐心的客家老师。注意客家话的自然语序（副词在动词前：「先行」而不是「行先」）。",
      "- 数学公式保留 LaTeX；解释和提问必须用客家话书面形式。",
      "- 【禁止编造生僻字】遇到不确定的方言词汇，优先使用上面列出的高频词，或直接使用标准中文词汇；禁止编造生僻方言字或 CJK 扩展区字符（如 𠊎、摎 等，大多数设备字体不支持渲染）。",
      "- 开场示例：「你好！来，看下呢只题，你讲分涯知你样般想？」",
      "",
      "[客家话对话示例（few-shot，模仿这个感觉写，不要照抄内容）]",
      "学生：这题涯毋会做。",
      "老师：莫惊。你先看下呢只题，题目讲分你知麼个？",
      "学生：讲爱算面积。",
      "老师：好。你记得面积公式无？慢慢想，想出来讲分涯知。",
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
