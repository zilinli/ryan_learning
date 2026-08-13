/**
 * V3 — server-side interest profile store (cross-device continuity).
 * Mirrors learning-memory-store: "acct_ryan"/"default" share one file,
 * other accounts get their own file under data/interests/.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { lockedWriteJson } from "./file-lock";
import {
  mergeInterests,
  type InterestRecord,
} from "./interest-store";

const DATA_DIR = path.join(process.cwd(), "data");
const INTEREST_DIR = path.join(DATA_DIR, "interests");
const DEFAULT_FILE = path.join(DATA_DIR, "interests-default.json");

/** Map client accountId → server storage. "acct_ryan" → "default" for backward compat. */
function toServerId(clientId: string): string {
  if (clientId === "acct_ryan" || clientId === "default") return "default";
  return clientId;
}

function fileForAccount(accountId: string): string {
  const canonical = toServerId(accountId);
  if (canonical === "default") return DEFAULT_FILE;
  return path.join(INTEREST_DIR, `${canonical}.json`);
}

export async function readServerInterests(
  accountId: string = "default",
): Promise<InterestRecord[]> {
  try {
    const file = fileForAccount(accountId);
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed as { interests?: unknown })?.interests;
    return Array.isArray(arr) ? (arr as InterestRecord[]) : [];
  } catch {
    return [];
  }
}

export async function writeServerInterests(
  records: InterestRecord[],
  accountId: string = "default",
): Promise<InterestRecord[]> {
  await fs.mkdir(INTEREST_DIR, { recursive: true });
  const file = fileForAccount(accountId);
  const normalized = (records || []).slice(0, 12);
  await lockedWriteJson(file, {
    interests: normalized,
    updatedAt: Date.now(),
  });
  return normalized;
}

/** Merge incoming client interests into the server snapshot (union). */
export async function upsertServerInterests(
  incoming: InterestRecord[],
  accountId: string = "default",
): Promise<InterestRecord[]> {
  const current = await readServerInterests(accountId);
  const merged = mergeInterests(current, incoming);
  return writeServerInterests(merged, accountId);
}
