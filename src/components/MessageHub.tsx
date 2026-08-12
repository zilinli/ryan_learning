"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type View = "list" | "pick-student" | "compose" | "detail";

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
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "[image]")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ");
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}

function renderBody(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /^### (.*)$/gm,
      "<h3 class='text-base font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h3>",
    )
    .replace(
      /^## (.*)$/gm,
      "<h2 class='text-lg font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h2>",
    )
    .replace(
      /^# (.*)$/gm,
      "<h1 class='text-xl font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h1>",
    )
    .replace(/\*\*(.+?)\*\*/g, "<b class='font-semibold'>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(
      /^[-•] (.*)$/gm,
      "<li class='ml-4 list-disc text-sm leading-relaxed'>$1</li>",
    )
    .replace(
      /`([^`]+)`/g,
      "<code class='rounded bg-[var(--mist)] px-1 py-0.5 text-xs font-mono'>$1</code>",
    )
    .replace(/\n/g, "<br/>");
}

export function MessageHub({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const [view, setView] = useState<View>("list");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentAccounts, setStudentAccounts] = useState<AccountRecord[]>([]);
  const [sendTo, setSendTo] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeUrgency, setComposeUrgency] = useState<
    "routine" | "important" | "urgent"
  >("routine");
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState("");

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
    const store = loadAccounts();
    setStudentAccounts(store.accounts.filter((a) => a.role !== "parent"));
  }, []);

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
      setView("list");
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const sendMessage = async () => {
    if (!composeTitle.trim() || !composeBody.trim() || !sendTo) return;
    setComposeSending(true);
    setComposeError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAccountId: sendTo,
          fromAccountId: accountId,
          fromName: accountName,
          title: composeTitle.trim(),
          body: composeBody.trim(),
          urgency: composeUrgency,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || "Failed");
      notifyMessagesChanged({ accountId: sendTo });
      notifyMessagesChanged({ accountId });
      setComposeTitle("");
      setComposeBody("");
      setComposeUrgency("routine");
      setView("list");
      await refresh();
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : "Failed");
    } finally {
      setComposeSending(false);
    }
  };

  if (view === "pick-student") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setView("list")}
          className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back
        </button>
        <p className="text-sm text-[var(--ink-muted)]">
          Choose which student to message:
        </p>
        {studentAccounts.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            No student accounts found.
          </p>
        ) : (
          <ul className="space-y-2">
            {studentAccounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSendTo(a.id);
                    setView("compose");
                  }}
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
                      Grade {a.profile.grade}
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

  if (view === "compose") {
    const dest = studentAccounts.find((a) => a.id === sendTo);
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setView("pick-student")}
          className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Pick another student
        </button>
        <p className="text-sm text-[var(--ink-muted)]">
          To:{" "}
          <span className="font-semibold text-[var(--ink)]">
            {dest ? dest.profile.name : "Student"}
          </span>
        </p>
        <input
          value={composeTitle}
          onChange={(e) => setComposeTitle(e.target.value)}
          placeholder='Message title (e.g. "Studio + Me")'
          className="w-full rounded-xl border border-[var(--line)] bg-white/90 px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10"
          maxLength={200}
        />
        <textarea
          value={composeBody}
          onChange={(e) => setComposeBody(e.target.value)}
          placeholder="Write your note…"
          rows={12}
          className="min-h-[14rem] w-full resize-y rounded-xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10"
        />
        <div className="flex flex-wrap items-center gap-2">
          {(["routine", "important", "urgent"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setComposeUrgency(u)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                composeUrgency === u
                  ? u === "urgent"
                    ? "bg-[var(--coral)] text-white"
                    : u === "important"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-[var(--mist)] text-[var(--ink-muted)]"
                  : "border border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] dark:bg-white/5"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={
            composeSending || !composeTitle.trim() || !composeBody.trim()
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45"
        >
          {composeSending ? "Sending…" : "Send message"}
        </button>
        {composeError ? (
          <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">
            {composeError}
          </p>
        ) : null}
      </div>
    );
  }

  if (view === "detail" && viewingId) {
    const msg = messages.find((m) => m.id === viewingId);
    if (!msg) {
      return (
        <button
          type="button"
          onClick={() => {
            setViewingId(null);
            setView("list");
          }}
          className="text-xs font-medium text-[var(--ink-muted)]"
        >
          &larr; Back
        </button>
      );
    }
    const destName =
      studentAccounts.find((a) => a.id === msg.toAccountId)?.profile.name ||
      "Student";
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setViewingId(null);
            setView("list");
          }}
          className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back to sent messages
        </button>
        <div className="max-h-[min(70dvh,36rem)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/85 p-5 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-[var(--ink)]">{msg.title}</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            To: {destName} · {timeAgo(msg.createdAt)} ·{" "}
            {msg.publicReadAt ? (
              <span className="text-[var(--teal)]">
                Read {timeAgo(msg.publicReadAt)}
              </span>
            ) : (
              <span className="text-[var(--ink-muted)]">Unread</span>
            )}
          </p>
          <hr className="my-3 border-[var(--line)]" />
          <div
            className="text-sm leading-relaxed text-[var(--ink)]"
            dangerouslySetInnerHTML={{ __html: renderBody(msg.body) }}
          />
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void removeMessage(msg.id)}
          className="rounded-full border border-[var(--coral)]/40 px-4 py-2 text-xs font-medium text-[var(--coral)] hover:bg-[var(--coral)]/10 disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Delete message"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--ink-muted)]">
          {messages.length} message{messages.length !== 1 ? "s" : ""} sent
        </span>
        <button
          type="button"
          onClick={() => setView("pick-student")}
          className="rounded-full bg-[var(--teal)] px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          New Message
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] py-8 text-center">
          <p className="text-sm text-[var(--ink-muted)]">
            Send your first message — a study reminder, encouragement, or a fun
            note.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {[...messages]
            .reverse()
            .slice(0, 20)
            .map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setViewingId(m.id);
                    setView("detail");
                  }}
                  className={`flex w-full items-start gap-3 border-l-4 ${
                    m.urgency === "urgent"
                      ? "border-l-[var(--coral)]"
                      : m.urgency === "important"
                        ? "border-l-amber-400"
                        : "border-l-[var(--line)]"
                  } rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5`}
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
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                      To:{" "}
                      {studentAccounts.find((a) => a.id === m.toAccountId)
                        ?.profile.name || "Student"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)] line-clamp-2">
                      {mdPreview(m.body, 160)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`text-[10px] ${m.publicReadAt ? "text-[var(--teal)]" : "text-[var(--ink-muted)]"}`}
                      >
                        {m.publicReadAt
                          ? `Read ${timeAgo(m.publicReadAt)}`
                          : "Unread"}
                      </span>
                      {m.urgency !== "routine" ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            m.urgency === "urgent"
                              ? "bg-[var(--coral)]/10 text-[var(--coral)]"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {m.urgency}
                        </span>
                      ) : null}
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
