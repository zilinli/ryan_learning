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
const LEARNING_DIR = path.join(DATA_DIR, "learning");
const DEFAULT_FILE = path.join(DATA_DIR, "learning-memory.json");

async function ensureDir(): Promise<void> {
  await fs.mkdir(LEARNING_DIR, { recursive: true });
}

function fileForAccount(accountId: string): string {
  const canonical = toServerId(accountId);
  if (canonical === "default") return DEFAULT_FILE;
  return path.join(LEARNING_DIR, `${canonical}.json`);
}

/** Map client accountId → server storage. "acct_ryan" → "default" for backward compat. */
function toServerId(clientId: string): string {
  if (clientId === "acct_ryan" || clientId === "default") return "default";
  return clientId;
}

export async function readServerLearningMemory(accountId: string = "default"): Promise<LearningMemory> {
  try {
    const file = fileForAccount(accountId);
    const raw = await fs.readFile(file, "utf8");
    return normalizeMemory(JSON.parse(raw) as Partial<LearningMemory>);
  } catch {
    return emptyLearningMemory();
  }
}

export async function writeServerLearningMemory(
  mem: LearningMemory,
  accountId: string = "default",
): Promise<LearningMemory> {
  await ensureDir();
  const file = fileForAccount(accountId);
  const normalized = normalizeMemory(mem);
  normalized.updatedAt = normalized.updatedAt || Date.now();
  await lockedWriteJson(file, normalized);
  return normalized;
}

/** Merge client snapshot into server file (union topics). */
export async function upsertServerLearningMemory(
  incoming: LearningMemory,
  accountId: string = "default",
): Promise<LearningMemory> {
  const current = await readServerLearningMemory(accountId);
  const merged = mergeLearningMemory(current, normalizeMemory(incoming));
  return writeServerLearningMemory(merged, accountId);
}
