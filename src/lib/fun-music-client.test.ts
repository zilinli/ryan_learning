import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampFunMusicLyrics,
  clampFunMusicPrompt,
  funMusicEndpoint,
  funMusicGenerate,
  isFunMusicConfigured,
} from "./fun-music-client";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...OLD_ENV };
  delete process.env.ALIYUN_DASHSCOPE_API_KEY;
  delete process.env.ALIYUN_WORKSPACE_ID;
  delete process.env.FUN_MUSIC_BASE_URL;
  delete process.env.FUN_MUSIC_MODEL;
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fun-music-client config", () => {
  it("is configured only when DashScope key present", () => {
    expect(isFunMusicConfigured()).toBe(false);
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    expect(isFunMusicConfigured()).toBe(true);
  });

  it("builds workspace, dashscope, or override endpoint", () => {
    expect(funMusicEndpoint()).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/audio/music/generation",
    );
    process.env.ALIYUN_WORKSPACE_ID = "ws-demo";
    expect(funMusicEndpoint()).toBe(
      "https://ws-demo.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/music/generation",
    );
    process.env.FUN_MUSIC_BASE_URL = "https://custom.example/music/";
    expect(funMusicEndpoint()).toBe("https://custom.example/music");
  });

  it("clamps CN vs EN lyrics and prompt", () => {
    const en = "hello world ".repeat(300);
    expect(clampFunMusicLyrics(en).length).toBeLessThanOrEqual(2000);
    const cn = "清晨的阳光穿过窗帘，".repeat(40);
    expect(clampFunMusicLyrics(cn).length).toBeLessThanOrEqual(350);
    expect(clampFunMusicPrompt("x".repeat(3000)).length).toBe(2000);
  });
});

describe("funMusicGenerate", () => {
  it("returns unconfigured without API key", async () => {
    const r = await funMusicGenerate({ lyrics: "[Verse]\nhello there friends" });
    expect(r.status).toBe("unconfigured");
    expect(r.ok).toBe(false);
  });

  it("rejects empty input", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    const r = await funMusicGenerate({});
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/lyrics or prompt/i);
  });

  it("sends lyrics (not prompt) and gender when lyrics present", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    process.env.ALIYUN_WORKSPACE_ID = "ws1";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: "req-1",
          output: {
            audio: {
              url: "https://oss.example/a.mp3",
              id: "audio_1",
            },
            extra_info: { lyrics: "[verse]\nx", channels: 2 },
            finish_reason: "stop",
          },
          usage: { duration: 42 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await funMusicGenerate({
      lyrics: "[Verse]\nA quiet morning by the bay\n[Chorus]\nHold on",
      prompt: "Indie mood — should be ignored by body",
      gender: "male",
    });

    expect(r.ok).toBe(true);
    expect(r.status).toBe("done");
    expect(r.audioUrl).toContain("oss.example");
    expect(r.requestId).toBe("req-1");
    expect(r.durationSec).toBe(42);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("ws1.cn-beijing.maas.aliyuncs.com");
    expect(url).toContain("/audio/music/generation");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      input: Record<string, unknown>;
    };
    expect(body.model).toBe("fun-music-v1");
    expect(body.input.lyrics).toBeTruthy();
    expect(body.input.prompt).toBeUndefined();
    expect(body.input.gender).toBe("male");
    expect(body.input.is_instrumental).toBe(false);
  });

  it("sends prompt-only when no lyrics", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { audio: { url: "https://oss.example/b.mp3" } },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await funMusicGenerate({
      prompt: "夏日清新民谣，木吉他",
      gender: "female",
    });
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { input: Record<string, unknown> };
    expect(body.input.prompt).toContain("民谣");
    expect(body.input.lyrics).toBeUndefined();
    expect(body.input.gender).toBe("female");
  });

  it("omits gender for instrumental", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { audio: { url: "https://oss.example/c.mp3" } },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await funMusicGenerate({
      prompt: "lofi beat",
      isInstrumental: true,
      gender: "male",
    });
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { input: Record<string, unknown> };
    expect(body.input.is_instrumental).toBe(true);
    expect(body.input.gender).toBeUndefined();
  });

  it("surfaces HTTP API errors", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "AccessDenied",
            message: "Model not authorized. Apply for invite.",
          }),
          { status: 403 },
        ),
      ),
    );
    const r = await funMusicGenerate({ lyrics: "[Verse]\nenough chars here" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/invite|authorized|AccessDenied/i);
  });

  it("errors when response has no audio", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ output: { audio: {} } }), { status: 200 }),
      ),
    );
    const r = await funMusicGenerate({ lyrics: "[Verse]\nenough chars here" });
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/no audio|invite/i);
  });
});
