"use client";

import { useMemo, useState } from "react";
import type { ConversationRecord } from "@/lib/types";
import type { LearningMemory } from "@/lib/learning-memory";
import { MAX_CONVERSATIONS, MAX_TOTAL_MESSAGES } from "@/lib/storage";
import { searchConversations } from "@/lib/history-retention";
import { SPARK_GITHUB_LABEL, SPARK_GITHUB_URL } from "@/lib/site";
import { SkillsPanel } from "./SkillsPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  conversations: ConversationRecord[];
  activeId: string;
  disabled?: boolean;
  onOpenCodeAgent?: () => void;
  engagementLabel?: string;
  learningMemory?: LearningMemory | null;
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
  onClose,
  conversations,
  activeId,
  disabled,
  onOpenCodeAgent,
  engagementLabel,
  learningMemory,
  onNew,
  onSelect,
  onDelete,
}: Props) {
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const hits = useMemo(
    () => searchConversations(conversations, query),
    [conversations, query],
  );

  const searching = query.trim().length > 0;

  const panel = (
    <aside className="flex h-full w-[min(26rem,85vw)] flex-col border-r border-[var(--line)] bg-[color-mix(in_srgb,var(--bg0)_94%,white)]">
      <div className="safe-top flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            The Answer Book
          </p>
          <p className="text-[11px] text-[var(--ink-muted)]">
            All chats · keep newest {MAX_TOTAL_MESSAGES.toLocaleString()} msgs
          </p>
          {engagementLabel ? (
            <p className="mt-0.5 text-[11px] font-medium text-[var(--teal)]">
              {engagementLabel}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="min-h-10 rounded-full px-3 text-sm text-[var(--ink-muted)] hover:bg-white/70 lg:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          Close
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
          className="flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--ink)] px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
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
            className="min-h-11 w-full rounded-full border border-[var(--line)] bg-white/80 px-3 pr-9 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--teal)] focus-visible:ring-2 focus-visible:ring-[var(--teal)] disabled:opacity-50"
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
            <p className="text-sm font-medium text-[var(--ink)]">
              {searching ? "No matches" : "No conversations yet"}
            </p>
            <p className="max-w-[15rem] text-xs leading-relaxed text-[var(--ink-muted)]">
              {searching
                ? "Try a different search term."
                : "Start chatting — your conversations will appear here."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
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
                    className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
                      active
                        ? "bg-white shadow-sm ring-1 ring-[var(--line)]"
                        : "hover:bg-white/70"
                    }`}
                  >
                    <span className="line-clamp-2 pr-6 text-sm text-[var(--ink)]">
                      {c.title || "New chat"}
                      {searching && matchedTitle ? (
                        <span className="ml-1 text-[10px] text-[var(--teal)]">
                          title
                        </span>
                      ) : null}
                    </span>
                    {snippet ? (
                      <span className="line-clamp-2 pr-6 text-[11px] leading-snug text-[var(--ink-muted)]">
                        {snippet}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-[var(--ink-muted)]">
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
          <p className="px-2 pt-2 text-center text-[10px] text-[var(--ink-muted)]">
            {hits.length} match{hits.length === 1 ? "" : "es"} · max{" "}
            {MAX_CONVERSATIONS} chats listed
          </p>
        ) : null}
      </div>

      <SkillsPanel memory={learningMemory ?? null} />

      <div className="shrink-0 border-t border-[var(--line)]/70 px-3 py-3">
        <a
          href="/dict"
          className="mb-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-white/70 px-3 text-[11px] font-semibold text-[var(--ink)] transition hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
        >
          Dictionary / Translation
        </a>
        {onOpenCodeAgent ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onOpenCodeAgent();
              onClose();
            }}
            className="mb-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--teal)]/30 bg-[var(--teal)]/10 px-3 text-[11px] font-semibold text-[var(--teal)] transition hover:bg-[var(--teal)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] disabled:opacity-40"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Code Agent
          </button>
        ) : null}
        <a
          href={SPARK_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)] underline-offset-2 transition hover:text-[var(--teal)] hover:underline"
        >
          <svg
            className="h-3.5 w-3.5 opacity-80"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {SPARK_GITHUB_LABEL}
        </a>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="relative z-20 hidden h-full shrink-0 lg:block">{panel}</div>

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
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl ring-1 ring-[var(--line)]">
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
    </>
  );
}
