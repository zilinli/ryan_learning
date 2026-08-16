"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BasisDimensionId } from "@/lib/entertain/basis-writing";
import { BASIS_DIMENSION_META } from "@/lib/entertain/basis-writing";
import {
  clipRevisionContext,
  mergeRevision,
  nextOpenFix,
  remainingFixCount,
  revisionDiff,
  type WritingFixIssue,
} from "@/lib/entertain/basis-fix-session";

type ChatTurn = {
  id: string;
  role: "coach" | "you" | "system";
  text: string;
};

const DIM_ORDER: BasisDimensionId[] = ["topic", "detail", "vocab", "grammar"];

type Props = {
  issues: WritingFixIssue[];
  draft: string;
  onIssuesChange: (next: WritingFixIssue[]) => void;
  onDraftChange: (next: string) => void;
  onClose: () => void;
  /** Record the previous draft so the parent can offer undo */
  onApplyEdit?: (next: string, prev: string) => void;
  canUndo?: boolean;
  onUndo?: () => void;
};

function dimColor(dim: BasisDimensionId): string {
  if (dim === "detail") return "var(--coral)";
  if (dim === "vocab") return "#c4a35a";
  if (dim === "grammar") return "var(--teal)";
  return "#5b7c99";
}

function dimStatus(
  issues: WritingFixIssue[],
  dim: BasisDimensionId,
): "none" | "open" | "done" {
  const inDim = issues.filter((i) => i.dimension === dim);
  if (!inDim.length) return "none";
  return inDim.some((i) => i.status === "open") ? "open" : "done";
}

