"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import {
  fetchMessages,
  notifyMessagesChanged,
  subscribeMessagesChanged,
} from "@/lib/messages-sync";
import { loadAccounts, type AccountRecord } from "@/lib/student-profile";

type Msg = {
  id: string;
  fromName?: string;
  toAccountId?: string;
  title: string;
  body: string;
  urgency: string;
  createdAt: number;
  publicReadAt?: number;
};

type MessageListProps = {
  accountId: string;
  /** If set, shows compose UI (parent mode). */
  composeMode?: boolean;
  onClose?: () => void;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

function mdPreview(text: string, limit = 120): string {
  const plain = text
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "[diagram]")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "[image: $1]")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ");
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}

/** Full markdown-ish body — keep every line break so long notes are readable. */
function renderBody(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, "<h3 class='text-base font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2 class='text-lg font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1 class='text-xl font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<b class='font-semibold'>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/^[-•] (.*)$/gm, "<li class='ml-4 list-disc text-sm leading-relaxed'>$1</li>")
    .replace(/`([^`]+)`/g, "<code class='rounded bg-[var(--mist)] px-1 py-0.5 text-xs font-mono'>$1</code>")
    .replace(/\n/g, "<br/>");
}

function urgencyBorder(u: string): string {
  if (u === "urgent") return "border-l-[var(--coral)]";
  if (u === "important") return "border-l-amber-400";
  return "border-l-[var(--line)]";
}

export function MessageList({ accountId, composeMode, onClose }: MessageListProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [studentAccounts, setStudentAccounts] = useState<AccountRecord[]>([]);
  const [sendTo, setSendTo] = useState<string>("");
  const [Compose, setCompose] = useState<ComponentType<{
    fromAccountId: string;
    fromName: string;
    toAccountId: string;
    toName: string;
    onClose: () => void;
    onSent: () => void;
  }> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const result = await fetchMessages(accountId);
    if (result) setMessages(result.messages as Msg[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    void refresh();
    pollRef.current = setInterval(() => void refresh(), 8000);
    const unsub = subscribeMessagesChanged((d) => {
      if (d.accountId === accountId) void refresh();
    });
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", () => void refresh());
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", () => void refresh());
    };
  }, [refresh, accountId]);

  useEffect(() => {
    if (composeMode) {
      const store = loadAccounts();
      setStudentAccounts(
        store.accounts.filter((a) => a.role !== "parent" && a.id !== accountId),
      );
    }
  }, [composeMode, accountId]);

  useEffect(() => {
    if (!composeMode || !sendTo || Compose) return;
    void import("./MessageCompose").then((m) => setCompose(() => m.MessageCompose));
  }, [composeMode, sendTo, Compose]);

  const markAsRead = async (msgId: string) => {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, messageId: msgId }),
      });
      notifyMessagesChanged({ accountId });
      void refresh();
    } catch {
      /* ignore */
    }
  };

  const removeMessage = async (msgId: string) => {
    if (!window.confirm("Delete this message?")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, messageId: msgId }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!data.ok) throw new Error("Delete failed");
      notifyMessagesChanged({ accountId });
      setViewingId(null);
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const viewing = viewingId
    ? messages.find((m) => m.id === viewingId) || null
    : null;

  if (viewing) {
    return (
      <div className="flex min-h-0 flex-col space-y-3 animate-fade-up">
        <button
          type="button"
          onClick={() => setViewingId(null)}
          className="self-start text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back to messages
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/85 p-5 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-[var(--ink)]">{viewing.title}</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {viewing.fromName ? `From ${viewing.fromName}` : "Message"} ·{" "}
            {timeAgo(viewing.createdAt)}
            {viewing.urgency !== "routine" ? ` · ${viewing.urgency}` : ""}
          </p>
          <hr className="my-3 border-[var(--line)]" />
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]"
            dangerouslySetInnerHTML={{ __html: renderBody(viewing.body) }}
          />
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void removeMessage(viewing.id)}
          className="self-end rounded-full border border-[var(--coral)]/40 px-3 py-1.5 text-xs font-medium text-[var(--coral)] hover:bg-[var(--coral)]/10 disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    );
  }

  // Compose mode — parent view
  if (composeMode) {
    if (sendTo) {
      const dest = studentAccounts.find((a) => a.id === sendTo);
      if (!dest) return null;
      if (!Compose) {
        return (
          <div className="py-8 text-center text-sm text-[var(--ink-muted)]">
            Loading composer…
          </div>
        );
      }
      return (
        <Compose
          fromAccountId={accountId}
          fromName={
            studentAccounts.find((a) => a.id === accountId)?.profile.name ||
            "Parent"
          }
          toAccountId={sendTo}
          toName={dest.profile.name}
          onClose={() => setSendTo("")}
          onSent={() => setSendTo("")}
        />
      );
    }
    return (
      <div className="space-y-4 animate-fade-up">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
          >
            &larr; Back
          </button>
        )}
        <h3 className="text-lg font-semibold text-[var(--ink)]">Send a Message</h3>
        {studentAccounts.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            No student accounts on this device. Create a student account first.
          </p>
        ) : (
          <ul className="space-y-2">
            {studentAccounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSendTo(a.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--teal)]/10 text-sm font-bold text-[var(--teal)]">
                    {a.profile.name[0]?.toUpperCase() || "?"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      {a.profile.name}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Grade {a.profile.grade} · {a.profile.school || "No school"}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <hr className="border-[var(--line)]" />
        <h3 className="text-lg font-semibold text-[var(--ink)]">Sent Messages</h3>
        {loading ? (
          <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No messages sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...messages].reverse().map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setViewingId(m.id)}
                  className={`flex w-full items-start gap-3 border-l-4 ${urgencyBorder(m.urgency)} rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--ink)]">
                        {m.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--ink-muted)]">
                        {timeAgo(m.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)] line-clamp-1">
                      {mdPreview(m.body)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Student view — received messages
  return (
    <div className="space-y-4 animate-fade-up">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back to tutor
        </button>
      )}
      <h3 className="text-lg font-semibold text-[var(--ink)]">Messages</h3>
      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
      ) : messages.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--ink-muted)]">
            No messages yet. Your parent can send you reminders and encouragement
            from the parent hub.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {[...messages].reverse().map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setViewingId(m.id);
                  void markAsRead(m.id);
                }}
                className={`flex w-full items-start gap-3 border-l-4 ${urgencyBorder(m.urgency)} rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5 ${!m.publicReadAt ? "ring-1 ring-[var(--teal)]/20" : ""}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--teal)]/10 text-sm font-bold text-[var(--teal)]">
                  {m.fromName?.[0]?.toUpperCase() || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--ink)]">
                      {m.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--ink-muted)]">
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    From {m.fromName || "Parent"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)] line-clamp-2">
                    {mdPreview(m.body, 160)}
                  </p>
                  {!m.publicReadAt && (
                    <span className="mt-1 inline-block rounded-full bg-[var(--teal)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--teal)]">
                      New
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
