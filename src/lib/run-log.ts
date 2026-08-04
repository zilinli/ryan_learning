import { promises as fs } from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "agent-runs.jsonl");

export interface RunLogEntry {
  timestamp: string;       // ISO 8601
  sessionId: string;
  agentId: string;
  runId: string;
  status: "completed" | "error" | "cancelled" | "timeout";
  durationMs: number;
  model?: string;
  errorMessage?: string;
  retryCount?: number;
}

export async function appendRunLog(entry: RunLogEntry): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  await fs.appendFile(LOG_FILE, line, "utf8");
}

export async function getLastRun(agentId: string): Promise<RunLogEntry | null> {
  try {
    const content = await fs.readFile(LOG_FILE, "utf8");
    const lines = content.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as RunLogEntry;
        if (entry.agentId === agentId) return entry;
      } catch { continue; }
    }
  } catch { /* file doesn't exist yet */ }
  return null;
}

export async function getRecentRuns(limit: number = 50): Promise<RunLogEntry[]> {
  try {
    const content = await fs.readFile(LOG_FILE, "utf8");
    const lines = content.trim().split("\n");
    return lines.slice(-limit).map(l => JSON.parse(l) as RunLogEntry);
  } catch {
    return [];
  }
}

export async function getErrorRate(windowMinutes: number = 60): Promise<{ total: number; errors: number; rate: number }> {
  const runs = await getRecentRuns(500);
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const recent = runs.filter(r => new Date(r.timestamp).getTime() > cutoff);
  const errors = recent.filter(r => r.status === "error").length;
  return {
    total: recent.length,
    errors,
    rate: recent.length > 0 ? errors / recent.length : 0,
  };
}
