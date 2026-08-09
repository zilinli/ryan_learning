import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, normalizeTranscribeLang, isIflytekBackupEnabled } from "./route";
import * as bailianAsr from "@/lib/bailian-asr";
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
  delete process.env.STT_BACKUP_IFYTEK;
  delete process.env.ALIYUN_DASHSCOPE_API_KEY;
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("normalizeTranscribeLang", () => {
  it("maps dialect aliases to teo/hak", () => {
    expect(normalizeTranscribeLang("teochew")).toBe("teo");
    expect(normalizeTranscribeLang("hakka")).toBe("hak");
  });

  it("falls back to auto for unknown languages", () => {
    expect(normalizeTranscribeLang("klingon")).toBe("auto");
  });
});

describe("isIflytekBackupEnabled", () => {
  it("is off by default", () => {
    expect(isIflytekBackupEnabled()).toBe(false);
  });
  it("turns on with STT_BACKUP_IFYTEK=1", () => {
    process.env.STT_BACKUP_IFYTEK = "1";
    expect(isIflytekBackupEnabled()).toBe(true);
  });
});

describe("POST /api/transcribe — Bailian primary", () => {
  it("uses Bailian when DashScope key is set", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    vi.spyOn(bailianAsr, "loadBailianAsrConfig").mockReturnValue({
      apiKey: "sk-test",
      model: "fun-asr-flash-2026-06-15",
      fallbackModel: "qwen3-asr-flash",
    });
    vi.spyOn(bailianAsr, "transcribeWithBailian").mockResolvedValue({
      text: "百炼识别结果",
      language: "zh",
      model: "fun-asr-flash-2026-06-15",
    });

    const res = await POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        body: makeForm("teo"),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("百炼识别结果");
    expect(data.engine).toBe("bailian");
  });

  it("falls back to local when Bailian returns empty", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    vi.spyOn(bailianAsr, "loadBailianAsrConfig").mockReturnValue({
      apiKey: "sk-test",
      model: "fun-asr-flash-2026-06-15",
      fallbackModel: "qwen3-asr-flash",
    });
    vi.spyOn(bailianAsr, "transcribeWithBailian").mockResolvedValue({
      text: "",
      model: "fun-asr-flash-2026-06-15",
    });
    mockSttServer("本地识别结果", "teo");

    const res = await POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        body: makeForm("teo"),
      }),
    );
    const data = await res.json();
    expect(data.text).toBe("本地识别结果");
    expect(data.engine).toBe("local");
  });

  it("does not call iflytek unless STT_BACKUP_IFYTEK is on", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    process.env.IFYTEK_API_KEY = "k1";
    process.env.IFYTEK_API_SECRET = "s1";
    process.env.IFYTEK_APP_ID = "a1";
    vi.spyOn(bailianAsr, "loadBailianAsrConfig").mockReturnValue(null);
    const iflySpy = vi
      .spyOn(iflytekAsr, "transcribeWithIflytek")
      .mockResolvedValue({ text: "should not" });
    mockSttServer("local", "teo");

    await POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        body: makeForm("teo"),
      }),
    );
    expect(iflySpy).not.toHaveBeenCalled();
  });

  it("uses iflytek backup when enabled and Bailian misses", async () => {
    process.env.STT_BACKUP_IFYTEK = "1";
    process.env.IFYTEK_API_KEY = "k1";
    process.env.IFYTEK_API_SECRET = "s1";
    process.env.IFYTEK_APP_ID = "a1";
    vi.spyOn(bailianAsr, "loadBailianAsrConfig").mockReturnValue(null);
    vi.spyOn(iflytekAsr, "loadIflytekConfig").mockReturnValue({
      apiKey: "k1",
      apiSecret: "s1",
      appId: "a1",
    });
    vi.spyOn(iflytekAsr, "transcribeWithIflytek").mockResolvedValue({
      text: "讯飞备份结果",
    });

    const res = await POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        body: makeForm("hak"),
      }),
    );
    const data = await res.json();
    expect(data.text).toBe("讯飞备份结果");
    expect(data.engine).toBe("iflytek");
  });

  it("returns 422 when local fallback returns empty text", async () => {
    mockSttServer("");
    const res = await POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        body: makeForm("auto"),
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 502 when local STT server is down", async () => {
    mockSttServerFail();
    const res = await POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        body: makeForm("auto"),
      }),
    );
    expect(res.status).toBe(502);
  });
});
