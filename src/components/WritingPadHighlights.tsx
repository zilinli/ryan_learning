"use client";

import { useMemo, type ReactNode } from "react";
import type { BasisDimensionId } from "@/lib/entertain/basis-writing";
import { openFixRanges, type WritingFixIssue } from "@/lib/entertain/basis-fix-session";

type Props = {
  draft: string;
  issues: WritingFixIssue[];
  activeId?: string | null;
  className?: string;
};

function markClass(dim: BasisDimensionId, active: boolean): string {
  const base =
    dim === "detail"
      ? "decoration-[var(--coral)]"
      : dim === "vocab"
        ? "decoration-[#c4a35a]"
        : dim === "grammar"
          ? "decoration-[var(--teal)]"
          : "decoration-[#5b7c99]";
  return `underline decoration-2 underline-offset-2 ${base} ${
    active ? "bg-[var(--coral)]/20" : "bg-[var(--coral)]/10"
  }`;
}

/** Read-only draft view with Grammarly-style underlines for open fix spans. */
export function WritingPadHighlights({
  draft,
  issues,
  activeId,
  className = "",
}: Props) {
  const ranges = useMemo(() => openFixRanges(issues), [issues]);

  const nodes = useMemo(() => {
    if (!draft) return null;
    if (!ranges.length) {
      return <span className="whitespace-pre-wrap">{draft}</span>;
    }
    const parts: ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    for (const r of ranges) {
      if (r.start < cursor) continue;
      if (r.start > cursor) {
        parts.push(
          <span key={`t_${key++}`} className="whitespace-pre-wrap">
            {draft.slice(cursor, r.start)}
          </span>,
        );
      }
      const slice = draft.slice(r.start, r.end);
      parts.push(
        <mark
          key={`m_${key++}`}
          className={`${markClass(r.dimension, r.id === activeId)} rounded-sm px-0.5`}
        >
          {slice}
        </mark>,
      );
      cursor = r.end;
    }
    if (cursor < draft.length) {
      parts.push(
        <span key={`t_${key++}`} className="whitespace-pre-wrap">
          {draft.slice(cursor)}
        </span>,
      );
    }
    return parts;
  }, [draft, ranges, activeId]);

  return (
    <div
      className={`rounded-lg border border-[var(--line)] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[var(--ink)] dark:bg-[#1f1c18] ${className}`}
      aria-label="Writing pad with issue highlights"
    >
      {nodes}
    </div>
  );
}
