/**
 * UX-V4 P0 — Focus Mode session store (container, not cage).
 * Opt-in 20-minute focus; early end allowed; records for Me hub.
 */

import { kvGet, kvSet } from "./browser-kv";

export const DEFAULT_FOCUS_MINUTES = 20;

export type FocusSessionActive = {
  accountId: string;
  startedAt: number;
  durationMs: number;
  /** Optional label of what they were focusing on */
  label?: string;
};

export type FocusSessionRecord = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  completed: boolean;
  turns?: number;
  label?: string;
};

const ACTIVE_KEY = "spark.focusSession.active";
const RECORDS_PREFIX = "spark.focusSession.records.";
const MAX_RECORDS = 30;

export function focusRecordsKey(accountId: string): string {
  return `${RECORDS_PREFIX}${accountId || "default"}`;
}

export function startFocusSession(
  accountId: string,
  opts?: { minutes?: number; label?: string; now?: number },
): FocusSessionActive {
  const minutes = Math.max(1, Math.min(60, opts?.minutes ?? DEFAULT_FOCUS_MINUTES));
  const active: FocusSessionActive = {
    accountId,
    startedAt: opts?.now ?? Date.now(),
    durationMs: minutes * 60_000,
    label: opts?.label?.slice(0, 80),
  };
  kvSet(ACTIVE_KEY, JSON.stringify(active));
  return active;
}

export function loadActiveFocusSession(): FocusSessionActive | null {
  const raw = kvGet(ACTIVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FocusSessionActive>;
    if (!parsed?.accountId || !parsed.startedAt || !parsed.durationMs) return null;
    return {
      accountId: String(parsed.accountId),
      startedAt: Number(parsed.startedAt),
      durationMs: Number(parsed.durationMs),
      label: parsed.label ? String(parsed.label).slice(0, 80) : undefined,
    };
  } catch {
    return null;
  }
}

export function clearActiveFocusSession(): void {
  kvSet(ACTIVE_KEY, "");
}

export function focusRemainingMs(
  active: FocusSessionActive,
  now = Date.now(),
): number {
  const end = active.startedAt + active.durationMs;
  return Math.max(0, end - now);
}

export function focusProgress(
  active: FocusSessionActive,
  now = Date.now(),
): number {
  if (active.durationMs <= 0) return 1;
  const elapsed = Math.max(0, now - active.startedAt);
  return Math.min(1, elapsed / active.durationMs);
}

export function isFocusExpired(
  active: FocusSessionActive,
  now = Date.now(),
): boolean {
  return focusRemainingMs(active, now) <= 0;
}

function loadRecords(accountId: string): FocusSessionRecord[] {
  const raw = kvGet(focusRecordsKey(accountId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as FocusSessionRecord[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

function saveRecords(accountId: string, records: FocusSessionRecord[]): void {
  kvSet(focusRecordsKey(accountId), JSON.stringify(records.slice(0, MAX_RECORDS)));
}

export function recentFocusRecords(
  accountId: string,
  limit = 5,
): FocusSessionRecord[] {
  return loadRecords(accountId).slice(0, Math.max(1, limit));
}

export type FocusEndResult = {
  record: FocusSessionRecord;
  summaryLine: string;
};

/**
 * End the active session (complete or early). Writes a Me-hub record.
 * Returns null if no matching active session.
 */
export function endFocusSession(
  accountId: string,
  opts?: { turns?: number; now?: number; forceComplete?: boolean },
): FocusEndResult | null {
  const active = loadActiveFocusSession();
  if (!active || active.accountId !== accountId) return null;
  const now = opts?.now ?? Date.now();
  const elapsed = Math.max(0, now - active.startedAt);
  const completed =
    opts?.forceComplete === true || elapsed >= active.durationMs * 0.85;
  const record: FocusSessionRecord = {
    startedAt: active.startedAt,
    endedAt: now,
    durationMs: Math.min(elapsed, active.durationMs),
    completed,
    turns: opts?.turns,
    label: active.label,
  };
  const prev = loadRecords(accountId);
  saveRecords(accountId, [record, ...prev]);
  clearActiveFocusSession();
  const mins = Math.max(1, Math.round(record.durationMs / 60_000));
  const turns = opts?.turns ?? 0;
  const summaryLine = completed
    ? turns > 0
      ? `Focus complete — ${mins} min, ${turns} turn${turns === 1 ? "" : "s"}. Nice stretch.`
      : `Focus complete — you stayed with it for ${mins} minute${mins === 1 ? "" : "s"}.`
    : `Focus ended early after ${mins} min — still counts as practice showing up.`;
  return { record, summaryLine };
}

/** Count completed focus sessions in the last 7 days. */
export function focusSessionsThisWeek(
  accountId: string,
  now = Date.now(),
): number {
  const weekStart = now - 7 * 86_400_000;
  return loadRecords(accountId).filter(
    (r) => r.completed && r.endedAt >= weekStart,
  ).length;
}
