/**
 * Studio is a first-class route (`/studio`), not a query on Entertainments.
 */

const KEEP = ["game", "journal", "writingType", "date"] as const;

export function studioHref(
  opts?: Partial<Record<(typeof KEEP)[number], string | null | undefined>>,
): string {
  const q = new URLSearchParams();
  for (const key of KEEP) {
    const v = opts?.[key]?.trim();
    if (v) q.set(key, v);
  }
  const s = q.toString();
  return s ? `/studio?${s}` : "/studio";
}

/** Old `/entertain?hub=studio&…` → `/studio?…` (drops hub). */
export function rewriteEntertainStudioSearch(search: string): string | null {
  const q = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (q.get("hub") !== "studio") return null;
  q.delete("hub");
  const next = new URLSearchParams();
  for (const key of KEEP) {
    const v = q.get(key);
    if (v) next.set(key, v);
  }
  const s = next.toString();
  return s ? `/studio?${s}` : "/studio";
}
