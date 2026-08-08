/**
 * 讯飞方言识别大模型 (WebSocket) 客户端。
 *
 * 参考官方协议 (https://www.xfyun.cn/doc/spark/spark_slm_iat.html)：
 *   - 方言识别地址: wss://iat.cn-huabei-1.xf-yun.com/v1
 *   - HMAC-SHA256 鉴权：authorization = base64(api_key="…", algorithm="hmac-sha256",
 *     headers="host date request-line", signature=base64(hmac_sha256(signature_origin, apiSecret)))
 *   - signature_origin = "host: <host>\ndate: <RFC1123>\nGET /v1 HTTP/1.1"
 *   - 音频: 16k/8k, 16bit, 单声道; encoding=raw(pcm) / lame(mp3); 最长 60s
 *   - domain="slm" 方言大模型, accent="mulacc" 202 种方言自动判别
 *
 * 本模块刻意把「鉴权 URL 生成」「WAV→PCM」「帧解析」做成纯函数，便于单元测试；
 * 真实网络调用仅在配置了 IFYTEK_API_KEY / IFYTEK_API_SECRET 时发生，否则由调用方降级。
 */
import { createHmac } from "node:crypto";

export const IFYTEK_WS_URL = "wss://iat.cn-huabei-1.xf-yun.com/v1";
export const IFYTEK_HOST = "iat.cn-huabei-1.xf-yun.com";

export type IflytekConfig = {
  /** 讯飞开放平台 WebAPI 应用的 APIKey */
  apiKey: string;
  /** 讯飞开放平台 WebAPI 应用的 APISecret */
  apiSecret: string;
  /** 讯飞开放平台应用 APPID（32 位字符串；用于业务参数 common.app_id） */
  appId: string;
};

/** 未配置 Key/Secret，或运行环境没有 WebSocket 时抛出，由上层 fallback 本地 Whisper。 */
export class IflytekNotConfiguredError extends Error {
  constructor(message = "讯飞方言识别未配置 (IFYTEK_API_KEY/IFYTEK_API_SECRET)") {
    super(message);
    this.name = "IflytekNotConfiguredError";
  }
}

/** RFC1123 格式 GMT 时间戳（与讯飞示例一致，如 "Tue, 14 May 2024 08:46:48 GMT"）。 */
export function toRfc1123(date: Date): string {
  return date.toUTCString();
}

/** 生成讯飞方言识别 WebSocket 连接 URL（含鉴权 query）。date 可注入以便测试。 */
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
  const authorization = Buffer.from(authorizationOrigin, "utf8").toString(
    "base64",
  );
  const qs = new URLSearchParams({
    authorization,
    date: dateStr,
    host: IFYTEK_HOST,
  });
  return `${IFYTEK_WS_URL}?${qs.toString()}`;
}

/**
 * 把 16kHz/16bit/单声道 WAV 转成 16k PCM（剥掉 RIFF/fmt/data 头）。
 * 若输入不是标准 PCM WAV，返回 null，调用方应走本地 Whisper。
 */
export function wavToRawPcm(buffer: Uint8Array): Uint8Array | null {
  if (buffer.length < 44) return null;
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  if (
    String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    ) !== "RIFF"
  ) {
    return null;
  }
  if (
    String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    ) !== "WAVE"
  ) {
    return null;
  }
  // 遍历 chunks 找到 "data" chunk 的偏移与长度
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "data") {
      const dataStart = offset + 8;
      const dataEnd = Math.min(dataStart + chunkSize, buffer.length);
      return buffer.subarray(dataStart, dataEnd);
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

/**
 * 解析讯飞流式 JSON 帧并追加文本。
 * 帧结构: { "header": { "status": 0|1|2, ... }, "payload": { "recognition": { "text": "..." } } }
 * status: 0 开始/中间, 1 中间, 2 结束。
 * 返回累积文本；遇到无法解析的帧原样返回 acc。
 */
export function appendIflytekFrame(
  acc: string,
  frameJson: string,
): { text: string; done: boolean } {
  try {
    const frame = JSON.parse(frameJson) as {
      header?: { status?: number };
      payload?: {
        recognition?: { text?: string };
      };
    };
    const status = frame?.header?.status ?? 0;
    const segText = frame?.payload?.recognition?.text ?? "";
    const text = acc + (segText || "");
    return { text, done: status === 2 };
  } catch {
    return { text: acc, done: false };
  }
}

/** 把 16k PCM 切成讯飞要求的 ≤1280 字节/帧的数据帧。 */
export function chunkPcmForIflytek(
  pcm: Uint8Array,
  frameBytes = 1280,
): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += frameBytes) {
    chunks.push(pcm.subarray(i, Math.min(i + frameBytes, pcm.length)));
  }
  return chunks;
}

