import { promises as fs } from "node:fs";
import path from "node:path";

/** In-process per-file write queue to serialize concurrent writes. */
const pendingWrites = new Map<string, Promise<void>>();

/** Write JSON to tmp file + atomic rename. Readers never see partial content. */
async function atomicWrite(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  const json = JSON.stringify(data, null, 2);
  try {
    await fs.writeFile(tmpPath, json, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Queue writes to the same file path so concurrent PUTs don't interleave.
 * Last writer wins (no merge). Prevents partial/corrupt JSON.
 */
export async function lockedWriteJson(filePath: string, data: unknown): Promise<void> {
  const prev = pendingWrites.get(filePath) ?? Promise.resolve();
  const next = prev
    .then(() => atomicWrite(filePath, data))
    .catch((err) => {
      console.error(`[Spark] Failed to write ${filePath}:`, err);
      throw err;
    })
    .finally(() => {
      if (pendingWrites.get(filePath) === next) {
        pendingWrites.delete(filePath);
      }
    });
  pendingWrites.set(filePath, next);
  await next;
}
