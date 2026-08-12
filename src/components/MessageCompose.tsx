"use client";

import { useState } from "react";
import { notifyMessagesChanged } from "@/lib/messages-sync";

type ComposeProps = {
  fromAccountId: string;
  fromName: string;
  toAccountId: string;
  toName: string;
  onClose: () => void;
  onSent: () => void;
};

export function MessageCompose({ fromAccountId, fromName, toAccountId, toName, onClose, onSent }: ComposeProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState<"routine" | "important" | "urgent">("routine");
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true); setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAccountId, fromAccountId, fromName, title: title.trim(), body: body.trim(), urgency }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed");
      notifyMessagesChanged({ accountId: toAccountId });
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message");
    } finally { setSending(false); }
  };

  // Simple Markdown preview (just render bold/italic/headers/bullets with basic HTML)
  const renderPreview = (md: string) => {
    let html = md
      .replace(/^### (.*$)/gm, "<h3 class='text-base font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2 class='text-lg font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1 class='text-xl font-semibold text-[var(--ink)] mt-3 mb-1'>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<b class='font-semibold'>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>")
      .replace(/^\- (.*$)/gm, "<li class='ml-4 list-disc'>$1</li>")
      .replace(/^(\d+)\. (.*$)/gm, "<li class='ml-4 list-decimal'>$2</li>")
      .replace(/`([^`]+)`/g, "<code class='rounded bg-[var(--mist)] px-1 text-xs'>$1</code>")
      .replace(/\n\n/g, "<br/><br/>");
    return html;
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <button onClick={onClose} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Back to messages</button>
      <div>
        <p className="text-sm font-medium text-[var(--ink-muted)]">To: <span className="text-[var(--ink)]">{toName}</span></p>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Message title (e.g. 'Math practice reminder')" className="w-full rounded-xl border border-[var(--line)] bg-white/90 px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10" maxLength={200} />
      {preview ? (
        <div className="min-h-[12rem] rounded-xl border border-[var(--line)] bg-white/85 p-4 text-sm leading-relaxed text-[var(--ink)] dark:bg-white/5" dangerouslySetInnerHTML={{ __html: renderPreview(body) }} />
      ) : (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message in Markdown...

**Bold text**, *italic*, - bullet lists

For mermaid diagrams use:
```mermaid
graph TD
  A[Start] --> B[Practice]
```
" rows={12} className="min-h-[12rem] w-full resize-y rounded-xl border border-[var(--line)] bg-white/90 px-4 py-3 text-sm text-[var(--ink)] font-mono outline-none focus:border-[var(--teal)] dark:bg-white/10" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setPreview((p) => !p)} className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs font-medium text-[var(--ink-muted)] transition hover:bg-[var(--mist)] dark:bg-white/5">{preview ? "Edit" : "Preview"}</button>
        <span className="text-xs text-[var(--ink-muted)]">Urgency:</span>
        {(["routine", "important", "urgent"] as const).map((u) => (
          <button key={u} onClick={() => setUrgency(u)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${urgency === u ? (u === "urgent" ? "bg-[var(--coral)] text-white" : u === "important" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-[var(--mist)] text-[var(--ink-muted)]") : "border border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] dark:bg-white/5"}`}>{u === "routine" ? "Routine" : u === "important" ? "Important" : "Urgent"}</button>
        ))}
      </div>
      <button onClick={() => void send()} disabled={sending || !title.trim() || !body.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45">
        {sending ? "Sending..." : `Send to ${toName}`}
      </button>
      {error && <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">{error}</p>}
    </div>
  );
}
