/**
 * CA-1 — Whole-page worksheet planner.
 * Agent emits ~~~worksheet-plan fences; client parses, strips, and shows progress.
 */

import type { SubjectKey } from "./dashboard-stats";

export type WorksheetItemStatus = "pending" | "active" | "done" | "skipped";

export type WorksheetItem = {
  id: number;
  label: string;
  status: WorksheetItemStatus;
};

export type WorksheetPlan = {
  total: number;
  current: number;
  items: WorksheetItem[];
  source: "agent";
  updatedAt: number;
  /** Inferred subject for this worksheet (lightweight heuristic from question labels) */
  subject?: SubjectKey;
};

const FENCE_RE =
  /~~~worksheet-plan\s*\n([\s\S]*?)\n~~~/gi;

const STATUSES = new Set<WorksheetItemStatus>([
  "pending",
  "active",
  "done",
  "skipped",
]);

function normalizeStatus(raw: unknown): WorksheetItemStatus {
  if (typeof raw === "string" && STATUSES.has(raw as WorksheetItemStatus)) {
    return raw as WorksheetItemStatus;
  }
  return "pending";
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Lightweight subject inference from question labels (keyword heuristics). */
function inferSubjectFromLabels(labels: string[]): SubjectKey | undefined {
  if (!labels.length) return undefined;
  const joined = labels.join(" ").toLowerCase();
  const hints: [RegExp, SubjectKey][] = [
    [/\b(solve|x\s*=|equation|algebra|graph|slope|y-intercept|slope|polynomial|quadratic|integral|derivative|geometry|angle|triangle|circle|volume|area|perimeter|probability|statistics|mean|median|function|vector|matrix|logarithm|exponent|trigonomet)\b/i, "math"],
    [/\b(gravity|force|energy|atom|molecule|cell|organism|photosynthesis|evolution|dna|gene|ecosystem|climate|weather|element|compound|acid|reaction|physics|chemistry|biology|scientific|experiment|hypothesis|law of|newton|motion|velocity|acceleration|wave|electric|magnetic|nuclear)\b/i, "science"],
    [/\b(essay|paragraph|thesis|claim|evidence|cite|quote|passage|chapter|theme|character|plot|setting|author|poem|metaphor|simile|symbol|tone|mood|summary|infer|context|clue|vocabulary|define|grammar|spelling|punctuation|sentence|clause|writing prompt|reading comprehension)\b/i, "ela"],
    [/\b(history|civilization|war|revolution|government|economy|trade|culture|geography|map|country|continent|empire|colony|president|king|ancient|medieval|modern|timeline|primary source|civics|constitution|rights|amendment|democracy|political)\b/i, "humanities"],
    [/\b(翻译|translate|vocabulary|grammar|tense|verb|noun|adjective|conversation|dialogue|accent|pronunciation|pinyin|stroke|character|中文|espa.ol|francais|deutsch)\b/i, "language"],
  ];
  for (const [regex, subject] of hints) {
    if (regex.test(joined)) return subject;
  }
  return undefined;
}

/** Parse a single JSON body into a plan, or null if invalid. */
export function planFromJson(
  raw: unknown,
  now = Date.now(),
): WorksheetPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const itemsRaw = o.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) return null;

  const items: WorksheetItem[] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== "object") continue;
    const row = it as Record<string, unknown>;
    const id = Number(row.id);
    if (!Number.isFinite(id) || id < 1) continue;
    const label =
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : `Q${id}`;
    items.push({ id: Math.floor(id), label, status: normalizeStatus(row.status) });
  }
  if (!items.length) return null;

  const total = clampInt(
    Number(o.total ?? items.length),
    1,
    Math.max(items.length, Number(o.total) || items.length),
  );
  // Prefer explicit total when larger than items (agent may list partially)
  const resolvedTotal = Math.max(total, items.length);
  let current = clampInt(Number(o.current ?? 1), 1, resolvedTotal);

  // Ensure one active item matches current when possible (skip if worksheet finished)
  const hasActive = items.some((i) => i.status === "active");
  const allTerminal = items.every(
    (i) => i.status === "done" || i.status === "skipped",
  );
  if (!hasActive && !allTerminal) {
    const hit = items.find((i) => i.id === current);
    if (hit) hit.status = "active";
  } else if (hasActive) {
    const active = items.find((i) => i.status === "active");
    if (active) current = active.id;
  }

  // Try agent-provided subject first, then heuristic from question labels
  let subject: SubjectKey | undefined;
  if (
    typeof o.subject === "string" &&
    ["math", "science", "ela", "humanities", "language", "general"].includes(
      o.subject,
    )
  ) {
    subject = o.subject as SubjectKey;
  } else {
    subject = inferSubjectFromLabels(items.map((i) => i.label));
  }

  return {
    total: resolvedTotal,
    current,
    items,
    source: "agent",
    updatedAt: now,
    subject,
  };
}

/** Last fence in text wins. */
export function parseWorksheetPlanFence(
  text: string,
  now = Date.now(),
): WorksheetPlan | null {
  if (!text) return null;
  let last: WorksheetPlan | null = null;
  const re = new RegExp(FENCE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = m[1]?.trim();
    if (!body) continue;
    try {
      const parsed = planFromJson(JSON.parse(body), now);
      if (parsed) last = parsed;
    } catch {
      // ignore bad JSON
    }
  }
  return last;
}

/** Remove all worksheet-plan fences for display. */
export function stripWorksheetPlanFence(text: string): string {
  if (!text) return text;
  return text
    .replace(FENCE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function formatProgressLabel(plan: Pick<WorksheetPlan, "current" | "total">): string {
  const current = clampInt(plan.current, 1, Math.max(1, plan.total));
  const total = Math.max(1, plan.total);
  return `Question ${current} of ${total}`;
}

export function mergeWorksheetPlan(
  prev: WorksheetPlan | null | undefined,
  next: WorksheetPlan | null,
): WorksheetPlan | null {
  if (!next) return prev ?? null;
  if (!prev) return next;
  // Newer agent emission always wins
  return next.updatedAt >= prev.updatedAt ? next : prev;
}

/** True when every listed item is done/skipped, or current past total. */
export function isWorksheetComplete(plan: WorksheetPlan | null | undefined): boolean {
  if (!plan?.items?.length) return false;
  const allTerminal = plan.items.every(
    (i) => i.status === "done" || i.status === "skipped",
  );
  if (allTerminal) return true;
  return plan.current > plan.total;
}

export function formatProgressLabelOrDone(plan: WorksheetPlan): string {
  if (isWorksheetComplete(plan)) {
    return `All done · ${plan.total} questions`;
  }
  return formatProgressLabel(plan);
}
