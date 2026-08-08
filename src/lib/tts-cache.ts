/**
 * TTS 磁盘缓存（方言云端 TTS 防重复扣费 + 降延迟）。
 *
 * - 目录：`<dataDir>/tts-cache/<sha256(text + "\0" + voice)>.mp3`
 * - 原子写：tmp + rename，读方永远看不到半截文件。
 * - LRU 清理：pruneTtsCache 按 mtime 从旧到新删，直到总大小低于 maxBytes；
 *   同时删除超过 maxAgeMs 的文件。默认硬上限 3GB / 48h。
 */
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

/** 默认缓存目录；测试可通过 SPARK_DATA_DIR 注入隔离目录。 */
export function ttsCacheDir(): string {
  return path.join(process.env.SPARK_DATA_DIR || process.cwd() + "/data", "tts-cache");
}

export function ttsCacheKey(text: string, voice: string): string {
  return createHash("sha256").update(`${text}\0${voice}`, "utf8").digest("hex");
}

export function ttsCachePath(text: string, voice: string): string {
  return path.join(ttsCacheDir(), `${ttsCacheKey(text, voice)}.mp3`);
}

const pendingWrites = new Map<string, Promise<void>>();

async function atomicWrite(filePath: string, data: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    await fs.writeFile(tmpPath, data);
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    try {
      await fs.unlink(tmpPath);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/** 序列化对同一缓存文件的并发写。 */
async function lockedWrite(filePath: string, data: Buffer): Promise<void> {
  const prev = pendingWrites.get(filePath) ?? Promise.resolve();
  const next = prev
    .then(() => atomicWrite(filePath, data))
    .catch((err) => {
      // 缓存写失败不致命——下次重新合成即可
      console.error(`[tts-cache] write failed for ${filePath}:`, err);
      throw err;
    })
    .finally(() => {
      if (pendingWrites.get(filePath) === next) pendingWrites.delete(filePath);
    });
  pendingWrites.set(filePath, next);
  try {
    await next;
  } catch {
    // 已 log，调用方无需感知
  }
}

export async function getCachedTts(
  text: string,
  voice: string,
): Promise<Buffer | null> {
  try {
    const p = ttsCachePath(text, voice);
    const data = await fs.readFile(p);
    if (data.byteLength < 100) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setCachedTts(
  text: string,
  voice: string,
  audio: Buffer,
): Promise<void> {
  if (audio.byteLength < 100) return;
  await lockedWrite(ttsCachePath(text, voice), audio);
}

export type PruneResult = {
  freedBytes: number;
  files: number;
  kept: number;
};

/**
 * LRU 清理：按 mtime 升序（最旧在前）删除，直到总大小 ≤ maxBytes；
 * 超过 maxAgeMs 的文件无条件删除。maxBytes/maxAgeMs 为 0/undefined 表示不设限。
 */
export async function pruneTtsCache(opts?: {
  maxBytes?: number;
  maxAgeMs?: number;
}): Promise<PruneResult> {
  const dir = ttsCacheDir();
  let entries: { file: string; size: number; mtimeMs: number }[] = [];
  try {
    const names = await fs.readdir(dir);
    const stats = await Promise.all(
      names
        .filter((n) => n.endsWith(".mp3"))
        .map(async (n) => {
          try {
            const s = await fs.stat(path.join(dir, n));
            return { file: path.join(dir, n), size: s.size, mtimeMs: s.mtimeMs };
          } catch {
            return null;
          }
        }),
    );
    entries = stats.filter(
      (s): s is { file: string; size: number; mtimeMs: number } => s !== null,
    );
  } catch {
    return { freedBytes: 0, files: 0, kept: 0 };
  }

  entries.sort((a, b) => a.mtimeMs - b.mtimeMs); // 最旧在前

  const maxBytes = opts?.maxBytes ?? 3 * 1024 * 1024 * 1024;
  const maxAgeMs = opts?.maxAgeMs ?? 48 * 3600 * 1000;
  const now = Date.now();

  let total = entries.reduce((s, e) => s + e.size, 0);
  let freed = 0;
  let removed = 0;

  for (const e of entries) {
    const tooBig = maxBytes > 0 && total > maxBytes;
    const tooOld = maxAgeMs > 0 && now - e.mtimeMs > maxAgeMs;
    if (!tooBig && !tooOld) break;
    try {
      await fs.unlink(e.file);
      total -= e.size;
      freed += e.size;
      removed += 1;
    } catch {
      /* ignore — 文件可能已被并发删除 */
    }
  }

  return { freedBytes: freed, files: removed, kept: entries.length - removed };
}

/** 当前缓存目录总字节数与文件数（供 health-check 巡检）。 */
export async function ttsCacheStats(): Promise<{
  bytes: number;
  files: number;
}> {
  try {
    const names = await fs.readdir(ttsCacheDir());
    const stats = await Promise.all(
      names
        .filter((n) => n.endsWith(".mp3"))
        .map(async (n) => {
          try {
            const s = await fs.stat(path.join(ttsCacheDir(), n));
            return s.size;
          } catch {
            return 0;
          }
        }),
    );
    return { bytes: stats.reduce((a, b) => a + b, 0), files: stats.length };
  } catch {
    return { bytes: 0, files: 0 };
  }
}
