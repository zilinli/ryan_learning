import { afterEach, describe, expect, it } from "vitest";
import {
  appendIflytekFrame,
  buildIflytekWsUrl,
  chunkPcmForIflytek,
  IFYTEK_HOST,
  loadIflytekConfig,
  toRfc1123,
  wavToRawPcm,
} from "./iflytek-asr";

describe("toRfc1123", () => {
  it("formats a date as RFC1123 GMT", () => {
    const d = new Date("2024-05-14T08:46:48Z");
    expect(toRfc1123(d)).toBe("Tue, 14 May 2024 08:46:48 GMT");
  });
});

describe("buildIflytekWsUrl", () => {
  const config = { apiKey: "key1234567890", apiSecret: "secret1234567890", appId: "appid1234567890" };
  const fixed = new Date("2024-05-14T08:46:48Z");

  it("produces a wss URL with authorization/date/host query params", () => {
    const url = buildIflytekWsUrl(config, fixed);
    const parsed = new URL(url);
    expect(parsed.protocol).toBe("wss:");
    expect(parsed.pathname).toBe("/v1");
    expect(parsed.searchParams.get("host")).toBe(IFYTEK_HOST);
    expect(parsed.searchParams.get("date")).toBe("Tue, 14 May 2024 08:46:48 GMT");
    expect(parsed.searchParams.get("authorization")).toBeTruthy();
  });

  it("is deterministic for the same date", () => {
    const a = buildIflytekWsUrl(config, fixed);
    const b = buildIflytekWsUrl(config, fixed);
    expect(a).toBe(b);
  });

  it("changes signature when apiSecret changes", () => {
    const a = buildIflytekWsUrl(config, fixed);
    const b = buildIflytekWsUrl({ ...config, apiSecret: "other-secret" }, fixed);
    expect(a).not.toBe(b);
  });

  it("authorization base64 decodes to an hmac-sha256 origin", () => {
    const url = buildIflytekWsUrl(config, fixed);
    const auth = new URL(url).searchParams.get("authorization")!;
    const decoded = Buffer.from(auth, "base64").toString("utf8");
    expect(decoded).toContain('algorithm="hmac-sha256"');
    expect(decoded).toContain('headers="host date request-line"');
    expect(decoded).toContain(`api_key="${config.apiKey}"`);
  });
});

describe("wavToRawPcm", () => {
  function makeWav(dataSize: number): Uint8Array {
    const buf = new Uint8Array(44 + dataSize);
    const view = new DataView(buf.buffer);
    // RIFF header
    view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46); // RIFF
    view.setUint32(4, 36 + dataSize, true);
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45); // WAVE
    // fmt chunk
    view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    // data chunk
    view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61); // "data"
    view.setUint32(40, dataSize, true);
    return buf;
  }

  it("strips the 44-byte WAV header", () => {
    const wav = makeWav(128);
    const pcm = wavToRawPcm(wav)!;
    expect(pcm).not.toBeNull();
    expect(pcm.length).toBe(128);
    expect(pcm[0]).toBe(0); // data area is zeros
  });

  it("returns null for non-RIFF input", () => {
    expect(wavToRawPcm(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("returns null for input shorter than header", () => {
    expect(wavToRawPcm(new Uint8Array(10))).toBeNull();
  });

  it("handles a data chunk not at offset 44 (extra chunks)", () => {
    // Build: RIFF(12) + LIST chunk(8, size 0) + data chunk(8) → data offset 28
    const buf = new Uint8Array(28 + 64);
    const view = new DataView(buf.buffer);
    view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
    view.setUint32(4, 28 + 64, true);
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
    // LIST chunk at 12: id + size(0) → next at 20
    view.setUint8(12, 0x4c); view.setUint8(13, 0x49); view.setUint8(14, 0x53); view.setUint8(15, 0x54); // LIST
    view.setUint32(16, 0, true);
    // data chunk at 20
    view.setUint8(20, 0x64); view.setUint8(21, 0x61); view.setUint8(22, 0x74); view.setUint8(23, 0x61); // data
    view.setUint32(24, 64, true);
    for (let i = 0; i < 64; i++) view.setUint8(28 + i, i);
    const pcm = wavToRawPcm(buf)!;
    expect(pcm).not.toBeNull();
    expect(pcm.length).toBe(64);
    expect(pcm[0]).toBe(0);
    expect(pcm[63]).toBe(63);
  });
});

describe("chunkPcmForIflytek", () => {
  it("splits PCM into frames of at most frameBytes", () => {
    const pcm = new Uint8Array(3000);
    const chunks = chunkPcmForIflytek(pcm, 1280);
    expect(chunks.length).toBe(3);
    expect(chunks[0]!.length).toBe(1280);
    expect(chunks[1]!.length).toBe(1280);
    expect(chunks[2]!.length).toBe(440);
  });

  it("handles empty input", () => {
    expect(chunkPcmForIflytek(new Uint8Array(0))).toEqual([]);
  });
});

describe("appendIflytekFrame", () => {
  /** 把文本包装成讯飞方言大模型的 base64 响应格式 */
  function frame(text: string, status: 0 | 1 | 2): string {
    const inner = JSON.stringify({
      sn: 1,
      ls: true,
      bg: 0,
      ed: 0,
      ws: [{ bg: 0, cw: text.split("").map((w) => ({ w, sc: 0 })) }],
    });
    const b64 = Buffer.from(inner, "utf8").toString("base64");
    return JSON.stringify({
      header: { code: 0, status },
      payload: { result: { text: b64, encoding: "utf8", compress: "raw", format: "json" } },
    });
  }

  it("each frame carries the full recognized text (not incremental)", () => {
    const r1 = appendIflytekFrame("", frame("潮汕", 1));
    expect(r1.text).toBe("潮汕");
    expect(r1.done).toBe(false);
    // 下一帧是完整结果"潮汕話真好食"，覆盖而非追加
    const r2 = appendIflytekFrame(r1.text, frame("潮汕話真好食", 1));
    expect(r2.text).toBe("潮汕話真好食");
    expect(r2.done).toBe(false);
  });

  it("marks done on status 2 final frame", () => {
    const r = appendIflytekFrame("已", frame("完", 2));
    expect(r.done).toBe(true);
  });

  it("handles error frame (code != 0) as done", () => {
    const f = JSON.stringify({ header: { code: 101, status: 2 } });
    const r = appendIflytekFrame("prev", f);
    expect(r.done).toBe(true);
    expect(r.text).toBe("prev"); // unchanged
  });

  it("tolerates malformed frames without throwing", () => {
    const r = appendIflytekFrame("abc", "not json");
    expect(r.text).toBe("abc");
    expect(r.done).toBe(false);
  });
});

describe("loadIflytekConfig", () => {
  const OLD = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD };
  });

  it("returns null when keys are missing", () => {
    delete process.env.IFYTEK_API_KEY;
    delete process.env.IFYTEK_API_SECRET;
    delete process.env.IFYTEK_APP_ID;
    expect(loadIflytekConfig()).toBeNull();
  });

  it("returns config when all three env vars are set", () => {
    process.env.IFYTEK_API_KEY = " k1 ";
    process.env.IFYTEK_API_SECRET = " s1 ";
    process.env.IFYTEK_APP_ID = " a1 ";
    const cfg = loadIflytekConfig();
    expect(cfg).toEqual({ apiKey: "k1", apiSecret: "s1", appId: "a1" });
  });
});
