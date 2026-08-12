/**
 * Client-safe journal types + Timeline helpers (no Node fs).
 */

export type JournalMadeBlock = {
  kind: string;
  creationId?: string;
  title: string;
  style?: string;
  bodySnapshot: string;
  mediaId?: string;
  audioMediaId?: string;
  at: number;
};

export type JournalEntry = {
  id: string;
  accountId: string;
  date: string;
  createdAt: number;
  updatedAt: number;
  title?: string;
  body: string;
  prompt?: string;
  source: "student" | "creation" | "mixed";
  made: JournalMadeBlock[];
  writingType?: string;
};

export function localDay(ms: number = Date.now()): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isValidDay(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function journalPromptForGrade(grade?: number): string {
  if (!grade || grade <= 4) {
    return "What is one thing you noticed on the way home?";
  }
  if (grade <= 8) {
    return "What felt unfair or kind today — what happened first?";
  }
  return "What did you almost not say out loud?";
}

export type TimelineDay = {
  date: string;
  year: string;
  month: string;
  entries: JournalEntry[];
};

/** Facebook-style: group related records by day, newest first. */
export function buildTimeline(items: JournalEntry[]): TimelineDay[] {
  const byDate = new Map<string, JournalEntry[]>();
  for (const e of items) {
    const list = byDate.get(e.date) || [];
    list.push(e);
    byDate.set(e.date, list);
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return dates.map((date) => {
    const entries = (byDate.get(date) || []).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    return {
      date,
      year: date.slice(0, 4),
      month: date.slice(0, 7),
      entries,
    };
  });
}

export function timelineMonths(days: TimelineDay[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of days) {
    if (!seen.has(d.month)) {
      seen.add(d.month);
      out.push(d.month);
    }
  }
  return out;
}

export function timelineYears(days: TimelineDay[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of days) {
    if (!seen.has(d.year)) {
      seen.add(d.year);
      out.push(d.year);
    }
  }
  return out;
}
