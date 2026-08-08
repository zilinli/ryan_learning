/**
 * 讯飞方言识别大模型 (WebSocket) 客户端。
 *
 * 参考官方协议 (https://www.xfyun.cn/doc/spark/spark_slm_iat.html)：
 *   - 方言识别地址: wss://iat.cn-huabei-1.xf-yun.com/v1（华北1；海外服务器直接连）
 *   - HMAC-SHA256 鉴权；协议帧格式 header/parameter.iat/payload.audio
 *   - 音频: 16k/16bit/单声道，encoding=lame(mp3)；domain="slm", accent="mulacc"
 *   - 响应: payload.result.text 是 base64(JSON) → ws[].cw[].w 拼接文本
 *
 * 本模块刻意把「鉴权 URL 生成」「帧解析」做成纯函数，便于单元测试；
 * 真实网络调用仅在配置了 IFYTEK_* 环境变量时发生，否则由调用方降级。
 */
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

export const IFYTEK_WS_URL = "wss://iat.cn-huabei-1.xf-yun.com/v1";
export const IFYTEK_HOST = "iat.cn-huabei-1.xf-yun.com";

export type IflytekConfig = {
  apiKey: string;
  apiSecret: string;
  appId: string;
};

export class IflytekNotConfiguredError extends Error {
  constructor(message = "讯飞方言识别未配置 (IFYTEK_APP_ID/IFYTEK_API_KEY/IFYTEK_API_SECRET)") {
    super(message);
    this.name = "IflytekNotConfiguredError";
  }
}

export function toRfc1123(date: Date): string {
  return date.toUTCString();
}

