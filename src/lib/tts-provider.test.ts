import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALIYUN_CLONE_MODEL,
  ALIYUN_TEO_SYSTEM_MODEL,
  ALIYUN_TEO_SYSTEM_VOICE,
  DialectTtsUnavailableError,
  FORMOSPEECH_HAK_VOICE,
  aliyunCloneVoiceIdForLang,
  callAliyunCloneTts,
  callFormospeechTts,
  ttsProviderForLang,
  TtsProviderNotConfiguredError,
} from "./tts-provider";

const OLD = { ...process.env };

afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
});

describe("ttsProviderForLang", () => {
  it("teo without Bailian key falls back to edge (zh-HK-WanLungNeural)", () => {
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    delete process.env.TEO_CLONE_VOICE_ID;
    expect(ttsProviderForLang("teo")).toEqual({
      kind: "edge",
      voice: "zh-HK-WanLungNeural",
    });
  });

  it("hak without clone uses FormoSpeech voice id (never zh-HK)", () => {
    delete process.env.HAK_CLONE_VOICE_ID;
    expect(ttsProviderForLang("hak")).toEqual({
      kind: "formospeech",
      voice: FORMOSPEECH_HAK_VOICE,
    });
  });

  it("routes teo/hak to aliyun-clone when key + voiceId configured", () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    process.env.TEO_CLONE_VOICE_ID = "cosyvoice-v3-plus-teochew-01";
    process.env.HAK_CLONE_VOICE_ID = "cosyvoice-v3-plus-hakka-01";
    expect(ttsProviderForLang("teo")).toEqual({
      kind: "aliyun-clone",
      voiceId: "cosyvoice-v3-plus-teochew-01",
      model: ALIYUN_CLONE_MODEL,
      source: "clone",
    });
    expect(ttsProviderForLang("hak")).toEqual({
      kind: "aliyun-clone",
      voiceId: "cosyvoice-v3-plus-hakka-01",
      model: ALIYUN_CLONE_MODEL,
      source: "clone",
    });
  });

  it("routes teo to Bailian Minnan system voice when key exists but no clone", () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    delete process.env.TEO_CLONE_VOICE_ID;
    expect(ttsProviderForLang("teo")).toEqual({
      kind: "aliyun-clone",
      voiceId: ALIYUN_TEO_SYSTEM_VOICE,
      model: ALIYUN_TEO_SYSTEM_MODEL,
      source: "minnan-system",
    });
  });

  it("keeps zh/yue/en/es/fr on edge (unchanged from pre-Bailian-TTS)", () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    expect(ttsProviderForLang("en").kind).toBe("edge");
    expect(ttsProviderForLang("yue").kind).toBe("edge");
    expect(ttsProviderForLang("zh").kind).toBe("edge");
    expect(ttsProviderForLang("es").kind).toBe("edge");
    expect(ttsProviderForLang("fr").kind).toBe("edge");
  });
});

describe("aliyunCloneVoiceIdForLang", () => {
  it("reads per-language voice IDs from env", () => {
    process.env.TEO_CLONE_VOICE_ID = " teo-v1 ";
    process.env.HAK_CLONE_VOICE_ID = " hak-v1 ";
    expect(aliyunCloneVoiceIdForLang("teo")).toBe("teo-v1");
    expect(aliyunCloneVoiceIdForLang("hak")).toBe("hak-v1");
    expect(aliyunCloneVoiceIdForLang("en")).toBeNull();
  });
});

describe("callFormospeechTts", () => {
  it("surfaces connection errors as DialectTtsUnavailableError", async () => {
    process.env.FORMOSPEECH_TTS_URL = "http://127.0.0.1:9";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    await expect(callFormospeechTts("你好")).rejects.toThrow(
      DialectTtsUnavailableError,
    );
  });

  it("posts to sidecar /tts", async () => {
    process.env.FORMOSPEECH_TTS_URL = "http://127.0.0.1:9876";
    const mp3 = Buffer.alloc(120, 1);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(mp3, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);
    const audio = await callFormospeechTts("你好");
    expect(audio.length).toBe(120);
    expect(String(mockFetch.mock.calls[0]![0])).toContain("/tts");
  });
});

describe("callAliyunCloneTts", () => {
  it("throws ProviderNotConfigured when no API key", async () => {
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    await expect(
      callAliyunCloneTts("你好", "v1", ALIYUN_CLONE_MODEL),
    ).rejects.toThrow(TtsProviderNotConfiguredError);
  });

  it("downloads audio from SpeechSynthesizer JSON url", async () => {
    const mp3 = Buffer.alloc(150, 0x55);
    mp3[0] = 0x49;
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: { audio: { url: "https://example.com/a.mp3" } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(mp3, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const audio = await callAliyunCloneTts("你好", "v1", ALIYUN_CLONE_MODEL, {
      apiKey: "sk-x",
    });
    expect(audio.length).toBe(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
