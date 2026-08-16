"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BasisCoachReport, BasisDimensionId } from "@/lib/entertain/basis-writing";
import { BASIS_DIMENSION_META } from "@/lib/entertain/basis-writing";
import {
  buildMentorOpener,
  buildMentorOpenerFromText,
  type MentorEdit,
} from "@/lib/entertain/basis-mentor-session";
import {
  clipRevisionContext,
  mergeRevision,
  revisionDiff,
  type WritingFixIssue,
} from "@/lib/entertain/basis-fix-session";

type ChatTurn = {
  id: string;
  role: "coach" | "you" | "system";
  text: string;
};

const DIM_ORDER: BasisDimensionId[] = ["topic", "detail", "vocab", "grammar"];

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

type PendingEdit = {
  issue: WritingFixIssue;
  replacement: string;
  merged: string;
  head: string;
  beforeMid: string;
  afterMid: string;
  tail: string;
};

type Props = {
  report: BasisCoachReport | null;
  coachText: string | null;
  draft: string;
  genre: string;
  target: string;
  /** Bump to reset conversation with a fresh opener */
  sessionKey: number;
  onDraftChange: (next: string) => void;
  onClose: () => void;
  onOpenSpotFixes?: () => void;
  spotFixCount?: number;
  /** Parent can know when student is mid-dialogue (don't auto-reset) */
  onUserActiveChange?: (active: boolean) => void;
  /** Spot-fix queue the mentor may anchor structured edits to */
  issues?: WritingFixIssue[];
  onIssuesChange?: (next: WritingFixIssue[]) => void;
  onApplyEdit?: (next: string, prev: string) => void;
  canUndo?: boolean;
  onUndo?: () => void;
};

