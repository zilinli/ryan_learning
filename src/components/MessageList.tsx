"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessages, notifyMessagesChanged, subscribeMessagesChanged } from "@/lib/messages-sync";
import { loadAccounts, type AccountRecord } from "@/lib/student-profile";

type MessageListProps = {
  accountId: string;
  /** If set, shows compose UI (parent mode). */
  composeMode?: boolean;
  onClose?: () => void;
};

export function MessageList({ accountId, composeMode, onClose }: MessageListProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentAccounts, setStudentAccounts] = useState<AccountRecord[]>([]);
  const [sendTo, setSendTo] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isStudent = !composeMode;

  const refresh = useCallback(async () => {
    const result = await fetchMessages(accountId);
    if (result) setMessages(result.messages);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 8000);
    const unsub = subscribeMessagesChanged((d) => {
      if (d.accountId === accountId) refresh();
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

  useEffect(() => {
    if (composeMode) {
      const store = loadAccounts();
      setStudentAccounts(store.accounts.filter((a) => a.role !== "parent" && a.id !== accountId));
    }
  }, [composeMode, accountId]);

  const markAsRead = async (msgId: string) => {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, messageId: msgId }),
      });
      notifyMessagesChanged({ accountId });
      refresh();
    } catch { /* ignore */ }
  };

  // Simple Markdown to HTML renderer for previews
  const mdPreview = (text: string, limit = 120) => {
    const plain = text
      .replace(/^#{1,3}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/```[\s\S]*?```/g, "[diagram]")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "[image: $1]")
      .replace(/\n{2,}/g, " ")
      .replace(/\n/g, " ");
    return plain.length > limit ? plain.slice(0, limit) + "…" : plain;
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return `${Math.round(diff / 86400000)}d ago`;
  };

  const urgencyColor = (u: string) => {
    if (u === "urgent") return "border-l-[var(--coral)]";
    if (u === "important") return "border-l-amber-400";
    return "border-l-[var(--line)]";
  };

  // Compose mode — parent view
  if (composeMode) {
    if (sendTo) {
      const dest = studentAccounts.find((a) => a.id === sendTo);
      if (!dest) return null;
      // Dynamic import of MessageCompose (loaded only when needed)
      const [Compose, setCompose] = useState<any>(null);
      if (!Compose) {
        import("./MessageCompose").then((m) => setCompose(() => m.MessageCompose));
        return <div className="py-8 text-center text-sm text-[var(--ink-muted)]">Loading composer…</div>;
      }
      return (
        <Compose
          fromAccountId={accountId}
          fromName={studentAccounts.find((a) => a.id === accountId)?.profile.name || "Parent"}
          toAccountId={sendTo}
          toName={dest.profile.name}
          onClose={() => setSendTo("")}
          onSent={() => setSendTo("")}
        />
      );
    }
    return (
      <div className="space-y-4 animate-fade-up">
        {onClose && <button onClick={onClose} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Back</button>}
        <h3 className="text-lg font-semibold text-[var(--ink)]">Send a Message</h3>
        {studentAccounts.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No student accounts on this device. Create a student account first.</p>
        ) : (
          <ul className="space-y-2">
            {studentAccounts.map((a) => (
              <li key={a.id}>
                <button onClick={() => setSendTo(a.id)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--teal)]/10 text-sm font-bold text-[var(--teal)]">{a.profile.name[0]?.toUpperCase() || "?"}</span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{a.profile.name}</p>
                    <p className="text-xs text-[var(--ink-muted)]">Grade {a.profile.grade} · {a.profile.school || "No school"}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <hr className="border-[var(--line)]" />
        <h3 className="text-lg font-semibold text-[var(--ink)]">Sent Messages</h3>
        {loading ? <p className="text-sm text-[var(--ink-muted)]">Loading…</p> : messages.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No messages sent yet.</p> : (
          <ul className="space-y-2">
            {[...messages].reverse().map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => {
                    if (isStudent) { setViewingId(m.id); void markAsRead(m.id); }
                    else setViewingId(m.id);
                  }}
                  className={`flex w-full items-start gap-3 border-l-4 ${urgencyColor(m.urgency)} rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--ink)] truncate">{m.title}</span>
                      <span className="shrink-0 text-[10px] text-[var(--ink-muted)]">{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)] line-clamp-1">{mdPreview(m.body)}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className={m.publicReadAt ? "text-[var(--teal)]" : "text-[var(--ink-muted)]"}>{m.publicReadAt ? `Read ${timeAgo(m.publicReadAt)}` : "Unread"}</span>
                      {m.urgency !== "routine" && <span className={`rounded-full px-1.5 py-0.5 ${m.urgency === "urgent" ? "bg-[var(--coral)]/10 text-[var(--coral)]" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>{m.urgency}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Student view — show received messages
  return (
    <div className="space-y-4 animate-fade-up">
      {onClose && <button onClick={onClose} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Back to tutor</button>}
      <h3 className="text-lg font-semibold text-[var(--ink)]">Messages</h3>
      {loading ? <p className="text-sm text-[var(--ink-muted)]">Loading…</p> : messages.length === 0 ? (
        <div className="py-8 text-center">
          <svg className="mx-auto mb-2 h-10 w-10 text-[var(--ink-muted)]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-sm text-[var(--ink-muted)]">No messages yet. Your parent can send you reminders and encouragement from the parent hub.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {[...messages].reverse().map((m) => (
            <li key={m.id}>
              <button
                onClick={() => { setViewingId(m.id); void markAsRead(m.id); }}
                className={`flex w-full items-start gap-3 border-l-4 ${urgencyColor(m.urgency)} rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5 ${!m.publicReadAt ? "ring-1 ring-[var(--teal)]/20" : ""}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--teal)]/10 text-sm font-bold text-[var(--teal)]">{m.fromName[0]?.toUpperCase() || "?"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--ink)] truncate">{m.title}</span>
                    <span className="shrink-0 text-[10px] text-[var(--ink-muted)]">{timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">From {m.fromName}</p>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)] line-clamp-1">{mdPreview(m.body)}</p>
                  {!m.publicReadAt && <span className="mt-1 inline-block rounded-full bg-[var(--teal)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--teal)]">New</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
