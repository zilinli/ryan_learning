import { describe, expect, it } from "vitest";
import {
  sttLangFromDictLang,
  sttLangFromVoice,
  voiceIdFromDictLang,
} from "./stt-lang";

describe("sttLangFromVoice", () => {
  it("maps tutor voices to STT language hints", () => {
    expect(sttLangFromVoice("auto")).toBe("auto");
    expect(sttLangFromVoice("ava")).toBe("en");
    expect(sttLangFromVoice("ryan")).toBe("en");
    expect(sttLangFromVoice("yunxi")).toBe("zh");
    expect(sttLangFromVoice("wanLung")).toBe("yue");
    expect(sttLangFromVoice("alvaro")).toBe("es");
    expect(sttLangFromVoice("jorge")).toBe("es");
    expect(sttLangFromVoice("henri")).toBe("fr");
    expect(sttLangFromVoice("teochew")).toBe("teo");
    expect(sttLangFromVoice("hakka")).toBe("hak");
    expect(sttLangFromVoice("osman")).toBe("ms");
    expect(sttLangFromVoice("yasmin")).toBe("ms");
  });

  it("honors legacy voice ids via normalizeVoiceId", () => {
    expect(sttLangFromVoice("xiaoxiao")).toBe("zh");
    expect(sttLangFromVoice("hiuMaan")).toBe("yue");
    expect(sttLangFromVoice("elvira")).toBe("es");
  });

  it("falls back to auto for unknown ids", () => {
    expect(sttLangFromVoice("unknown")).toBe("auto");
    expect(sttLangFromVoice(null)).toBe("auto");
  });

  it("maps dialect dictionary languages to their STT paths", () => {
    expect(sttLangFromDictLang("teo")).toBe("teo");
    expect(sttLangFromDictLang("hak")).toBe("hak");
    expect(sttLangFromDictLang("yue")).toBe("yue");
    expect(sttLangFromDictLang("zh")).toBe("zh");
    expect(sttLangFromDictLang("en")).toBe("en");
    expect(sttLangFromDictLang("es")).toBe("es");
    expect(sttLangFromDictLang("fr")).toBe("fr");
    expect(sttLangFromDictLang("ms")).toBe("ms");
    expect(sttLangFromDictLang(null)).toBe("auto");
  });
});

describe("voiceIdFromDictLang", () => {
  it("maps dialect dict langs to tutor voice ids for main-page TTS routing", () => {
    expect(voiceIdFromDictLang("teo")).toBe("teochew");
    expect(voiceIdFromDictLang("hak")).toBe("hakka");
    expect(voiceIdFromDictLang("zh")).toBe("yunxi");
    expect(voiceIdFromDictLang("yue")).toBe("wanLung");
    expect(voiceIdFromDictLang("en")).toBe("ryan");
    expect(voiceIdFromDictLang("ms")).toBe("osman");
  });
});
