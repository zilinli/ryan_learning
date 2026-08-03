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
  });

  it("auto picks Cantonese for Chinese, Spanish/English otherwise", () => {
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
  });

  it("switches English fixed voice when chunk is Chinese/Spanish", () => {
    expect(resolveEdgeVoice("ava", "请用中文解释")).toBe("zh-HK-WanLungNeural");
    expect(resolveEdgeVoice("ava", "你睇吓呢题点解？")).toBe(
      "zh-HK-WanLungNeural",
    );
    expect(resolveEdgeVoice("ryan", "¿Qué significa esto?")).toBe(
      "es-ES-AlvaroNeural",
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
  it("prefers Cantonese for Chinese text", () => {
    expect(detectSpeechLang("这一题怎么解？")).toBe("yue");
    expect(detectSpeechLang("请看第一段：河水结冰了。")).toBe("yue");
  });

  it("detects Cantonese markers as Chinese → yue", () => {
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

  it("defaults to English", () => {
    expect(detectSpeechLang("Find the evidence in paragraph two.")).toBe("en");
  });
});

describe("replyLangFromVoice / replyLanguageInstructions", () => {
  it("maps voices to reply language modes", () => {
    expect(replyLangFromVoice("auto")).toBe("auto");
    expect(replyLangFromVoice("ava")).toBe("en");
    expect(replyLangFromVoice("yunxi")).toBe("zh");
    expect(replyLangFromVoice("wanLung")).toBe("yue");
    expect(replyLangFromVoice("alvaro")).toBe("es");
    expect(replyLangFromVoice("xiaoxiao")).toBe("zh");
  });

  it("emits strong language lock instructions for fixed modes", () => {
    const zh = replyLanguageInstructions("zh").join("\n");
    expect(zh).toMatch(/普通话/);
    expect(zh).toMatch(/REQUIRED/);

    const yue = replyLanguageInstructions("yue").join("\n");
    expect(yue).toMatch(/粤语/);

    const es = replyLanguageInstructions("es").join("\n");
    expect(es).toMatch(/Español|español/i);

    const auto = replyLanguageInstructions("auto").join("\n");
    expect(auto).toMatch(/粤语|广东话/);
    expect(auto).toMatch(/Chinese prefers|中文/i);
  });
});