export function WritingMentorDialogue({
  report,
  coachText,
  draft,
  genre,
  target,
  sessionKey,
  onDraftChange,
  onClose,
  onOpenSpotFixes,
  spotFixCount = 0,
  onUserActiveChange,
  issues = [],
  onIssuesChange,
  onApplyEdit,
  canUndo = false,
  onUndo,
}: Props) {
  const [reply, setReply] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const seededKeyRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askedFocusRef = useRef<Set<string>>(new Set());

  const opener = useMemo(() => {
    if (report?.dimensions?.length) {
      return buildMentorOpener(report, draft);
    }
    if (coachText?.trim()) {
      return buildMentorOpenerFromText(coachText, draft);
    }
    return null;
  }, [report, coachText, draft]);

  useEffect(() => {
    if (seededKeyRef.current === sessionKey) return;
    seededKeyRef.current = sessionKey;
    setReply("");
    setError(null);
    setPendingEdit(null);
    onUserActiveChange?.(false);
    askedFocusRef.current = new Set(opener ? [opener.focusId] : []);
    if (!opener) {
      setTurns([]);
      return;
    }
    setTurns([
      {
        id: `open_${sessionKey}`,
        role: "coach",
        text: opener.text,
      },
    ]);
    // Focus reply so Q + A feel connected
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [sessionKey, opener, onUserActiveChange]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy, pendingEdit]);

  const focusLabel = opener
    ? opener.focusId.charAt(0).toUpperCase() + opener.focusId.slice(1)
    : "Writing";

  const openIssues = useMemo(
    () =>
      issues
        .filter((i) => i.status === "open" && i.span)
        .slice(0, 8)
        .map((i) => ({ id: i.id, span: i.span, dimension: i.dimension })),
    [issues],
  );

  const sendReply = useCallback(async () => {
    const text = reply.trim();
    if (text.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    setPendingEdit(null);
    onUserActiveChange?.(true);
    const youTurn: ChatTurn = {
      id: `you_${Date.now()}`,
      role: "you",
      text,
    };
    const historyForApi = [...turns, youTurn]
      .filter((t) => t.role === "coach" || t.role === "you")
      .map((t) => ({ role: t.role as "coach" | "you", text: t.text }));
    setTurns((prev) => [...prev, youTurn]);
    setReply("");
    try {
      const res = await fetch("/api/writing-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mentor",
          draft,
          genre,
          target,
          studentReply: text,
          history: historyForApi,
          focusIds: report?.focusIds ?? [opener?.focusId].filter(Boolean),
          craftTip: report?.craftTip,
          openIssues,
          askedFocusIds: [...askedFocusRef.current],
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        edit?: MentorEdit | null;
        error?: string;
      };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || "Mentor failed");
      }
      setTurns((prev) => [
        ...prev,
        {
          id: `coach_${Date.now()}`,
          role: "coach",
          text: data.reply!,
        },
      ]);
      if (data.edit?.spanId && data.edit.replacement) {
        const issue = issues.find((i) => i.id === data.edit!.spanId);
        if (issue) {
          const merged = mergeRevision(draft, issue, data.edit.replacement);
          if (merged !== draft) {
            const diff = revisionDiff(draft, merged);
            setPendingEdit({
              issue,
              replacement: data.edit.replacement,
              merged,
              head: diff.head,
              beforeMid: diff.beforeMid,
              afterMid: diff.afterMid,
              tail: diff.tail,
            });
            askedFocusRef.current.add(issue.dimension);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentor failed");
    } finally {
      setBusy(false);
    }
  }, [
    reply,
    busy,
    turns,
    draft,
    genre,
    target,
    report,
    opener?.focusId,
    onUserActiveChange,
    issues,
    openIssues,
  ]);

  const applyPendingEdit = () => {
    if (!pendingEdit) return;
    const { issue, merged } = pendingEdit;
    if (onApplyEdit) onApplyEdit(merged, draft);
    else onDraftChange(merged);
    onIssuesChange?.(
      issues.map((i) =>
        i.id === issue.id ? { ...i, status: "fixed" as const } : i,
      ),
    );
    setTurns((prev) => [
      ...prev,
      {
        id: `sys_edit_${Date.now()}`,
        role: "system",
        text: "Updated Writing Pad — your words are now in the draft.",
      },
    ]);
    setPendingEdit(null);
  };

  const tweakPendingEdit = () => {
    if (!pendingEdit) return;
    setReply(pendingEdit.replacement);
    setPendingEdit(null);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  };

  const skipPendingEdit = () => {
    if (!pendingEdit) return;
    setPendingEdit(null);
    setTurns((prev) => [
      ...prev,
      {
        id: `sys_skip_${Date.now()}`,
        role: "system",
        text: "Skipped that edit — keep talking it through.",
      },
    ]);
  };

  const appendLastIdea = () => {
    const lastYou = [...turns].reverse().find((t) => t.role === "you");
    if (!lastYou) return;
    const chunk = lastYou.text.trim();
    if (!chunk) return;
    if (onApplyEdit) onApplyEdit(draft.trimEnd() ? `${draft.trimEnd()}\n${chunk}` : chunk, draft);
    else onDraftChange(draft.trim() ? `${draft.trimEnd()}\n${chunk}` : chunk);
    setTurns((prev) => [
      ...prev,
      {
        id: `sys_pad_${Date.now()}`,
        role: "system",
        text: "Added your last reply to the Writing Pad.",
      },
    ]);
  };

  const hasYouTurn = turns.some((t) => t.role === "you");

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--teal)]/35 bg-[var(--surface)] shadow-[0_8px_28px_rgba(20,40,35,0.08)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--teal)]/8 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Spark coach
          </p>
          <p className="truncate text-xs text-[var(--ink-muted)]">
            Think first · {focusLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {spotFixCount > 0 && onOpenSpotFixes && (
            <button
              type="button"
              onClick={onOpenSpotFixes}
              className="min-h-9 rounded-lg border border-[var(--coral)]/35 bg-[var(--coral)]/10 px-2 text-[11px] font-semibold text-[var(--coral)]"
            >
              Spots {spotFixCount}
            </button>
          )}
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

      {/* Tight chat stack: messages scroll, composer glued under (no page-tall gap) */}
      <div
        ref={scrollerRef}
        className="max-h-[min(38vh,260px)] space-y-2 overflow-y-auto px-3 py-2.5"
      >
        {turns.map((t) => (
          <div
            key={t.id}
            className={`flex ${t.role === "you" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[94%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                t.role === "coach"
                  ? "rounded-tl-sm bg-[var(--surface-muted)] text-[var(--ink)]"
                  : t.role === "you"
                    ? "rounded-tr-sm bg-[var(--teal)] text-white"
                    : "bg-transparent text-[11px] text-[var(--ink-muted)]"
              }`}
            >
              {t.role === "coach" && (
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                  Spark
                </p>
              )}
              {t.text}
            </div>
          </div>
        ))}
        {pendingEdit && (
          <div className="rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/6 p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--teal)]">
              Suggested edit — from your words
            </p>
            <p className="mb-0.5 text-[11px] text-[var(--ink-muted)]">
              <span className="text-[var(--ink)]">
                {clipRevisionContext(pendingEdit.head)}
              </span>
              <s className="rounded bg-[var(--coral)]/15 px-0.5 text-[var(--coral)]">
                {clipRevisionContext(pendingEdit.beforeMid)}
              </s>
              <span className="text-[var(--ink)]">
                {clipRevisionContext(pendingEdit.tail)}
              </span>
            </p>
            <p className="mb-2 text-[11px] text-[var(--ink)]">
              <span className="text-[var(--ink-muted)]">
                {clipRevisionContext(pendingEdit.head)}
              </span>
              <mark className="rounded bg-[var(--teal)]/20 px-0.5 text-[var(--teal)]">
                {clipRevisionContext(pendingEdit.afterMid)}
              </mark>
              <span className="text-[var(--ink-muted)]">
                {clipRevisionContext(pendingEdit.tail)}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={applyPendingEdit}
                className="min-h-9 rounded-lg bg-[var(--teal)] px-3 text-xs font-semibold text-white"
              >
                Apply to pad
              </button>
              <button
                type="button"
                onClick={tweakPendingEdit}
                className="min-h-9 rounded-lg border border-[var(--teal)]/40 px-3 text-xs font-medium text-[var(--teal)]"
              >
                Tweak…
              </button>
              <button
                type="button"
                onClick={skipPendingEdit}
                className="min-h-9 rounded-lg px-2 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Skip
              </button>
            </div>
          </div>
        )}
        {busy && (
          <p className="text-[11px] text-[var(--ink-muted)]">Spark is thinking…</p>
        )}
        {error && <p className="text-[12px] text-[var(--coral)]">{error}</p>}
      </div>

      <div className="border-t border-[var(--line)] bg-[var(--surface-muted)]/40 p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            disabled={busy || !opener}
            placeholder="Answer here…"
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--teal)] disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendReply();
              }
            }}
          />
          <button
            type="button"
            disabled={busy || reply.trim().length < 1}
            onClick={() => void sendReply()}
            className="min-h-11 shrink-0 rounded-xl bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-[var(--ink-muted)]">
            Enter send · Shift+Enter new line
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {canUndo && onUndo ? (
              <button
                type="button"
                onClick={onUndo}
                className="text-[11px] font-medium text-[var(--coral)] hover:underline"
              >
                Undo last edit
              </button>
            ) : null}
            {hasYouTurn && (
              <button
                type="button"
                disabled={busy}
                onClick={appendLastIdea}
                className="text-[11px] font-medium text-[var(--teal)] hover:underline"
              >
                Add last answer to pad
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
