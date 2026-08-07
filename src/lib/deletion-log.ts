import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "deletions");
const TTL_MS = 30 * 86400 * 1000; // 30 days

function filePath(accountId: string): string {
  const safe = accountId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DIR, `${safe}.json`);
}

async function ensureDir() { await fs.mkdir(DIR, { recursive: true }); }

export async function readDeletionLog(
  accountId: string,
): Promise<Record<string, number>> {
  try {
    await ensureDir();
    const raw = await fs.readFile(filePath(accountId), "utf-8");
    const obj = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const pruned: Record<string, number> = {};
    let changed = false;
    for (const [sid, ts] of Object.entries(obj)) {
      if (typeof ts === "number" && now - ts < TTL_MS) {
        pruned[sid] = ts;
      } else {
        changed = true;
      }
    }
    if (changed && Object.keys(pruned).length > 0) {
      await fs.writeFile(filePath(accountId), JSON.stringify(pruned), "utf-8");
    } else if (changed) {
      try { await fs.unlink(filePath(accountId)); } catch {}
    }
    return pruned;
  } catch {
    return {};
  }
}

export async function writeTombstone(
  sessionId: string,
  accountId: string,
): Promise<void> {
  await ensureDir();
  const log = await readDeletionLog(accountId);
  log[sessionId] = Date.now();
  await fs.writeFile(filePath(accountId), JSON.stringify(log), "utf-8");
}

export function getDeletionLogTTL(): number { return TTL_MS; }
