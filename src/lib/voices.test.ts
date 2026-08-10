import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  ALLOWED_EDGE_VOICES,
  DEFAULT_VOICE_ID,
  detectSpeechLang,
  getTutorVoice,
  loadVoiceId,
  normalizeVoiceId,
  replyLangFromVoice,
  replyLanguageInstructions,
  resolveEdgeVoice,
  resolveReplyLanguage,
  saveVoiceId,
  TUTOR_VOICES,
} from "./voices";
import { nsKey } from "./tenant-storage";

describe("normalizeVoiceId", () => {
  it("defaults empty/unknown to auto", () => {
    expect(normalizeVoiceId(null)).toBe(DEFAULT_VOICE_ID);
    expect(normalizeVoiceId(undefined)).toBe("auto");
    expect(normalizeVoiceId("nope")).toBe("auto");
  });

  it("maps legacy female ids to male counterparts", () => {
    expect(normalizeVoiceId("xiaoxiao")).toBe("yunxi");
    expect(normalizeVoiceId("hiuMaan")).toBe("wanLung");
    expect(normalizeVoiceId("elvira")).toBe("alvaro");
    expect(normalizeVoiceId("dalia")).toBe("jorge");
    expect(normalizeVoiceId("yasmin")).toBe("osman");
  });

  it("accepts every current picker id", () => {
    for (const v of TUTOR_VOICES) {
      expect(normalizeVoiceId(v.id)).toBe(v.id);
    }
  });
});

describe("getTutorVoice / resolveEdgeVoice", () => {
  it("returns matching voice metadata", () => {
    expect(getTutorVoice("yunxi").edgeVoice).toBe("zh-CN-YunxiNeural");
    expect(getTutorVoice("wanLung").lang).toBe("yue");
    expect(getTutorVoice("auto").label).toMatch(/粤语优先/);
  });

  it("auto picks Cantonese TTS for Chinese by default", () => {
    expect(resolveEdgeVoice("auto", "你好，请看这一题")).toBe(
      "zh-HK-WanLungNeural",
    );
    expect(resolveEdgeVoice("auto", "你睇吓呢一句，你觉得系咩意思？")).toBe(
      "zh-HK-WanLungNeural",
    );
    expect(resolveEdgeVoice("auto", "Hola, ¿cómo estás?")).toBe(
      "es-ES-AlvaroNeural",
    );
    expect(resolveEdgeVoice("auto", "Let's look at this sentence.")).toBe(
      "en-GB-RyanNeural",
    );
  });

  it("maps dialect voices to teo/hak langs without Cantonese TTS fallback", () => {
    expect(getTutorVoice("teochew").lang).toBe("teo");
    expect(getTutorVoice("hakka").lang).toBe("hak");
    expect(getTutorVoice("teochew").label).toMatch(/闽南话/);
    expect(getTutorVoice("hakka").label).toMatch(/客家话/);
    expect(getTutorVoice("teochew").label).not.toMatch(/百炼|TTS|FormoSpeech/i);
    expect(getTutorVoice("hakka").label).not.toMatch(/FormoSpeech|TTS/i);
    expect(getTutorVoice("shanghainese").label).toMatch(/上海话/);
    expect(getTutorVoice("shanghainese").label).not.toMatch(/Cantonese|Edge|TTS/i);
    // edgeVoice 字段仅为兼容；方言朗读走 /api/tts?lang=，禁止粤语顶替
    expect(getTutorVoice("teochew").edgeVoice).not.toMatch(/^zh-HK/);
    expect(getTutorVoice("hakka").edgeVoice).not.toMatch(/^zh-HK/);
    expect(resolveEdgeVoice("teochew", "汝好，睇下这道题")).not.toMatch(
      /^zh-HK/,
    );
    expect(resolveEdgeVoice("hakka", "你好，看下这只题")).not.toMatch(/^zh-HK/);
  });

  it("keeps fixed non-English voices even for English text", () => {
    expect(resolveEdgeVoice("yunxi", "Hello")).toBe("zh-CN-YunxiNeural");
    expect(resolveEdgeVoice("jorge", "Hello")).toBe("es-MX-JorgeNeural");
    expect(resolveEdgeVoice("henri", "Hello")).toBe("fr-FR-HenriNeural");
  });

  it("switches English fixed voice when chunk is Chinese/Spanish/French", () => {
    expect(resolveEdgeVoice("ava", "请用中文解释")).toBe(
      "zh-HK-WanLungNeural",
    );
    expect(resolveEdgeVoice("ava", "你睇吓呢题点解？")).toBe(
      "zh-HK-WanLungNeural",
    );
    expect(resolveEdgeVoice("ryan", "¿Qué significa esto?")).toBe(
      "es-ES-AlvaroNeural",
    );
    expect(resolveEdgeVoice("ryan", "Bonjour, comment ça va ?")).toBe(
      "fr-FR-HenriNeural",
    );
  });

  it("only allows known edge voices in the allow-list", () => {
    for (const v of TUTOR_VOICES) {
      if (v.id === "auto") continue;
      expect(ALLOWED_EDGE_VOICES).toContain(v.edgeVoice);
    }
  });
});

