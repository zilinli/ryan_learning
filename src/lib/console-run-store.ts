/** In-memory Code Agent run buffer — survives client SSE disconnect. */

import { promises as fs, rmSync } from "node:fs";
import path from "node:path";

export type ConsoleRunStatus = "running" | "done" | "error";

export type ConsoleRunEvent = {
  id: number;
  event: string;
  data: unknown;
  at: number;
};

export type ConsoleRunRecord = {
  runId: string;
  sessionId: string;
  status: ConsoleRunStatus;
  events: ConsoleRunEvent[];
  fullText: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

export type ConsoleRunSnapshot = {
  runId: string;
  sessionId: string;
  status: ConsoleRunStatus;
  fullText: string;
  error?: string;
  lastEventId: number;
  startedAt: number;
  finishedAt?: number;
};

const MAX_EVENTS = 2_000;
const TTL_MS = 30 * 60 * 1_000;

const RUNS_DIR = path.join(process.cwd(), "data", "console", "runs");
const PERSIST_DEBOUNCE_MS = 500;

const runs = new Map<string, ConsoleRunRecord>();
const sessionActive = new Map<string, string>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Persist one run to disk atomically (best-effort; never throws). */
async function persistRun(runId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run) return;
  try {
    await fs.mkdir(RUNS_DIR, { recursive: true });
    const fp = path.join(RUNS_DIR, `${runId}.json`);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(run), "utf8");
    await fs.rename(tmp, fp);
  } catch {
    /* best effort — in-memory remains authoritative */
  }
}

function schedulePersist(runId: string): void {
  const existing = persistTimers.get(runId);
  if (existing) clearTimeout(existing);
  persistTimers.set(
    runId,
    setTimeout(() => {
      persistTimers.delete(runId);
      void persistRun(runId);
    }, PERSIST_DEBOUNCE_MS),
  );
}

function persistNow(runId: string): void {
  const existing = persistTimers.get(runId);
  if (existing) {
    clearTimeout(existing);
    persistTimers.delete(runId);
  }
  void persistRun(runId);
}

/** Load persisted runs after a crash/restart. Running runs become errored. */
export async function loadPersistedRuns(): Promise<void> {
  try {
    const files = await fs.readdir(RUNS_DIR);
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith(".json") || f.endsWith(".tmp")) continue;
      const runId = f.slice(0, -".json".length);
      try {
        const rec = JSON.parse(
          await fs.readFile(path.join(RUNS_DIR, f), "utf8"),
        ) as ConsoleRunRecord;
        if (rec?.runId !== runId) continue;
        if (rec.status === "running") {
          rec.status = "error";
          rec.error = "任务因服务重启中断，未完成 — 请重新发送。";
          rec.finishedAt = now;
        }
        if (now - (rec.finishedAt ?? rec.startedAt) > TTL_MS) {
          void fs.rm(path.join(RUNS_DIR, f), { force: true }).catch(() => {});
          continue;
        }
        runs.set(rec.runId, rec);
        const prev = sessionActive.get(rec.sessionId);
        if (!prev || (runs.get(prev)?.startedAt ?? 0) < rec.startedAt) {
          sessionActive.set(rec.sessionId, rec.runId);
        }
      } catch {
        /* skip corrupt file */
      }
    }
  } catch {
    /* no directory yet — fine */
  }
}
void loadPersistedRuns();

function prune(): void {
  const now = Date.now();
  for (const [id, run] of runs) {
    const anchor = run.finishedAt ?? run.startedAt;
    if (run.status !== "running" && now - anchor > TTL_MS) {
      runs.delete(id);
      if (sessionActive.get(run.sessionId) === id) sessionActive.delete(run.sessionId);
      persistTimers.delete(id);
      void fs.rm(path.join(RUNS_DIR, `${id}.json`), { force: true }).catch(() => {});
    }
  }
}

export function createConsoleRun(sessionId: string): ConsoleRunRecord {
  prune();
  const runId = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const prev = sessionActive.get(sessionId);
  if (prev) {
    const old = runs.get(prev);
    if (old && old.status === "running") {
      old.status = "error";
      old.error = "Superseded by a newer run";
      old.finishedAt = Date.now();
      persistNow(prev);
    }
  }
  const rec: ConsoleRunRecord = {
    runId,
    sessionId,
    status: "running",
    events: [],
    fullText: "",
    startedAt: Date.now(),
  };
  runs.set(runId, rec);
  sessionActive.set(sessionId, runId);
  persistNow(runId);
  return rec;
}

export function appendConsoleRunEvent(
  runId: string,
  event: string,
  data: unknown,
): ConsoleRunEvent | null {
  const run = runs.get(runId);
  if (!run) return null;
  const ev: ConsoleRunEvent = {
    id: run.events.length + 1,
    event,
    data,
    at: Date.now(),
  };
  run.events.push(ev);
  if (run.events.length > MAX_EVENTS) {
    run.events.splice(0, run.events.length - MAX_EVENTS);
  }
  if (event === "delta" && data && typeof data === "object" && "text" in data) {
    const t = (data as { text?: unknown }).text;
    if (typeof t === "string") run.fullText += t;
  }
  if (event === "done" && data && typeof data === "object" && "text" in data) {
    const t = (data as { text?: unknown }).text;
    if (typeof t === "string" && t.length >= run.fullText.length) run.fullText = t;
  }
  if (run.status === "running") schedulePersist(runId);
  return ev;
}

export function finishConsoleRun(
  runId: string,
  status: Exclude<ConsoleRunStatus, "running">,
  opts?: { fullText?: string; error?: string },
): void {
  const run = runs.get(runId);
  if (!run) return;
  run.status = status;
  run.finishedAt = Date.now();
  if (opts?.fullText != null && opts.fullText.length >= run.fullText.length) {
    run.fullText = opts.fullText;
  }
  if (opts?.error) run.error = opts.error;
  persistNow(runId);
}

export function getConsoleRun(runId: string): ConsoleRunRecord | undefined {
  return runs.get(runId);
}

export function getActiveConsoleRun(sessionId: string): ConsoleRunRecord | undefined {
  const id = sessionActive.get(sessionId);
  if (!id) return undefined;
  const run = runs.get(id);
  if (!run) {
    sessionActive.delete(sessionId);
    return undefined;
  }
  return run;
}

export function consoleRunEventsAfter(runId: string, afterId: number): ConsoleRunEvent[] {
  const run = runs.get(runId);
  if (!run) return [];
  return run.events.filter((e) => e.id > afterId);
}

export function toConsoleRunSnapshot(run: ConsoleRunRecord): ConsoleRunSnapshot {
  return {
    runId: run.runId,
    sessionId: run.sessionId,
    status: run.status,
    fullText: run.fullText,
    error: run.error,
    lastEventId: run.events.length ? run.events[run.events.length - 1]!.id : 0,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

/** Test-only reset — clears memory and persisted run files. */
export function __resetConsoleRunStoreForTests(): void {
  for (const t of persistTimers.values()) clearTimeout(t);
  persistTimers.clear();
  runs.clear();
  sessionActive.clear();
  try {
    rmSync(RUNS_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** Test-only: clear memory but keep disk — simulates a process restart. */
export function __wipeMemoryForRestartTest(): void {
  for (const t of persistTimers.values()) clearTimeout(t);
  persistTimers.clear();
  runs.clear();
  sessionActive.clear();
}
