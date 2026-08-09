/**
 * CA-1 — Whole-page worksheet planner.
 * Agent emits ~~~worksheet-plan fences; client parses, strips, and shows progress.
 */

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

  // Ensure one active item matches current when possible
  const hasActive = items.some((i) => i.status === "active");
  if (!hasActive) {
    const hit = items.find((i) => i.id === current);
    if (hit) hit.status = "active";
  } else {
    const active = items.find((i) => i.status === "active");
    if (active) current = active.id;
  }

  return {
    total: resolvedTotal,
    current,
    items,
    source: "agent",
    updatedAt: now,
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
