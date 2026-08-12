"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessages, notifyMessagesChanged, subscribeMessagesChanged } from "@/lib/messages-sync";
import { loadAccounts, type AccountRecord } from "@/lib/student-profile";

type View = "list" | "pick-student" | "compose" | "detail";

export function MessageHub({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [view, setView] = useState<View>("list");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentAccounts, setStudentAccounts] = useState<AccountRecord[]>([]);
  const [sendTo, setSendTo] = useState<string>("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compose state
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeUrgency, setComposeUrgency] = useState<"routine" | "important" | "urgent">("routine");
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState("");

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
    return () => { if (pollRef.current) clearInterval(pollRef.current); unsub(); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", refresh); };
  }, [refresh, accountId]);

  useEffect(() => {
    const store = loadAccounts();
    setStudentAccounts(store.accounts.filter((a) => a.role !== "parent"));
  }, []);

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return `${Math.round(diff / 86400000)}d ago`;
  };

  const mdPreview = (text: string, limit = 120) => {
    const plain = text.replace(/^#{1,3}\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/```[\s\S]*?```/g, "[diagram]").replace(/!\[[^\]]*\]\([^)]+\)/g, "[image]").replace(/\n{2,}/g, " ").replace(/\n/g, " ");
    return plain.length > limit ? plain.slice(0, limit) + "..." : plain;
  };

  const renderBody = (md: string) => {
    return md
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^### (.*$)/gm, "<h3 class='text-base font-semibold text-[var(--ink)] mt-2 mb-1'>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2 class='text-lg font-semibold text-[var(--ink)] mt-2 mb-1'>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1 class='text-xl font-semibold text-[var(--ink)] mt-2 mb-1'>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<b class='font-semibold'>$1</b>")
      .replace(/\*(.+?)\*/g, "<i>$1</i>")
      .replace(/^\- (.*$)/gm, "<li class='ml-4 list-disc text-sm'>$1</li>")
      .replace(/`([^`]+)`/g, "<code class='rounded bg-[var(--mist)] px-1 py-0.5 text-xs font-mono'>$1</code>")
      .replace(/\n\n/g, "<br/><br/>");
  };

  const sendMessage = async () => {
    if (!composeTitle.trim() || !composeBody.trim() || !sendTo) return;
    setComposeSending(true); setComposeError("");
    try {
      const dest = studentAccounts.find((a) => a.id === sendTo);
      const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toAccountId: sendTo, fromAccountId: accountId, fromName: accountName, title: composeTitle.trim(), body: composeBody.trim(), urgency: composeUrgency }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed");
      notifyMessagesChanged({ accountId: sendTo });
      notifyMessagesChanged({ accountId });
      setComposeTitle(""); setComposeBody(""); setComposeUrgency("routine");
      setView("list");
    } catch (e) { setComposeError(e instanceof Error ? e.message : "Failed"); }
    finally { setComposeSending(false); }
  };

  // Pick student view
  if (view === "pick-student") {
    return (
      <div className="space-y-4">
        <button onClick={() => setView("list")} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Back</button>
        <p className="text-sm text-[var(--ink-muted)]">Choose which student to message:</p>
        {studentAccounts.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No student accounts found.</p> : <ul className="space-y-2">{studentAccounts.map((a) => (<li key={a.id}><button onClick={() => { setSendTo(a.id); setView("compose"); }} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--teal)]/10 text-sm font-bold text-[var(--teal)]">{a.profile.name[0]?.toUpperCase() || "?"}</span><div><p className="text-sm font-semibold text-[var(--ink)]">{a.profile.name}</p><p className="text-xs text-[var(--ink-muted)]">Grade {a.profile.grade}</p></div></button></li>))}</ul>}
      </div>
    );
  }

  // Compose view
  if (view === "compose") {
    const dest = studentAccounts.find((a) => a.id === sendTo);
    return (
      <div className="space-y-4">
        <button onClick={() => setView("pick-student")} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Pick another student</button>
        <p className="text-sm text-[var(--ink-muted)]">To: <span className="font-semibold text-[var(--ink)]">{dest ? dest.profile.name : "Student"}</span></p>
        <input value={composeTitle} onChange={(e) => setComposeTitle(e.target.value)} placeholder='Message title (e.g. "Math practice reminder")' className="w-full rounded-xl border border-[var(--line)] bg-white/90 px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10" maxLength={200} />
        <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder={"Write in Markdown...\n\n**Bold**, *italic*, bullet lists\n\nFor diagrams:\n```mermaid\ngraph TD\n  A[Start] --> B[Practice]\n```"} rows={10} className="min-h-[10rem] w-full resize-y rounded-xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm text-[var(--ink)] font-mono outline-none focus:border-[var(--teal)] dark:bg-white/10" />
        <div className="flex flex-wrap items-center gap-2">
          {(["routine", "important", "urgent"] as const).map((u) => (<button key={u} onClick={() => setComposeUrgency(u)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${composeUrgency === u ? (u === "urgent" ? "bg-[var(--coral)] text-white" : u === "important" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-[var(--mist)] text-[var(--ink-muted)]") : "border border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] dark:bg-white/5"}`}>{u}</button>))}
        </div>
        <button onClick={() => void sendMessage()} disabled={composeSending || !composeTitle.trim() || !composeBody.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45">{composeSending ? "Sending..." : "Send message"}</button>
        {composeError && <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">{composeError}</p>}
      </div>
    );
  }

  // Detail view
  if (view === "detail" && viewingId) {
    const msg = messages.find((m) => m.id === viewingId);
    if (!msg) return null;
    const destName = studentAccounts.find((a) => a.id === msg.toAccountId)?.profile.name || "Student";
    return (
      <div className="space-y-4">
        <button onClick={() => { setViewingId(null); setView("list"); }} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Back to sent messages</button>
        <div className="rounded-2xl border border-[var(--line)] bg-white/85 p-5 dark:bg-white/5">
          <h3 className="text-lg font-semibold text-[var(--ink)]">{msg.title}</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">To: {destName} · {timeAgo(msg.createdAt)} · {msg.publicReadAt ? <span className="text-[var(--teal)]">Read {timeAgo(msg.publicReadAt)}</span> : <span className="text-[var(--ink-muted)]">Unread</span>}</p>
          <hr className="my-3 border-[var(--line)]" />
          <div className="text-sm leading-relaxed text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: renderBody(msg.body) }} />
        </div>
      </div>
    );
  }

  // Main list
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--ink-muted)]">{messages.length} message{messages.length !== 1 ? "s" : ""} sent</span>
        <button onClick={() => setView("pick-student")} className="rounded-full bg-[var(--teal)] px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90">New Message</button>
      </div>
      {loading ? <p className="text-sm text-[var(--ink-muted)]">Loading...</p> : messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] py-8 text-center"><p className="text-sm text-[var(--ink-muted)]">Send your first message — a study reminder, encouragement, or a fun note.</p></div>
      ) : (
        <ul className="space-y-2">
          {[...messages].reverse().slice(0, 20).map((m) => (
            <li key={m.id}><button onClick={() => { setViewingId(m.id); setView("detail"); }} className={`flex w-full items-start gap-3 border-l-4 ${m.urgency === "urgent" ? "border-l-[var(--coral)]" : m.urgency === "important" ? "border-l-amber-400" : "border-l-[var(--line)]"} rounded-xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] dark:bg-white/5`}><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-[var(--ink)] truncate">{m.title}</span><span className="shrink-0 text-[10px] text-[var(--ink-muted)]">{timeAgo(m.createdAt)}</span></div><p className="mt-0.5 text-xs text-[var(--ink-muted)]">To: {studentAccounts.find((a) => a.id === m.toAccountId)?.profile.name || "Student"}</p><p className="mt-0.5 text-xs text-[var(--ink-muted)] line-clamp-1">{mdPreview(m.body)}</p><div className="mt-1 flex items-center gap-2"><span className={`text-[10px] ${m.publicReadAt ? "text-[var(--teal)]" : "text-[var(--ink-muted)]"}`}>{m.publicReadAt ? `Read ${timeAgo(m.publicReadAt)}` : "Unread"}</span>{m.urgency !== "routine" && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${m.urgency === "urgent" ? "bg-[var(--coral)]/10 text-[var(--coral)]" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>{m.urgency}</span>}</div></div></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