export function buildIflytekWsUrl(
  config: IflytekConfig,
  date: Date = new Date(),
): string {
  const dateStr = toRfc1123(date);
  const signatureOrigin =
    `host: ${IFYTEK_HOST}\n` +
    `date: ${dateStr}\n` +
    `GET /v1 HTTP/1.1`;
  const signatureSha = createHmac("sha256", config.apiSecret)
    .update(signatureOrigin, "utf8")
    .digest("base64");
  const authorizationOrigin =
    `api_key="${config.apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin, "utf8").toString("base64");
  const qs = new URLSearchParams({ authorization, date: dateStr, host: IFYTEK_HOST });
  return `${IFYTEK_WS_URL}?${qs.toString()}`;
}

// ── 纯函数（保留向前兼容 + 单元测试） ──

export function wavToRawPcm(buffer: Uint8Array): Uint8Array | null {
  if (buffer.length < 44) return null;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (
    String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)) !== "RIFF"
  ) return null;
  if (
    String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)) !== "WAVE"
  ) return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "data") return buffer.subarray(offset + 8, Math.min(offset + 8 + chunkSize, buffer.length));
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

/** 解析讯飞方言大模型一帧 JSON，从 base64(result.text) 中提取中文文本。 */
export function appendIflytekFrame(
  acc: string,
  frameJson: string,
): { text: string; done: boolean } {
  try {
    const frame = JSON.parse(frameJson) as {
      header?: { code?: number; status?: number };
      payload?: { result?: { text?: string } };
    };
    const code = frame?.header?.code ?? -1;
    if (code !== 0) return { text: acc, done: true }; // 错误帧：结束

    const status = frame?.header?.status ?? 0;
    const b64 = frame?.payload?.result?.text;
    if (!b64 || b64.length < 4) return { text: acc, done: status === 2 };

    // 解码 base64
    let inner: { ws?: { cw?: { w?: string }[] }[] };
    try {
      inner = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
        ws?: { cw?: { w?: string }[] }[];
      };
    } catch {
      return { text: acc, done: status === 2 };
    }

    // 从 ws[].cw[].w 拼接文本（每帧是全量结果，非增量）
    const words: string[] = [];
    if (Array.isArray(inner.ws)) {
      for (const seg of inner.ws) {
        if (Array.isArray(seg.cw)) {
          for (const c of seg.cw) {
            if (typeof c.w === "string") words.push(c.w);
          }
        }
      }
    }
    return { text: words.join(""), done: status === 2 };
  } catch {
    return { text: acc, done: false };
  }
}

export function chunkPcmForIflytek(pcm: Uint8Array, frameBytes = 1280): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += frameBytes) {
    chunks.push(pcm.subarray(i, Math.min(i + frameBytes, pcm.length)));
  }
  return chunks;
}

// ── 真实调用 ──

/** 将 WAV buffer 用 ffmpeg 转为 16k 单声道 MP3；长度上限 60s。 */
async function wavToMp3(wav: Uint8Array): Promise<Buffer> {
  const tmpDir = await import("node:fs/promises").then((m) => m.mkdtemp(path.join(os.tmpdir(), "iflytek-")));
  const wavPath = path.join(tmpDir, "input.wav");
  const mp3Path = path.join(tmpDir, "output.mp3");
  try {
    await writeFile(wavPath, wav);
    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        ["-y", "-i", wavPath, "-ac", "1", "-ar", "16000", "-ab", "32k", "-t", "60", "-f", "mp3", mp3Path],
        { timeout: 15_000 },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    return await readFile(mp3Path);
  } finally {
    // 后台清理临时文件
    Promise.all([
      unlink(wavPath).catch(() => {}),
      unlink(mp3Path).catch(() => {}),
    ]).catch(() => {});
  }
}

function bufToBase64(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
  return Buffer.from(bin, "binary").toString("base64");
}

function buildFrame(appId: string, mp3Base64: string, status: 0 | 1 | 2, seq: number) {
  return JSON.stringify({
    header: { app_id: appId, status },
    parameter: {
      iat: {
        domain: "slm",
        language: "zh_cn",
        accent: "mulacc",
        result: { encoding: "utf8", compress: "raw", format: "json" },
      },
    },
    payload: {
      audio: {
        encoding: "lame",
        sample_rate: 16000,
        channels: 1,
        bit_depth: 16,
        status,
        seq,
        audio: mp3Base64,
      },
    },
  });
}

export async function transcribeWithIflytek(
  config: IflytekConfig,
  wavBuffer: Uint8Array,
  opts: { timeoutMs?: number } = {},
): Promise<{ text: string }> {
  // WAV → MP3（讯飞方言模型只接受 lame 编码）
  const mp3 = await wavToMp3(wavBuffer);
  if (mp3.byteLength < 100) throw new Error("ffmpeg produced empty MP3 for iflytek");

  const mp3B64 = bufToBase64(mp3);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const url = buildIflytekWsUrl(config);

  const WSImpl =
    typeof WebSocket !== "undefined"
      ? WebSocket
      : (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WSImpl) throw new IflytekNotConfiguredError("环境缺少 WebSocket 支持");

  return new Promise<{ text: string }>((resolve, reject) => {
    let ws: WebSocket;
    try { ws = new WSImpl(url); } catch (err) { reject(err); return; }

    let settled = false;
    let acc = "";
    const finish = (cb: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb();
    };
    const timer = setTimeout(() => finish(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error("iflytek timeout"));
    }), timeoutMs);

    ws.onopen = () => {
      // 发送首帧（含音频）→ 结束帧
      ws.send(buildFrame(config.appId, mp3B64, 0, 0));
      ws.send(buildFrame(config.appId, "", 2, 1));
    };

    ws.onmessage = (event: MessageEvent) => {
      let raw: string;
      try { raw = typeof event.data === "string" ? event.data : String(event.data); } catch { return; }
      const { text, done } = appendIflytekFrame(acc, raw);
      acc = text;
      if (done) {
        finish(() => {
          try { ws.close(); } catch { /* ignore */ }
          const final = acc.trim();
          if (final) resolve({ text: final });
          else reject(new Error("iflytek returned empty text"));
        });
      }
    };

    ws.onerror = () => finish(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error("iflytek connection error"));
    });

    ws.onclose = (ev: CloseEvent) => {
      if (settled) return;
      finish(() => {
        if (acc.trim()) resolve({ text: acc.trim() });
        else reject(new Error(`iflytek closed unexpectedly (code ${ev.code})`));
      });
    };
  });
}

export function loadIflytekConfig(): IflytekConfig | null {
  const apiKey = process.env.IFYTEK_API_KEY?.trim();
  const apiSecret = process.env.IFYTEK_API_SECRET?.trim();
  const appId = process.env.IFYTEK_APP_ID?.trim();
  if (!apiKey || !apiSecret || !appId) return null;
  return { apiKey, apiSecret, appId };
}
