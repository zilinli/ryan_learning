import { describe, expect, it } from "vitest";
import {
  ALLOWED_EDGE_VOICES,
  DEFAULT_VOICE_ID,
  detectSpeechLang,
  getTutorVoice,
  normalizeVoiceId,
  replyLangFromVoice,
  replyLanguageInstructions,
  resolveEdgeVoice,
  resolveReplyLanguage,
  TUTOR_VOICES,
} from "./voices";

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
      "en-US-AvaNeural",
    );
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
});
