/**
 * Per-account LLM usage & cost tracking (server-side, JSON-backed).
 *
 * Records every tutor turn's approximate token usage per account and exposes
 * daily / monthly rollups for the admin usage panel. Cost estimates use a
 * conservative $/1K-token rate so families can see spend at a glance.
 *
 * Data dir is overridable via SPARK_DATA_DIR (tests inject an isolated dir).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { lockedWriteJson } from "./file-lock";

export type UsageRecord = {
  date: string; // YYYY-MM-DD
  accountId: string;
  turns: number;
  /** Approximate input tokens (prompt chars / 4). */
  inputTokens: number;
  /** Approximate output tokens (response chars / 4). */
  outputTokens: number;
  /** Estimated USD cost for this record. */
  costUsd: number;
};

export type UsageSummary = {
  records: UsageRecord[];
  totals: {
    turns: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
};

const COST_PER_1K_INPUT = 0.0003; // conservative blended $/1K input tokens
const COST_PER_1K_OUTPUT = 0.0006; // conservative blended $/1K output tokens

function usageDir(): string {
  return process.env.SPARK_DATA_DIR
    ? path.resolve(process.env.SPARK_DATA_DIR)
    : path.join(process.cwd(), "data");
}
function usageFile(): string {
  return path.join(usageDir(), "usage", "usage.json");
}

function todayKey(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function estimateTokens(chars: number): number {
  return Math.max(1, Math.round(chars / 4));
}

export async function readUsage(): Promise<UsageRecord[]> {
  try {
    const raw = await fs.readFile(usageFile(), "utf8");
    const parsed = JSON.parse(raw) as UsageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Record one tutor turn. Merges into the same (date, account) bucket so the
 * file stays small and the admin panel can roll up per day / per account.
 */
export async function recordUsage(input: {
  accountId: string;
  inputChars: number;
  outputChars: number;
}): Promise<UsageRecord> {
  const accountId = (input.accountId || "default")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 40);
  const date = todayKey();
  const inputTokens = estimateTokens(input.inputChars);
  const outputTokens = estimateTokens(input.outputChars);
  const costUsd =
    (inputTokens / 1000) * COST_PER_1K_INPUT +
    (outputTokens / 1000) * COST_PER_1K_OUTPUT;

  const records = await readUsage();
  const existing = records.find(
    (r) => r.date === date && r.accountId === accountId,
  );
  if (existing) {
    existing.turns += 1;
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
    existing.costUsd += costUsd;
  } else {
    records.push({
      date,
      accountId,
      turns: 1,
      inputTokens,
      outputTokens,
      costUsd,
    });
  }

  // Keep only the last 370 days to bound file size.
  const cutoff = Date.now() - 370 * 24 * 3600 * 1000;
  const kept = records.filter(
    (r) => new Date(`${r.date}T00:00:00`).getTime() >= cutoff,
  );
  await lockedWriteJson(usageFile(), kept);
  return existing ?? records[records.length - 1];
}

/** Roll up records into per-account totals (all time) plus the last 30 days. */
export async function getUsageSummary(): Promise<{
  allTime: UsageSummary;
  last30d: UsageSummary;
  byAccount: Array<UsageRecord & { lastActive: string }>;
}> {
  const records = await readUsage();
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;

  const sum = (list: UsageRecord[]): UsageSummary["totals"] =>
    list.reduce(
      (acc, r) => ({
        turns: acc.turns + r.turns,
        inputTokens: acc.inputTokens + r.inputTokens,
        outputTokens: acc.outputTokens + r.outputTokens,
        costUsd: acc.costUsd + r.costUsd,
      }),
      { turns: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    );

  const last30 = records.filter(
    (r) => new Date(`${r.date}T00:00:00`).getTime() >= cutoff,
  );

  const byAccountMap = new Map<string, UsageRecord & { lastActive: string }>();
  for (const r of records) {
    const cur = byAccountMap.get(r.accountId);
    if (!cur) {
      byAccountMap.set(r.accountId, { ...r, lastActive: r.date });
    } else {
      cur.turns += r.turns;
      cur.inputTokens += r.inputTokens;
      cur.outputTokens += r.outputTokens;
      cur.costUsd += r.costUsd;
      if (r.date > cur.lastActive) cur.lastActive = r.date;
    }
  }

  return {
    allTime: { records, totals: sum(records) },
    last30d: { records: last30, totals: sum(last30) },
    byAccount: [...byAccountMap.values()].sort(
      (a, b) => b.costUsd - a.costUsd,
    ),
  };
}