/**
 * 真实调用讯飞方言识别（Node ≥22 原生 WebSocket）。
 * 返回识别文本。任何失败都会抛错，由调用方降级到本地 Whisper。
 */
export async function transcribeWithIflytek(
  config: IflytekConfig,
  wavBuffer: Uint8Array,
  opts: { timeoutMs?: number } = {},
): Promise<{ text: string }> {
  const pcm = wavToRawPcm(wavBuffer);
  if (!pcm) {
    throw new Error("audio is not a 16k PCM WAV — cannot send to iflytek");
  }
  if (pcm.length === 0) throw new Error("empty audio for iflytek");

  const timeoutMs = opts.timeoutMs ?? 30_000;
  const url = buildIflytekWsUrl(config);
  // Node ≥22 提供全局 WebSocket；浏览器环境无 node:crypto，不会走到这里
  const WSImpl =
    typeof WebSocket !== "undefined"
      ? WebSocket
      : (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WSImpl) {
    throw new IflytekNotConfiguredError("环境缺少 WebSocket 支持");
  }

  return new Promise<{ text: string }>((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WSImpl(url);
    } catch (err) {
      reject(err);
      return;
    }

    let settled = false;
    let acc = "";
    const finish = (
      cb: () => void,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb();
    };
    const timer = setTimeout(() => {
      finish(() => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        reject(new Error("iflytek timeout"));
      });
    }, timeoutMs);

    ws.onopen = () => {
      const frames = chunkPcmForIflytek(pcm);
      const hasAudio = frames.length > 0;
      const appId = config.appId;
      // 首帧含参数；所有音频帧逐个发送；末尾发结束帧
      for (let i = 0; i < frames.length; i += 1) {
        const first = i === 0;
        const last = i === frames.length - 1;
        const payload = {
          common: first ? { app_id: appId } : undefined,
          business: first
            ? {
                domain: "slm",
                language: "zh_cn",
                accent: "mulacc",
                vad_eos: 3000,
                dwa: "wpgs", // 动态修正开关：输出中间结果时同时输出最终结果
              }
            : undefined,
          data: {
            status: last ? 2 : 1,
            format: "raw",
            encoding: "raw",
            audio: arrayBufferToBase64(frames[i]!),
          },
        };
        ws.send(JSON.stringify(payload));
      }
      if (!hasAudio) {
        ws.send(
          JSON.stringify({
            common: { app_id: appId },
            business: {
              domain: "slm",
              language: "zh_cn",
              accent: "mulacc",
            },
            data: { status: 2, format: "raw", encoding: "raw", audio: "" },
          }),
        );
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      let raw: string;
      try {
        raw = typeof event.data === "string" ? event.data : String(event.data);
      } catch {
        return;
      }
      const { text, done } = appendIflytekFrame(acc, raw);
      acc = text;
      if (done) {
        finish(() => {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          resolve({ text: acc.trim() });
        });
      }
    };

    ws.onerror = () => {
      finish(() => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        reject(new Error("iflytek connection error"));
      });
    };

    ws.onclose = (ev: CloseEvent) => {
      finish(() => {
        if (acc.trim()) resolve({ text: acc.trim() });
        else
          reject(
            new Error(`iflytek closed unexpectedly (code ${ev.code})`),
          );
      });
    };
  });
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return Buffer.from(bin, "binary").toString("base64");
}

/** 读取环境变量中的讯飞配置；未配置返回 null。 */
export function loadIflytekConfig(): IflytekConfig | null {
  const apiKey = process.env.IFYTEK_API_KEY?.trim();
  const apiSecret = process.env.IFYTEK_API_SECRET?.trim();
  const appId = process.env.IFYTEK_APP_ID?.trim();
  if (!apiKey || !apiSecret || !appId) return null;
  return { apiKey, apiSecret, appId };
}
