import { promises as fs } from "node:fs";
import path from "node:path";
import {
  emptyLearningMemory,
  mergeLearningMemory,
  normalizeMemory,
  type LearningMemory,
} from "./learning-memory";
import { lockedWriteJson } from "./file-lock";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "learning-memory.json");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readServerLearningMemory(): Promise<LearningMemory> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return normalizeMemory(JSON.parse(raw) as Partial<LearningMemory>);
  } catch {
    return emptyLearningMemory();
  }
}

export async function writeServerLearningMemory(
  mem: LearningMemory,
): Promise<LearningMemory> {
  await ensureDir();
  const normalized = normalizeMemory(mem);
  normalized.updatedAt = normalized.updatedAt || Date.now();
  await lockedWriteJson(FILE, normalized);
  return normalized;
}

/** Merge client snapshot into server file (union topics). */
export async function upsertServerLearningMemory(
  incoming: LearningMemory,
): Promise<LearningMemory> {
  const current = await readServerLearningMemory();
  const merged = mergeLearningMemory(current, normalizeMemory(incoming));
  return writeServerLearningMemory(merged);
}
