/** In-memory Code Agent run buffer — survives client SSE disconnect. */

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

const runs = new Map<string, ConsoleRunRecord>();
const sessionActive = new Map<string, string>();

function prune(): void {
  const now = Date.now();
  for (const [id, run] of runs) {
    const anchor = run.finishedAt ?? run.startedAt;
    if (run.status !== "running" && now - anchor > TTL_MS) {
      runs.delete(id);
      if (sessionActive.get(run.sessionId) === id) sessionActive.delete(run.sessionId);
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

/** Test-only reset */
export function __resetConsoleRunStoreForTests(): void {
  runs.clear();
  sessionActive.clear();
}
