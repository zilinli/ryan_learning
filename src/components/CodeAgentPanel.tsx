"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MiniConsoleThread } from "./MiniConsoleThread";
import { ConsoleComposer } from "./ConsoleComposer";
import { PinGate } from "./PinGate";
import { getConsoleSessionId } from "@/lib/mini-console-store";
import type { ConsoleMessage, DiffBlock } from "@/lib/types";

type Props = { open: boolean; onClose: () => void };

const ACC_URL = typeof window !== "undefined"
  ? `http://${window.location.hostname}:3001/`
  : "http://65.49.201.123:3001/";

const HINT_EXAMPLES = [
  "Make the text bigger",
  "Add a dark orange accent",
  "Fix the photo on mobile",
  "Show math steps one by one",
  "Add a new subject filter",
];

export function CodeAgentPanel({ open, onClose }: Props) {
  const [phase, setPhase] = useState<"idle" | "thinking" | "diff" | "applied" | "error">("idle");
  const [msgs, setMsgs] = useState<ConsoleMessage[]>([]);
  const [err, setError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [diff, setDiff] = useState<DiffBlock | null>(null);
  const [accAvailable, setAccAvailable] = useState(false);
  const [hint, setHint] = useState(HINT_EXAMPLES[0]);
  const sid = useRef(getConsoleSessionId());
  const ab = useRef<AbortController | null>(null);

  // Load previous session messages on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/console/chat?sessionId=${encodeURIComponent(sid.current)}`)
      .then(r => r.ok ? r.json().catch(() => ({})) : ({} as Record<string,unknown>))
      .then(d => {
        if (cancelled) return;
        const ms = (d as { messages?: ConsoleMessage[] }).messages;
        if (Array.isArray(ms) && ms.length) setMsgs(ms.slice(-10));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  // Check ACC availability
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(ACC_URL, { mode: "no-cors" })
      .then(() => { if (!cancelled) setAccAvailable(true); })
      .catch(() => { if (!cancelled) setAccAvailable(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Rotate hint
  useEffect(() => {
    if (phase !== "idle") return;
    const t = setInterval(() => {
      setHint(HINT_EXAMPLES[Math.floor(Math.random() * HINT_EXAMPLES.length)]);
    }, 4000);
    return () => clearInterval(t);
  }, [phase]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Escape key close
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  const send = useCallback(async (text: string) => {
    setPhase("thinking");
    setError("");
    setDiff(null);
    setMsgs(p => [...p, { id: "cm_" + Date.now(), role: "user", content: text, createdAt: Date.now() }]);
    // Abort any previous inflight
    ab.current?.abort();
    const c = new AbortController();
    ab.current = c;
    try {
      const res = await fetch("/api/console/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid.current, message: text }),
        signal: c.signal,
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Error " + res.status);
      let full = "";
      const r = res.body!.getReader();
      const d = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await r.read();
        if (done) break;
        buf += d.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const ls = p.split("\n");
          let ev = "message", dl = "";
          for (const l of ls) {
            if (l.startsWith("event:")) ev = l.slice(6).trim();
            if (l.startsWith("data:")) dl += l.slice(5).trim();
          }
          if (!dl) continue;
          try {
            const data = JSON.parse(dl) as { text?: string; error?: string };
            if (ev === "delta" && data.text) full += data.text;
            if (ev === "error" && data.error) throw new Error(data.error);
            if (ev === "done") full = data.text || full;
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      const hasDiff = /\+\+\+|diff --git/i.test(full);
      setMsgs(p => [...p, { id: "cm_" + Date.now(), role: "assistant", content: full || "Done!", createdAt: Date.now() }]);
      if (hasDiff) {
        const m = full.match(/```diff\n?([\s\S]*?)```/);
        const raw = m ? m[1] : full;
        setDiff({
          filepath: (full.match(/file[:\s]+([a-z0-9_/. -]+\.(tsx?|css|js|json|md))/i)?.[1]) || "file",
          hunks: raw,
          added: (raw.match(/^\+/gm) || []).length,
          removed: (raw.match(/^-/gm) || []).length,
        });
        setPhase("diff");
      } else {
        setPhase("applied");
        setTimeout(() => setPhase("idle"), 4000);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Error";
      const friendly: Record<string, string> = {
        "Failed to fetch": "Connection lost — check network and try again",
        "Error 503": "Service starting up — try again in a moment",
        "Error 502": "Service is restarting — try again shortly",
      };
      setError(friendly[msg] || friendly[msg.split(" ").slice(0, 2).join(" ")] || msg);
      setPhase("error");
      setMsgs(p => [...p, { id: "cm_" + Date.now(), role: "system", content: "Error: " + msg, createdAt: Date.now() }]);
    }
  }, []);

  const clearSession = useCallback(() => {
    setMsgs([]);
    setPhase("idle");
    setDiff(null);
    setError("");
    ab.current?.abort();
  }, []);

  const lock = useCallback(() => {
    setShowPin(false);
    setPhase("applied");
    setTimeout(() => { setPhase("idle"); setDiff(null); }, 3000);
  }, []);

  if (!open) return null;

  const hd = (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--line)]/50">
      <div className="flex items-center gap-2">
        <span className="text-base">🤖</span>
        <span className="text-sm font-semibold text-[var(--ink)]">Code Agent</span>
        {msgs.length > 0 && (
          <button
            type="button"
            onClick={clearSession}
            className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)] hover:bg-[var(--mist)]"
            title="New session"
          >
            + New
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        {accAvailable && (
          <a
            href={ACC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-3 py-1 text-[11px] font-medium text-[var(--teal)] hover:bg-[var(--teal)]/10"
            title="Open full Agent Chat Console in new tab"
          >
            ↗ ACC
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--mist)]"
          aria-label="Close code agent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );

  const empty = phase === "idle" && msgs.length === 0 && (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-6 text-center">
      <span className="text-3xl">🛠</span>
      <p className="text-sm font-semibold text-[var(--ink)]">Tell Spark how to improve</p>
      <p className="text-xs text-[var(--ink-muted)] leading-relaxed max-w-[260px]">
        Describe what you want changed — fonts, colors, layout, features. The code agent reads your files and makes edits.
      </p>
      <div className="flex flex-col gap-1.5 mt-1">
        <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wide">Try:</p>
        {HINT_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => send(ex)}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)] transition text-left"
          >
            • {ex}
          </button>
        ))}
      </div>
    </div>
  );

  const errBanner = err ? (
    <div className="mx-3 mb-1 rounded-lg border border-[var(--coral)]/30 bg-[var(--coral)]/5 px-3 py-2">
      <p className="text-xs font-medium text-[var(--coral)]">{err}</p>
      <button
        type="button"
        onClick={() => { setError(""); setPhase("idle"); }}
        className="mt-1 text-[11px] font-medium text-[var(--teal)] hover:underline"
      >
        Dismiss
      </button>
    </div>
  ) : null;

  const diffBlock = phase === "diff" && diff ? (
    <div className="mx-3 mb-2">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg0)] p-2">
        <p className="mb-1 text-[10px] font-semibold text-[var(--ink-muted)]">
          {diff.filepath} <span className="text-[var(--teal)]">+{diff.added}</span>{" "}
          <span className="text-[var(--coral)]">-{diff.removed}</span>
        </p>
        <pre className="max-h-[120px] overflow-y-auto rounded bg-[var(--mist)]/50 p-2 text-[11px] text-[var(--ink)] leading-snug whitespace-pre-wrap">
          {diff.hunks.slice(0, 600)}
        </pre>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setShowPin(true)}
          className="flex-1 rounded-full bg-[var(--teal)] py-1.5 text-xs font-semibold text-white hover:brightness-105"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => { setPhase("idle"); setDiff(null); }}
          className="flex-1 rounded-full border border-[var(--line)] py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--mist)]"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  const appliedBanner = phase === "applied" ? (
    <div className="mx-3 mb-2 rounded-lg bg-[var(--teal)]/10 px-3 py-2 text-center">
      <p className="text-xs font-semibold text-[var(--teal)]">✓ Changes applied</p>
    </div>
  ) : null;

  const panelContent = (
    <>
      {hd}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty}
        <MiniConsoleThread messages={msgs} streaming={phase === "thinking"} />
      </div>
      {errBanner}
      {appliedBanner}
      {diffBlock}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <ConsoleComposer
          disabled={phase === "thinking"}
          singleLine
          placeholder={`Try: ${hint}`}
          onSubmit={send}
        />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: slide-in from right */}
      <div className="hidden lg:block">
        <div className="fixed right-0 top-0 z-30 flex h-dvh w-[min(420px,42vw)] flex-col border-l border-[var(--line)] bg-[var(--bg0)] shadow-2xl animate-slide-in-right">
          {panelContent}
        </div>
      </div>

      {/* Mobile / tablet: bottom sheet */}
      <div className="fixed inset-0 z-30 lg:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-[rgba(10,28,34,0.45)]"
          onClick={onClose}
          aria-label="Close code agent"
        />
        <div className="absolute inset-x-0 bottom-0 flex max-h-[65vh] flex-col rounded-t-2xl bg-[var(--bg0)] shadow-2xl animate-slide-up">
          <div
            className="flex justify-center py-2 cursor-grab"
            onPointerDown={(e) => {
              const startY = e.clientY;
              const onMove = (ev: PointerEvent) => {
                if (ev.clientY - startY > 60) {
                  onClose();
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                }
              };
              const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
          >
            <div className="h-1 w-10 rounded-full bg-[var(--line)]" />
          </div>
          {panelContent}
        </div>
      </div>

      {showPin ? <PinGate onUnlock={lock} onCancel={() => setShowPin(false)} /> : null}
    </>
  );
}
