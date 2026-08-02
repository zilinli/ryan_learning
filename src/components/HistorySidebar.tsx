"use client";

import type { ConversationRecord } from "@/lib/types";
import { MAX_CONVERSATIONS } from "@/lib/storage";

type Props = {
  open: boolean;
  onClose: () => void;
  conversations: ConversationRecord[];
  activeId: string;
  disabled?: boolean;
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
  onNew,
  onSelect,
  onDelete,
}: Props) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const panel = (
    <aside className="flex h-full w-[min(18rem,85vw)] flex-col border-r border-[var(--line)] bg-[color-mix(in_srgb,var(--bg0)_94%,white)]">
      <div className="safe-top flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Spark
          </p>
          <p className="text-[11px] text-[var(--ink-muted)]">
            History · max {MAX_CONVERSATIONS}
          </p>
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

      <div className="px-3 pb-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onNew();
            onClose();
          }}
          className="flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--ink)] px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {sorted.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--ink-muted)]">
            No chats yet
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sorted.map((c) => {
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
                    className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50 ${
                      active
                        ? "bg-white shadow-sm ring-1 ring-[var(--line)]"
                        : "hover:bg-white/70"
                    }`}
                  >
                    <span className="line-clamp-2 pr-6 text-sm text-[var(--ink)]">
                      {c.title || "New chat"}
                    </span>
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
                      onDelete(c.sessionId);
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
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="relative z-20 hidden h-full shrink-0 lg:block">{panel}</div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(10,28,34,0.45)]"
            aria-label="Close history"
            onClick={onClose}
          />
          <div className="absolute inset-y-0 left-0 animate-fade-up shadow-2xl">
            {panel}
          </div>
        </div>
      ) : null}
    </>
  );
}
