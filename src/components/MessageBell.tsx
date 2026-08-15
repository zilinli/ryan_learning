"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUnreadCount, subscribeMessagesChanged } from "@/lib/messages-sync";

export function MessageBell({ accountId, onOpen, focusMode = false }: {
  accountId: string;
  onOpen: () => void;
  /** UX-V4 — during Focus Mode, only urgent unread lights the badge. */
  focusMode?: boolean;
}) {
  const [count, setCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId || accountId.startsWith("acct_")) {
      const n = await fetchUnreadCount(
        accountId,
        focusMode ? { minUrgency: "urgent" } : undefined,
      );
      setCount((prev) => (n !== prev ? n : prev));
    }
  }, [accountId, focusMode]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 8000);
    const unsub = subscribeMessagesChanged((data) => {
      if (data.accountId === accountId && typeof data.unreadCount === "number") {
        setCount(data.unreadCount);
      }
    });
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, accountId]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
      aria-label={count > 0 ? `${count} unread messages` : "No new messages"}
      title={count > 0 ? `${count} unread message${count > 1 ? "s" : ""} from parent` : "No new messages"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[10px] font-bold text-white shadow-sm">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
