import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALIYUN_CLONE_MODEL,
  aliyunCloneVoiceIdForLang,
  callAliyunCloneTts,
  ttsProviderForLang,
  TtsProviderNotConfiguredError,
} from "./tts-provider";

const OLD = { ...process.env };

afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
});

describe("ttsProviderForLang", () => {
  it("routes teo/hak to edge Cantonese when no aliyun key or voiceId", () => {
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    delete process.env.TEO_CLONE_VOICE_ID;
    delete process.env.HAK_CLONE_VOICE_ID;
    expect(ttsProviderForLang("teo")).toEqual({
      kind: "edge",
      voice: "zh-HK-WanLungNeural",
    });
    expect(ttsProviderForLang("hak")).toEqual({
      kind: "edge",
      voice: "zh-HK-WanLungNeural",
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
    });
    expect(ttsProviderForLang("hak")).toEqual({
      kind: "aliyun-clone",
      voiceId: "cosyvoice-v3-plus-hakka-01",
      model: ALIYUN_CLONE_MODEL,
    });
  });

  it("falls back to edge when key exists but voiceId missing", () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    delete process.env.TEO_CLONE_VOICE_ID;
    expect(ttsProviderForLang("teo").kind).toBe("edge");
  });

  it("keeps other languages on edge voices", () => {
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    expect(ttsProviderForLang("en").kind).toBe("edge");
    expect(ttsProviderForLang("yue").kind).toBe("edge");
    expect(ttsProviderForLang("fr").kind).toBe("edge");
    expect(ttsProviderForLang("zh").kind).toBe("edge");
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

describe("callAliyunCloneTts", () => {
  it("throws ProviderNotConfigured when no API key", async () => {
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    await expect(
      callAliyunCloneTts("你好", "v1", ALIYUN_CLONE_MODEL),
    ).rejects.toThrow(TtsProviderNotConfiguredError);
  });

  it("throws when the HTTP call returns non-ok JSON error", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "no permission", code: "1004" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      callAliyunCloneTts("你好", "v1", ALIYUN_CLONE_MODEL, { apiKey: "sk-x" }),
    ).rejects.toThrow(/no permission/);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain("dashscope.aliyuncs.com");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-x");
    const body = JSON.parse(init.body as string);
    expect(body.input.voice).toBe("v1");
    expect(body.input.text).toBe("你好");
  });

  it("returns mp3 buffer on success", async () => {
    const mp3 = Buffer.alloc(150, 0x55);
    mp3[0] = 0x49;
    mp3[1] = 0x44;
    mp3[2] = 0x33;
    const mockFetch = vi.fn().mockResolvedValue(
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
    expect(audio[0]).toBe(0x49);
  });

  it("throws on empty audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array(50), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      ),
    );
    await expect(
      callAliyunCloneTts("你好", "v1", ALIYUN_CLONE_MODEL, { apiKey: "sk-x" }),
    ).rejects.toThrow(/empty audio/);
  });

  it("throws on non-2xx without JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 502 })),
    );
    await expect(
      callAliyunCloneTts("你好", "v1", ALIYUN_CLONE_MODEL, { apiKey: "sk-x" }),
    ).rejects.toThrow(/HTTP 502/);
  });
});
