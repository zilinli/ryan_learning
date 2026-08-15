"use client";

import { useMemo, useState } from "react";
import type { ConversationRecord } from "@/lib/types";
import type { LearningMemory } from "@/lib/learning-memory";
import { MAX_CONVERSATIONS, MAX_TOTAL_MESSAGES } from "@/lib/storage";
import { searchConversations } from "@/lib/history-retention";
import { SPARK_GITHUB_URL } from "@/lib/site";
import {
  buildFocusGuardrail,
  dismissFocusGuardrail,
  dismissedFocusGuardrailToday,
} from "@/lib/focus-guardrail";
import { isParentSessionUnlocked } from "@/lib/parent-pin";
import { SkillsPanel } from "./SkillsPanel";
import { FeedbackPanel } from "./FeedbackPanel";

type Props = {
  open: boolean;
  /** Desktop chat column visibility (defaults to true). */
  desktopOpen?: boolean;
  onClose: () => void;
  /** Close the desktop chat column (X button). */
  onDesktopClose?: () => void;
  conversations: ConversationRecord[];
  activeId: string;
  /** P2 — active account, used for the focus-guardrail nudge's dismiss gate. */
  accountId?: string;
  /** UX-V4 — hide Games/Studio exits while Focus Mode is on (soft). */
  focusMode?: boolean;
  disabled?: boolean;
  onOpenCodeAgent?: () => void;
  engagementLabel?: string;
  learningMemory?: LearningMemory | null;
  checkMode?: boolean;
  onCheckModeChange?: (on: boolean) => void;
  onNew: () => void;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

function relativeTime(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function HistorySidebar({
  open,
  desktopOpen = true,
  onClose,
  onDesktopClose,
  conversations,
  activeId,
  accountId,
  focusMode = false,
  disabled,
  onOpenCodeAgent,
  engagementLabel,
  learningMemory,
  checkMode,
  onCheckModeChange,
  onNew,
  onSelect,
  onDelete,
}: Props) {
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const parentUnlocked = isParentSessionUnlocked();

  const hits = useMemo(
    () => searchConversations(conversations, query),
    [conversations, query],
  );

  // P2 — non-blocking focus guardrail next to the Games link.
  const guardrail = useMemo(
    () => buildFocusGuardrail(accountId, conversations, activeId),
    [accountId, conversations, activeId],
  );
  const [guardrailDismissed, setGuardrailDismissed] = useState(() =>
    accountId ? dismissedFocusGuardrailToday(accountId) : false,
  );
  const showGuardrail = guardrail && !guardrailDismissed;

  const searching = query.trim().length > 0;

  const panel = (
    <aside className="flex h-full w-[min(28rem,88vw)] flex-col border-r border-[var(--line)] bg-[color-mix(in_srgb,var(--bg0)_94%,white)]">
      <div className="safe-top flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            The Answer Book · AI Tutor
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            All chats · keep newest {MAX_TOTAL_MESSAGES.toLocaleString()} msgs
          </p>
          {engagementLabel ? (
            <p className="mt-0.5 text-xs font-medium text-[var(--teal)]">
              {engagementLabel}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
          onClick={() => {
            onClose();
            onDesktopClose?.();
          }}
          aria-label="Close chat column"
          title="Close chat column"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-3 pb-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onNew();
            onClose();
          }}
          className="flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--action-bg)] px-3 text-base font-medium text-[var(--action-ink)] transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
        >
          New chat
        </button>
        <label className="relative block">
          <span className="sr-only">Search history</span>
          <input
            type="search"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="min-h-11 w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 pr-9 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--teal)] focus-visible:ring-2 focus-visible:ring-[var(--teal)] disabled:opacity-50"
            enterKeyHint="search"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 min-h-8 min-w-8 -translate-y-1/2 rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)]"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          ) : null}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {hits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
            <p className="text-2xl">💬</p>
            <p className="text-base font-medium text-[var(--ink)]">
              {searching ? "No matches" : "No conversations yet"}
            </p>
            <p className="max-w-[15rem] text-xs leading-relaxed text-[var(--ink-muted)]">
              {searching
                ? "Try a different search term."
                : "Start chatting — your conversations will appear here."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {hits.map(({ conversation: c, snippet, matchedTitle }) => {
              const active = c.sessionId === activeId;
              return (
                <li key={c.sessionId} className="group relative">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSelect(c.sessionId);
                      onClose();
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-3 text-left transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
                      active
                        ? "bg-[var(--surface)] shadow-sm ring-1 ring-[var(--line)]"
                        : "hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <span className="line-clamp-2 pr-7 text-base font-medium leading-snug text-[var(--ink)]">
                      {c.title || "New chat"}
                      {searching && matchedTitle ? (
                        <span className="ml-1 text-xs font-normal text-[var(--teal)]">
                          title
                        </span>
                      ) : null}
                    </span>
                    {snippet ? (
                      <span className="line-clamp-2 pr-7 text-xs leading-snug text-[var(--ink-muted)]">
                        {snippet}
                      </span>
                    ) : null}
                    <span className="text-xs text-[var(--ink-muted)]">
                      {relativeTime(c.updatedAt)}
                      {c.messages.length
                        ? ` · ${c.messages.length} msgs`
                        : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    title="Delete chat"
                    aria-label="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(c.sessionId);
                    }}
                    className="absolute right-1.5 top-2 min-h-9 min-w-9 rounded-full text-[var(--ink-muted)] opacity-70 hover:bg-[var(--mist)] hover:text-[var(--coral)] group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {searching ? (
          <p className="px-2 pt-2 text-center text-xs text-[var(--ink-muted)]">
            {hits.length} match{hits.length === 1 ? "" : "es"} · max{" "}
            {MAX_CONVERSATIONS} chats listed
          </p>
        ) : null}
      </div>

      <SkillsPanel memory={learningMemory ?? null} />

      <div className="shrink-0 border-t border-[var(--line)]/70 px-2.5 py-2">
        {/* UX-V4 — kid primary: Me · Progress · Studio · Games */}
        <div className="mb-1.5 grid grid-cols-4 gap-1.5">
          <a
            href="/me"
            className="flex min-h-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-1 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
            title="Me — journal, creations, progress"
          >
            Me
          </a>
          <a
            href="/dashboard"
            className="flex min-h-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-1 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
            title="Progress — skills, practice"
          >
            Progress
          </a>
          <a
            href="/studio"
            className={`flex min-h-9 items-center justify-center rounded-full border px-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
              focusMode
                ? "pointer-events-none border-[var(--line)]/50 bg-[var(--surface-muted)]/50 text-[var(--ink-muted)] opacity-50"
                : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--mist)]"
            }`}
            title={focusMode ? "Studio paused during Focus" : "Studio — make & learn"}
            aria-disabled={focusMode || undefined}
          >
            Studio
          </a>
          <a
            href="/entertain"
            className={`flex min-h-9 items-center justify-center gap-1 rounded-full border px-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
              focusMode
                ? "pointer-events-none border-[var(--line)]/50 bg-[var(--surface-muted)]/50 text-[var(--ink-muted)] opacity-50"
                : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--mist)]"
            }`}
            title={focusMode ? "Games paused during Focus" : "Games — play"}
            aria-disabled={focusMode || undefined}
          >
            Games
          </a>
        </div>
        {showGuardrail ? (
          <div className="mb-1.5 rounded-lg border border-[var(--coral)]/35 bg-[var(--coral)]/6 px-3 py-2 text-left">
            <p className="text-xs font-medium leading-snug text-[var(--ink)]">
              {guardrail.line}
            </p>
            <div className="mt-1.5 flex gap-3">
              <a
                href="/"
                className="text-xs font-semibold text-[var(--coral)] underline-offset-2 hover:underline"
              >
                Back to homework
              </a>
              <button
                type="button"
                onClick={() => {
                  if (accountId) dismissFocusGuardrail(accountId);
                  setGuardrailDismissed(true);
                }}
                className="text-xs text-[var(--ink-muted)] underline-offset-2 hover:underline"
              >
                Not now
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="mb-1.5 flex min-h-9 w-full items-center justify-center rounded-full border border-[var(--line)]/70 bg-[var(--surface)]/70 px-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--teal)]/35 hover:text-[var(--teal)]"
          aria-expanded={moreOpen}
        >
          {moreOpen ? "Less" : "More"}
        </button>
        {moreOpen ? (
          <div className="mb-1.5 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <a
                href="/family"
                className="flex min-h-9 items-center justify-center rounded-full border border-[var(--teal)]/35 bg-[var(--teal)]/10 px-1.5 text-xs font-semibold text-[var(--teal)] transition hover:bg-[var(--teal)]/20"
                title="Family — parent hub (PIN)"
              >
                Family
              </a>
              <a
                href="/dict"
                className="flex min-h-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--mist)]"
                title="Dictionary / Translation"
              >
                Dict
              </a>
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="flex min-h-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--mist)]"
              >
                Help
              </button>
            </div>
            {parentUnlocked ? (
              <div className="grid grid-cols-2 gap-1.5">
                <a
                  href={SPARK_GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--line)]/70 bg-[var(--surface)]/70 px-2 text-xs font-medium text-[var(--ink-muted)] transition hover:border-[var(--teal)]/35 hover:text-[var(--teal)]"
                >
                  GitHub
                </a>
                {onOpenCodeAgent ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onOpenCodeAgent();
                      onClose();
                    }}
                    className="flex min-h-9 items-center justify-center rounded-full border border-[var(--teal)]/30 bg-[var(--teal)]/10 px-3 text-xs font-semibold text-[var(--teal)] transition hover:bg-[var(--teal)]/20 disabled:opacity-40"
                  >
                    Code Agent
                  </button>
                ) : (
                  <span className="min-h-9" />
                )}
              </div>
            ) : (
              <p className="px-1 text-[10px] leading-snug text-[var(--ink-muted)]">
                Grown-up tools unlock after Family PIN.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop chat column — closable */}
      {desktopOpen ? (
        <div className="relative z-20 hidden h-full shrink-0 lg:block">{panel}</div>
      ) : null}

      {/* Mobile drawer — slide animation */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(10,28,34,0.45)] transition-opacity duration-250 ease-out"
            aria-label="Close sidebar"
            onClick={onClose}
          />
          <div className="absolute inset-y-0 left-0 animate-slide-in-left shadow-2xl">
            {panel}
          </div>
        </div>
      ) : null}
      {/* Delete confirmation overlay */}
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,34,0.35)] px-4">
          <div className="w-full max-w-xs rounded-2xl bg-[var(--surface)] p-5 shadow-xl ring-1 ring-[var(--line)]">
            <p className="text-sm font-medium text-[var(--ink)]">Delete this conversation?</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">This cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] hover:bg-[var(--mist)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="flex-1 rounded-full bg-[var(--coral)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <FeedbackPanel open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
