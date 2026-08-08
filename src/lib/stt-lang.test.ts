import { describe, expect, it } from "vitest";
import { sttLangFromDictLang, sttLangFromVoice } from "./stt-lang";

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
    expect(sttLangFromVoice("teochew")).toBe("auto");
    expect(sttLangFromVoice("hakka")).toBe("auto");
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

  it("maps dialect dictionary languages to auto STT", () => {
    expect(sttLangFromDictLang("teo")).toBe("auto");
    expect(sttLangFromDictLang("hak")).toBe("auto");
    expect(sttLangFromDictLang("yue")).toBe("yue");
    expect(sttLangFromDictLang("zh")).toBe("zh");
  });
});
