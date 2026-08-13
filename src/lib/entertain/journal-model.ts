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
  /**
   * Lightweight peer praise on the Everyone wall (V2 §9.4.3): a like and an
   * optional one-line note. No leaderboards — just encouragement.
   */
  praise?: JournalPraise;
  /** Author display name, injected only by the scope=all aggregation endpoint. */
  authorName?: string;
};

export type JournalPraise = {
  count: number;
  notes: Array<{
    accountId: string;
    name?: string;
    note?: string;
    at: number;
  }>;
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

/** Topic key for merging related records: normalized title, else first body line. */
export function topicKey(
  e: Pick<JournalEntry, "title" | "body" | "made">,
): string {
  const t = (e.title || "").trim().toLowerCase();
  if (t) return t;
  const first = e.body
    .trim()
    .split(/\n/)[0]
    ?.slice(0, 72)
    .trim()
    .toLowerCase();
  if (first) return first;
  const m = e.made?.[0];
  if (m?.title) return m.title.trim().toLowerCase();
  return "";
}

/**
 * Merge same-topic rows (matching title) so a journal entry and its related
 * creations stay adjacent even when a creation was recorded as its own row.
 * Only "made-only" rows (no prose) are absorbed into a matching prose row;
 * distinct prose rows are kept separate.
 */
export function mergeSameTopicEntries(entries: JournalEntry[]): JournalEntry[] {
  const groups = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const key = topicKey(e) || `__id__${e.id}`;
    const list = groups.get(key) || [];
    list.push(e);
    groups.set(key, list);
  }
  const out: JournalEntry[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      out.push(list[0]!);
      continue;
    }
    const madeOnly = list.filter((e) => !e.body.trim() && e.made.length > 0);
    if (madeOnly.length === 0) {
      out.push(...list);
      continue;
    }
    const anchor = list.find((e) => e.body.trim()) || madeOnly[0]!;
    const made = [...anchor.made];
    const seen = new Set(made.map((m) => m.creationId || `${m.kind}:${m.at}`));
    for (const e of list) {
      if (e === anchor) continue;
      for (const m of e.made) {
        const k = m.creationId || `${m.kind}:${m.at}`;
        if (!seen.has(k)) {
          seen.add(k);
          made.push(m);
        }
      }
    }
    const merged: JournalEntry = {
      ...anchor,
      made,
      updatedAt: list.reduce(
        (mx, e) => Math.max(mx, e.updatedAt),
        anchor.updatedAt,
      ),
      title: anchor.title || list[0]?.title,
      source: anchor.body.trim()
        ? made.length > 0
          ? "mixed"
          : "student"
        : made.length > 0
          ? "creation"
          : "student",
    };
    out.push(merged);
  }
  return out;
}

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
    const entries = mergeSameTopicEntries(byDate.get(date) || []).sort(
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
