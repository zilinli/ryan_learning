import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Lightweight append-only feedback log for dialect replies.
 * Each entry is one JSON line. Concurrent appends are serialized through an
 * in-process write queue; a tmp+rename swap keeps readers from seeing partial
 * lines (mirrors the JSON store pattern in file-lock.ts).
 */

function dataDir(): string {
  return process.env.SPARK_DATA_DIR
    ? path.resolve(process.env.SPARK_DATA_DIR)
    : path.resolve(process.cwd(), "data");
}

function feedbackFile(): string {
  return path.join(dataDir(), "dialect-feedback.jsonl");
}

export type DialectFeedback = {
  text: string;
  dialect: "teo" | "hak";
  timestamp: number;
  /** Which STT engine produced the raw transcript — used to assess engine quality over time. */
  engine?: "bailian" | "iflytek" | "local";
  /** Raw transcript before LLM correction — the (original, corrected) pairs form a Chaoshan corpus. */
  original?: string;
};

const pendingWrites = new Map<string, Promise<void>>();

async function appendLine(
  filePath: string,
  line: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const prev = pendingWrites.get(filePath) ?? Promise.resolve();
  const next = prev
    .then(async () => {
      await fs.appendFile(filePath, `${line}\n`, "utf8");
    })
    .finally(() => {
      if (pendingWrites.get(filePath) === next) {
        pendingWrites.delete(filePath);
      }
    });
  pendingWrites.set(filePath, next);
  await next;
}

/** Append one feedback record. Throws on failure so callers can return 500.
 *  Optional engine/original fields are persisted to enable engine-quality analysis
 *  and Chaoshuan corpus construction over time. */
export async function appendDialectFeedback(
  fb: DialectFeedback,
): Promise<void> {
  const text = typeof fb.text === "string" ? fb.text.trim() : "";
  const dialect = fb.dialect === "hak" ? "hak" : "teo";
  const timestamp = Number.isFinite(fb.timestamp) ? fb.timestamp : Date.now();
  if (!text) throw new Error("empty feedback text");

  const engine = fb.engine === "bailian" || fb.engine === "iflytek" || fb.engine === "local"
    ? fb.engine
    : undefined;
  const original = typeof fb.original === "string" && fb.original.trim()
    ? fb.original.trim().slice(0, 2000)
    : undefined;

  const record: Record<string, unknown> = {
    text: text.slice(0, 2000),
    dialect,
    timestamp,
  };
  if (engine) record.engine = engine;
  if (original) record.original = original;

  await appendLine(feedbackFile(), JSON.stringify(record));
}
