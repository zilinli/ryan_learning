"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildWrongAnswerReviewSet,
  deleteWrongAnswer,
  loadWrongAnswers,
  stashVariantKickoff,
  stashWrongReviewKickoff,
  wrongAnswersBySkill,
  type WrongAnswer,
  type WrongAnswerAction,
} from "@/lib/wrong-answer-store";

function timeAgo(ts: number): string {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * P1 (report §8.9) — wrong-answer book. Groups misses by skill, lets the
 * student redo the tricky ones in the chat, or clear single entries.
 */
export function WrongAnswerBook({
  accountId,
  className = "",
}: {
  accountId: string;
  className?: string;
}) {
  const [items, setItems] = useState<WrongAnswer[]>([]);

  useEffect(() => {
    setItems(loadWrongAnswers(accountId));
  }, [accountId]);

  const groups = useMemo(() => wrongAnswersBySkill(accountId), [accountId, items]);

  const reviewInChat = (list: WrongAnswer[]) => {
    stashWrongReviewKickoff(list.slice(0, 5));
    window.location.href = "/";
  };

  // P1 — wrong answer → variant / harder one-question handoff (report §9.3.2)
  const liftInChat = (w: WrongAnswer, action: WrongAnswerAction) => {
    stashVariantKickoff(w, action);
    window.location.href = "/";
  };

  const remove = (id: string) => {
    deleteWrongAnswer(accountId, id);
    setItems(loadWrongAnswers(accountId));
  };

  if (items.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Review box
        </p>
        <button
          type="button"
          onClick={() => reviewInChat(buildWrongAnswerReviewSet(accountId, 3))}
          className="rounded-full border border-[var(--teal)]/35 bg-[var(--teal)]/10 px-3 py-1.5 text-[11px] font-semibold text-[var(--teal)] transition hover:bg-[var(--teal)]/20"
        >
          Redo 3 in chat
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {groups.map((g) => (
          <div key={g.skillId} className="rounded-xl border border-[var(--line)]/70 bg-[var(--surface-muted)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                {g.skillLabel}
                <span className="ml-1.5 text-[11px] font-normal text-[var(--ink-muted)]">
                  {g.items.length}
                </span>
              </p>
              <button
                type="button"
                onClick={() => reviewInChat(g.items)}
                className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)] hover:border-[var(--teal)]/40 hover:text-[var(--teal)]"
              >
                Redo in chat
              </button>
            </div>
            <ul className="mt-2 space-y-2">
              {g.items.slice(0, 3).map((w) => (
                <li key={w.id} className="group rounded-lg border border-[var(--line)]/50 bg-[var(--surface)] px-2 py-1.5">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[12px] leading-snug text-[var(--ink-muted)]">
                      <span className="mr-1 text-[10px] opacity-60">{timeAgo(w.createdAt)}</span>
                      {w.question}
                    </p>
                    <button
                      type="button"
                      aria-label="Remove from review box"
                      title="Remove from review box"
                      onClick={() => remove(w.id)}
                      className="rounded p-0.5 text-[var(--ink-muted)] opacity-0 transition hover:text-[var(--coral)] group-hover:opacity-100"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => liftInChat(w, "variant")}
                      className="rounded-full border border-[var(--teal)]/35 bg-[var(--teal)]/8 px-2 py-0.5 text-[10px] font-medium text-[var(--teal)] transition hover:bg-[var(--teal)]/15"
                    >
                      Variant — new numbers
                    </button>
                    <button
                      type="button"
                      onClick={() => liftInChat(w, "harder")}
                      className="rounded-full border border-[var(--coral)]/35 bg-[var(--coral)]/8 px-2 py-0.5 text-[10px] font-medium text-[var(--coral)] transition hover:bg-[var(--coral)]/15"
                    >
                      Harder — level up
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