describe("detectSpeechLang", () => {
  it("defaults Chinese (including 普通话 wording) to Cantonese", () => {
    expect(detectSpeechLang("这一题怎么解？")).toBe("yue");
    expect(detectSpeechLang("请看第一段：河水结冰了。")).toBe("yue");
  });

  it("detects Cantonese via particles and lexicon", () => {
    expect(detectSpeechLang("你睇吓呢一句，你觉得系咩意思？")).toBe("yue");
    expect(detectSpeechLang("唔好成段用英文教，用粤语同我倾偈啦。")).toBe(
      "yue",
    );
    expect(detectSpeechLang("呢题点解？")).toBe("yue");
  });

  it("detects Spanish via marks and common words", () => {
    expect(detectSpeechLang("¡Hola! ¿Qué tal?")).toBe("es");
    expect(detectSpeechLang("Muchas gracias por la ayuda")).toBe("es");
  });

  it("detects French via accents and common words", () => {
    expect(detectSpeechLang("Bonjour, comment ça va ?")).toBe("fr");
    expect(detectSpeechLang("Merci beaucoup pour l'aide")).toBe("fr");
  });

  it("defaults to English", () => {
    expect(detectSpeechLang("Find the evidence in paragraph two.")).toBe("en");
  });
});

describe("replyLangFromVoice / resolveReplyLanguage", () => {
  it("maps voices to reply language modes", () => {
    expect(replyLangFromVoice("auto")).toBe("auto");
    expect(replyLangFromVoice("ava")).toBe("en");
    expect(replyLangFromVoice("yunxi")).toBe("zh");
    expect(replyLangFromVoice("wanLung")).toBe("yue");
    expect(replyLangFromVoice("alvaro")).toBe("es");
    expect(replyLangFromVoice("henri")).toBe("fr");
    expect(replyLangFromVoice("teochew")).toBe("teo");
    expect(replyLangFromVoice("hakka")).toBe("hak");
    expect(replyLangFromVoice("xiaoxiao")).toBe("zh");
  });

  it("locks Auto Chinese turns to 粤语 by default", () => {
    expect(resolveReplyLanguage("auto", "这一题怎么解？")).toBe("yue");
    expect(resolveReplyLanguage("auto", "你睇吓呢题点解？")).toBe("yue");
    expect(resolveReplyLanguage("auto", "这一题怎么解？", "zh")).toBe("zh");
    expect(resolveReplyLanguage("auto", "What is 7 times 8?")).toBe("auto");
    expect(
      resolveReplyLanguage("auto", "Translate it into Chinese words."),
    ).toBe("yue");
    expect(resolveReplyLanguage("yunxi", "hello")).toBe("zh");
  });

  it("emits Cantonese-default Auto instructions", () => {
    const zh = replyLanguageInstructions("zh").join("\n");
    expect(zh).toMatch(/普通话/);
    expect(zh).toMatch(/REQUIRED/);

    const yue = replyLanguageInstructions("yue").join("\n");
    expect(yue).toMatch(/粤语/);

    const auto = replyLanguageInstructions("auto").join("\n");
    expect(auto).toMatch(/粤语|广东话/);
    expect(auto).toMatch(/defaults to 粤语|默认/);
  });

  it("locks dialect voices and emits dialect instruction blocks", () => {
    expect(resolveReplyLanguage("teochew", "这一题怎么解？")).toBe("teo");
    expect(resolveReplyLanguage("hakka", "这一题怎么解？")).toBe("hak");

    const teo = replyLanguageInstructions("teo").join("\n");
    expect(teo).toMatch(/闽南话/);
    expect(teo).toMatch(/REQUIRED/);
    expect(teo).toMatch(/「个」/);
    expect(teo).toMatch(/「毋」/);
    expect(teo).toMatch(/食/);

    const hak = replyLanguageInstructions("hak").join("\n");
    expect(hak).toMatch(/客家话/);
    expect(hak).toMatch(/REQUIRED/);
    expect(hak).toMatch(/涯/);
    expect(hak).toMatch(/仰般|样般/);
    expect(hak).toMatch(/讲分|講分/);
  });

  it("maps Malay Osman voice and returns edge TTS provider", () => {
    expect(getTutorVoice("osman").lang).toBe("ms");
    expect(getTutorVoice("osman").label).toMatch(/Bahasa Melayu/);
    expect(getTutorVoice("osman").edgeVoice).toBe("ms-MY-OsmanNeural");
    expect(normalizeVoiceId("yasmin")).toBe("osman");
    expect(replyLangFromVoice("osman")).toBe("ms");
    expect(replyLangFromVoice("yasmin")).toBe("ms");
    expect(resolveReplyLanguage("osman", "hello")).toBe("ms");
    expect(TUTOR_VOICES.filter((v) => v.lang === "ms")).toHaveLength(1);
    expect(ALLOWED_EDGE_VOICES).not.toContain("ms-MY-YasminNeural");
  });

  it("emits Malay instruction block", () => {
    const ms = replyLanguageInstructions("ms").join("\n");
    expect(ms).toMatch(/Bahasa Melayu/);
    expect(ms).toMatch(/REQUIRED/);
    expect(ms).toMatch(/Malaysia|Melayu/);
  });
});

describe("per-account voice prefs (LVS)", () => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  beforeEach(() => {
    store.clear();
    (globalThis as Record<string, unknown>).localStorage = ls;
    (globalThis as Record<string, unknown>).window = { localStorage: ls };
  });

  afterEach(() => {
    store.clear();
  });

  it("saveVoiceId for acct_ching does not change acct_ryan", () => {
    saveVoiceId("teochew", "acct_ching");
    saveVoiceId("wanLung", "acct_ryan");
    expect(loadVoiceId("acct_ching")).toBe("teochew");
    expect(loadVoiceId("acct_ryan")).toBe("wanLung");
    expect(localStorage.getItem(nsKey("acct_ching", "ttsVoice"))).toBe(
      "teochew",
    );
  });
});