export function WritingFixDialogue({
  issues,
  draft,
  onIssuesChange,
  onDraftChange,
  onClose,
  onApplyEdit,
  canUndo = false,
  onUndo,
}: Props) {
  const current = nextOpenFix(issues);
  const remaining = remainingFixCount(issues);
  const fixed = issues.filter((i) => i.status === "fixed").length;
  const [reply, setReply] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef<string | null>(null);

  const meta = current ? BASIS_DIMENSION_META[current.dimension] : null;

  const preview = useMemo(() => {
    if (!current) return null;
    const text = reply.trim();
    if (text.length < 2) return null;
    const merged = mergeRevision(draft, current, text);
    if (merged === draft) return null;
    const diff = revisionDiff(draft, merged);
    if (!diff.beforeMid && !diff.afterMid) return null;
    return { merged, diff };
  }, [current, draft, reply]);

  // Seed / advance coach question when current issue changes
  useEffect(() => {
    if (!current) {
      if (askedRef.current !== "done") {
        askedRef.current = "done";
        setTurns((prev) => [
          ...prev,
          {
            id: `sys_done_${Date.now()}`,
            role: "system",
            text:
              fixed > 0
                ? `Nice — ${fixed} fix${fixed === 1 ? "" : "es"} applied to the Writing Pad. Stage it when ready.`
                : "No open issues left. Keep writing, then Coach again.",
          },
        ]);
      }
      return;
    }
    if (askedRef.current === current.id) return;
    askedRef.current = current.id;
    setReply("");
    setTurns((prev) => [
      ...prev,
      {
        id: `q_${current.id}`,
        role: "coach",
        text: current.question,
      },
    ]);
  }, [current, fixed]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, current, preview]);

  const progressLabel = useMemo(() => {
    if (!issues.length) return "No issues";
    return `${fixed} fixed · ${remaining} left`;
  }, [fixed, remaining, issues.length]);

  const applyCurrent = (mode: "fix" | "skip") => {
    if (!current) return;
    if (mode === "fix") {
      if (!preview) return;
      if (onApplyEdit) onApplyEdit(preview.merged, draft);
      else onDraftChange(preview.merged);
      const nextIssues = issues.map((i) => {
        if (i.id !== current.id) return i;
        return { ...i, status: "fixed" as const };
      });
      // Re-map later open spans after edit (best-effort by span text)
      const remapped = nextIssues.map((i) => {
        if (i.status !== "open" || !i.span) return i;
        const idx = preview.merged.indexOf(i.span);
        if (idx < 0) return i;
        return { ...i, start: idx, end: idx + i.span.length };
      });
      onIssuesChange(remapped);
      setTurns((prev) => [
        ...prev,
        { id: `a_${current.id}`, role: "you", text: reply.trim() },
        {
          id: `ok_${current.id}`,
          role: "system",
          text: `Updated Writing Pad — replaced “${current.span.slice(0, 28)}${current.span.length > 28 ? "…" : ""}”.`,
        },
      ]);
      setReply("");
      return;
    }
    // skip
    onIssuesChange(
      issues.map((i) =>
        i.id === current.id ? { ...i, status: "skipped" as const } : i,
      ),
    );
    setTurns((prev) => [
      ...prev,
      {
        id: `skip_${current.id}`,
        role: "system",
        text: "Skipped — we can come back after the next Coach run.",
      },
    ]);
    setReply("");
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--coral)]/30 bg-[var(--surface)] shadow-[0_8px_28px_rgba(20,40,35,0.08)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--coral)]/8 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--coral)]">
            Spot fixes
          </p>
          <p className="truncate text-xs text-[var(--ink-muted)]">
            {progressLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-[var(--coral)] px-2 text-[11px] font-bold text-white"
            title="Open issues"
          >
            {remaining}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-lg px-2 text-xs text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>
      </div>

      {/* Dimension progress chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] px-3 py-2">
        {DIM_ORDER.map((dim) => {
          const st = dimStatus(issues, dim);
          const label = BASIS_DIMENSION_META[dim].shortLabel;
          if (st === "none") {
            return (
              <span
                key={dim}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]/60"
              >
                {label}
              </span>
            );
          }
          if (st === "done") {
            return (
              <span
                key={dim}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-[var(--teal)]"
              >
                {label} ✓
              </span>
            );
          }
          return (
            <span
              key={dim}
              className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `${dimColor(dim)}26`, color: dimColor(dim) }}
            >
              {label}
            </span>
          );
        })}
      </div>

      {current && meta && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            style={{ background: dimColor(current.dimension) }}
          >
            {meta.shortLabel} · severity {current.severity}/5
          </span>
          {current.span ? (
            <span className="max-w-full truncate rounded bg-[var(--coral)]/15 px-2 py-0.5 font-mono text-[11px] text-[var(--coral)]">
              “{current.span}”
            </span>
          ) : null}
        </div>
      )}

      <div
        ref={scrollerRef}
        className="max-h-[min(32vh,220px)] space-y-2 overflow-y-auto px-3 py-2.5"
      >
        {turns.map((t) => (
          <div
            key={t.id}
            className={`flex ${t.role === "you" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[94%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                t.role === "coach"
                  ? "rounded-tl-sm bg-[var(--surface-muted)] text-[var(--ink)]"
                  : t.role === "you"
                    ? "rounded-tr-sm bg-[var(--teal)] text-white"
                    : "bg-transparent text-[11px] text-[var(--ink-muted)]"
              }`}
            >
              {t.role === "coach" && (
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                  Coach
                </p>
              )}
              {t.text}
            </div>
          </div>
        ))}
        {!current && turns.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">
            Run Coach to start spot fixes.
          </p>
        )}
      </div>

      {current ? (
        <div className="border-t border-[var(--line)] bg-[var(--surface-muted)]/40 p-2.5">
          {preview && (
            <div className="mb-2 space-y-1.5 rounded-xl border border-[var(--teal)]/25 bg-[var(--surface)] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                Preview
              </p>
              <p className="text-[12px] leading-snug text-[var(--ink-muted)]">
                <span className="text-[var(--ink)]">
                  {clipRevisionContext(preview.diff.head)}
                </span>
                <s className="rounded bg-[var(--coral)]/15 px-0.5 text-[var(--coral)]">
                  {clipRevisionContext(preview.diff.beforeMid)}
                </s>
                <span className="text-[var(--ink)]">
                  {clipRevisionContext(preview.diff.tail)}
                </span>
              </p>
              <p className="text-[12px] leading-snug text-[var(--ink)]">
                <span className="text-[var(--ink-muted)]">
                  {clipRevisionContext(preview.diff.head)}
                </span>
                <mark className="rounded bg-[var(--teal)]/20 px-0.5 text-[var(--teal)]">
                  {clipRevisionContext(preview.diff.afterMid)}
                </mark>
                <span className="text-[var(--ink-muted)]">
                  {clipRevisionContext(preview.diff.tail)}
                </span>
              </p>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder={current.placeholder}
              className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--teal)]"
            />
            <button
              type="button"
              disabled={!preview}
              onClick={() => applyCurrent("fix")}
              className="min-h-11 shrink-0 rounded-xl bg-[var(--teal)] px-3 text-sm font-semibold text-white disabled:opacity-40"
              title="Show what will change in the Preview first"
            >
              Apply
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => applyCurrent("skip")}
              className="text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              Skip this one
            </button>
            {canUndo && onUndo ? (
              <button
                type="button"
                onClick={onUndo}
                className="text-[11px] font-medium text-[var(--coral)] hover:underline"
              >
                Undo last edit
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--line)] p-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 w-full rounded-xl bg-[var(--teal)] px-3 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
