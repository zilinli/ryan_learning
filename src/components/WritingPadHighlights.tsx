"use client";

import { useMemo, type ReactNode } from "react";
import type { BasisDimensionId } from "@/lib/entertain/basis-writing";
import { openFixRanges, type WritingFixIssue } from "@/lib/entertain/basis-fix-session";
import type { GrammarMatch } from "@/lib/entertain/languagetool";

type Props = {
  draft: string;
  issues?: WritingFixIssue[];
  grammarMatches?: GrammarMatch[];
  activeId?: string | null;
  activeGrammarKey?: string | null;
  onGrammarClick?: (match: GrammarMatch, key: string) => void;
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

function grammarClass(category: GrammarMatch["category"], active: boolean): string {
  const base =
    category === "spelling" || category === "typos"
      ? "decoration-[var(--coral)]"
      : category === "style"
        ? "decoration-[#c4a35a]"
        : "decoration-[var(--teal)]";
  return `underline decoration-wavy decoration-2 underline-offset-2 cursor-pointer ${base} ${
    active ? "bg-[var(--teal)]/25" : "bg-[var(--teal)]/10"
  }`;
}

type SpanRange = {
  start: number;
  end: number;
  kind: "fix" | "grammar";
  fixId?: string;
  dimension?: BasisDimensionId;
  grammar?: GrammarMatch;
  grammarKey?: string;
};

function grammarKeyOf(m: GrammarMatch, i: number): string {
  return `g_${m.ruleId}_${m.offset}_${m.length}_${i}`;
}

/** Read-only draft view with Grammarly-style underlines for spots + grammar. */
export function WritingPadHighlights({
  draft,
  issues = [],
  grammarMatches = [],
  activeId,
  activeGrammarKey,
  onGrammarClick,
  className = "",
}: Props) {
  const ranges = useMemo(() => {
    const list: SpanRange[] = [];
    for (const r of openFixRanges(issues)) {
      list.push({
        start: r.start,
        end: r.end,
        kind: "fix",
        fixId: r.id,
        dimension: r.dimension,
      });
    }
    grammarMatches.forEach((m, i) => {
      const start = m.offset;
      const end = m.offset + m.length;
      if (start < 0 || end <= start || end > draft.length) return;
      // Prefer spot-fix ranges when they overlap
      if (list.some((x) => !(end <= x.start || start >= x.end))) return;
      list.push({
        start,
        end,
        kind: "grammar",
        grammar: m,
        grammarKey: grammarKeyOf(m, i),
      });
    });
    return list.sort((a, b) => a.start - b.start || b.end - a.end);
  }, [issues, grammarMatches, draft.length]);

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
      if (r.kind === "fix" && r.dimension) {
        parts.push(
          <mark
            key={`m_${key++}`}
            className={`${markClass(r.dimension, r.fixId === activeId)} rounded-sm px-0.5`}
          >
            {slice}
          </mark>,
        );
      } else if (r.kind === "grammar" && r.grammar) {
        const g = r.grammar;
        const gKey = r.grammarKey || "";
        parts.push(
          <mark
            key={`g_${key++}`}
            role="button"
            tabIndex={0}
            title={g.message}
            className={`${grammarClass(g.category, gKey === activeGrammarKey)} rounded-sm px-0.5`}
            onClick={() => onGrammarClick?.(g, gKey)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onGrammarClick?.(g, gKey);
              }
            }}
          >
            {slice}
          </mark>,
        );
      }
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
  }, [draft, ranges, activeId, activeGrammarKey, onGrammarClick]);

  return (
    <div
      className={`rounded-lg border border-[var(--line)] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[var(--ink)] dark:bg-[#1f1c18] ${className}`}
      aria-label="Writing pad with issue highlights"
    >
      {nodes}
    </div>
  );
}
