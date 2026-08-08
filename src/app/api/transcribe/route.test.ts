import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, normalizeTranscribeLang } from "./route";
import * as iflytekAsr from "@/lib/iflytek-asr";

const OLD_ENV = { ...process.env };

function makeForm(language: string, audioBytes?: number): FormData {
  const form = new FormData();
  const audio = new Blob([new Uint8Array(audioBytes ?? 1024)], {
    type: "audio/wav",
  });
  form.append("audio", audio, "speech.wav");
  form.append("language", language);
  return form;
}

function mockSttServer(text: string, language = "teo") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text, language, ok: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
}

function mockSttServerFail() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "busy" }), { status: 503 }),
    ),
  );
}

beforeEach(() => {
  process.env = { ...OLD_ENV };
  delete process.env.IFYTEK_API_KEY;
  delete process.env.IFYTEK_API_SECRET;
  delete process.env.IFYTEK_APP_ID;
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("normalizeTranscribeLang", () => {
  it("maps dialect aliases to teo/hak", () => {
    expect(normalizeTranscribeLang("teochew")).toBe("teo");
    expect(normalizeTranscribeLang("chaoshan")).toBe("teo");
    expect(normalizeTranscribeLang("hakka")).toBe("hak");
    expect(normalizeTranscribeLang("kejia")).toBe("hak");
    expect(normalizeTranscribeLang("teo")).toBe("teo");
    expect(normalizeTranscribeLang("hak")).toBe("hak");
  });

  it("falls back to auto for unknown languages", () => {
    expect(normalizeTranscribeLang("klingon")).toBe("auto");
    expect(normalizeTranscribeLang("")).toBe("auto");
  });
});

describe("POST /api/transcribe — dialect iflytek routing", () => {
  it("uses local Whisper (forwardOnce) when no iflytek keys configured", async () => {
    mockSttServer("本地识别结果", "teo");
    const res = await POST(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: makeForm("teo"),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("本地识别结果");
    expect(data.engine).toBeUndefined(); // 未走讯飞
  });

  it("uses iflytek when keys configured and it succeeds", async () => {
    process.env.IFYTEK_API_KEY = "k1";
    process.env.IFYTEK_API_SECRET = "s1";
    process.env.IFYTEK_APP_ID = "a1";
    const spy = vi
      .spyOn(iflytekAsr, "transcribeWithIflytek")
      .mockResolvedValue({ text: "潮汕话识别结果" });
    vi.spyOn(iflytekAsr, "loadIflytekConfig").mockReturnValue({
      apiKey: "k1",
      apiSecret: "s1",
      appId: "a1",
    });

    const res = await POST(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: makeForm("teo"),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("潮汕话识别结果");
    expect(data.engine).toBe("iflytek");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to local Whisper when iflytek fails", async () => {
    process.env.IFYTEK_API_KEY = "k1";
    process.env.IFYTEK_API_SECRET = "s1";
    process.env.IFYTEK_APP_ID = "a1";
    vi.spyOn(iflytekAsr, "transcribeWithIflytek").mockRejectedValue(
      new Error("iflytek connection error"),
    );
    vi.spyOn(iflytekAsr, "loadIflytekConfig").mockReturnValue({
      apiKey: "k1",
      apiSecret: "s1",
      appId: "a1",
    });
    mockSttServer("回退识别结果", "teo");

    const res = await POST(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: makeForm("teo"),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("回退识别结果");
    expect(data.engine).toBeUndefined();
  });

  it("falls back to local Whisper when iflytek returns empty text", async () => {
    process.env.IFYTEK_API_KEY = "k1";
    process.env.IFYTEK_API_SECRET = "s1";
    process.env.IFYTEK_APP_ID = "a1";
    vi.spyOn(iflytekAsr, "transcribeWithIflytek").mockResolvedValue({
      text: "   ",
    });
    vi.spyOn(iflytekAsr, "loadIflytekConfig").mockReturnValue({
      apiKey: "k1",
      apiSecret: "s1",
      appId: "a1",
    });
    mockSttServer("fallback text");

    const res = await POST(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: makeForm("hak"),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("fallback text");
  });

  it("does NOT call iflytek for non-dialect languages even with keys", async () => {
    process.env.IFYTEK_API_KEY = "k1";
    process.env.IFYTEK_API_SECRET = "s1";
    process.env.IFYTEK_APP_ID = "a1";
    const spy = vi
      .spyOn(iflytekAsr, "transcribeWithIflytek")
      .mockResolvedValue({ text: "should not be called" });
    vi.spyOn(iflytekAsr, "loadIflytekConfig").mockReturnValue({
      apiKey: "k1",
      apiSecret: "s1",
      appId: "a1",
    });
    mockSttServer("english result", "en");

    const res = await POST(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: makeForm("en"),
    }));
    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 422 when local fallback returns empty text", async () => {
    mockSttServer("");
    const res = await POST(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: makeForm("auto"),
    }));
    expect(res.status).toBe(422);
  });

  it("returns 502 when local STT server is down", async () => {
    mockSttServerFail();
    const res = await POST(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: makeForm("auto"),
    }));
    expect(res.status).toBe(502);
  });
});
