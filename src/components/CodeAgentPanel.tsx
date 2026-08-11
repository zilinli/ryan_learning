"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeAgentThread } from "./CodeAgentThread";
import { ConsoleComposer, type ComposerSubmit } from "./ConsoleComposer";
import { PinGate } from "./PinGate";
import {
  clearCodeAgentPanelContext,
  getConsoleSessionId,
  loadCodeAgentPanelContext,
  saveCodeAgentPanelContext,
} from "@/lib/mini-console-store";
import { consumeConsoleSse } from "@/lib/console-sse";
import type { ConsoleRunSnapshot } from "@/lib/console-run-store";
import type { ClientAttachment } from "@/lib/file-payload";
import type { ConsoleMessage, DiffBlock, ToolCall } from "@/lib/types";
import {
  SAFE_SUGGESTIONS,
  needsParentPinForConsole,
} from "@/lib/console-safe-intent";
import { isParentSessionUnlocked } from "@/lib/adult-gate";

type Props = { open: boolean; onClose: () => void; onMinimize: () => void };

const ACC_URL = typeof window !== "undefined"
  ? `http://${window.location.hostname}:3001/`
  : "http://65.49.201.123:3001/";

const HINT_EXAMPLES = SAFE_SUGGESTIONS;

function finishFromText(
  full: string,
  setDiff: (d: DiffBlock | null) => void,
  setPhase: (p: "idle" | "thinking" | "diff" | "applied" | "error") => void,
) {
  const hasDiff = /\+\+\+|diff --git/i.test(full);
  if (hasDiff) {
    const m = full.match(/```diff\n?([\s\S]*?)```/);
    const raw = m ? m[1]! : full;
    setDiff({
      filepath: (full.match(/file[:\s]+([a-z0-9_/. -]+\.(tsx?|css|js|json|md))/i)?.[1]) || "file",
      hunks: raw, added: (raw.match(/^\+/gm) || []).length, removed: (raw.match(/^-/gm) || []).length,
    });
    setPhase("diff");
  } else {
    setPhase("applied");
    setTimeout(() => setPhase("idle"), 4000);
  }
}

export function CodeAgentPanel({ open, onClose, onMinimize }: Props) {
  const [phase, setPhase] = useState<"idle" | "thinking" | "diff" | "applied" | "error">("idle");
  const [msgs, setMsgs] = useState<ConsoleMessage[]>([]);
  const [err, setError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinReason, setPinReason] = useState<"send" | "apply">("apply");
  const [pendingSubmit, setPendingSubmit] = useState<ComposerSubmit | null>(null);
  const [diff, setDiff] = useState<DiffBlock | null>(null);
  const [accAvailable, setAccAvailable] = useState(false);
  const [hint, setHint] = useState(HINT_EXAMPLES[0]);
  const [streamingContent, setStreamingContent] = useState("");
  const [statusText, setStatusText] = useState("");
  const [runningTools, setRunningTools] = useState<ToolCall[]>([]);
  const sid = useRef(getConsoleSessionId());
  const ab = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | undefined>(undefined);
  const lastEventIdRef = useRef(0);
  const resumingRef = useRef(false);
  const restoredRef = useRef(false);
  const phaseRef = useRef(phase);
  const msgsRef = useRef(msgs);
  const streamRef = useRef(streamingContent);
  const statusRef = useRef(statusText);
  const errRef = useRef(err);
  phaseRef.current = phase;
  msgsRef.current = msgs;
  streamRef.current = streamingContent;
  statusRef.current = statusText;
  errRef.current = err;

  const persist = useCallback((patch?: {
    phase?: typeof phase;
    messages?: ConsoleMessage[];
    runId?: string | null;
    streamingContent?: string;
    statusText?: string;
    error?: string;
  }) => {
    const nextRunId = patch && "runId" in patch
      ? (patch.runId ?? undefined)
      : runIdRef.current;
    if (patch && "runId" in patch) runIdRef.current = nextRunId;
    saveCodeAgentPanelContext({
      sessionId: sid.current,
      phase: patch?.phase ?? phaseRef.current,
      messages: patch?.messages ?? msgsRef.current,
      runId: nextRunId,
      lastEventId: lastEventIdRef.current,
      streamingContent: patch?.streamingContent ?? streamRef.current,
      statusText: patch?.statusText ?? statusRef.current,
      error: patch?.error ?? errRef.current,
      updatedAt: Date.now(),
    });
  }, []);

  const bindSseHandlers = useCallback(() => ({
    onDelta: (_t: string, full: string) => setStreamingContent(full),
    onStatus: (status: string, data: Record<string, unknown>) => {
      setStatusText(status);
      if (data.running && typeof data.tool === "string") {
        setRunningTools(prev => [...prev, {
          tool: data.tool as string, input: data.input as string,
          output: data.output as string, status: "running" as const,
          time: new Date().toISOString(),
        }]);
      }
    },
    onToolCall: (data: Record<string, unknown>) => {
      const tc: ToolCall = {
        tool: String(data.tool || ""), input: data.input as string,
        output: data.output as string, status: data.error ? "error" : "success",
        time: new Date().toISOString(),
      };
      setRunningTools(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(t => t.tool === tc.tool && t.status === "running");
        if (idx >= 0) updated[idx] = tc; else updated.push(tc);
        return updated.slice(-10);
      });
      setStatusText(data.error ? ("✗ " + tc.tool) : ("✓ " + tc.tool));
    },
    onEventId: (id: number) => { lastEventIdRef.current = id; },
  }), []);

  const applyAssistantResult = useCallback((full: string, tools?: ToolCall[]) => {
    setStreamingContent(""); setStatusText("");
    runIdRef.current = undefined;
    lastEventIdRef.current = 0;
    setMsgs(p => {
      const last = p[p.length - 1];
      if (last?.role === "assistant" && last.content === (full || "Done!")) {
        persist({ phase: "applied", messages: p, runId: null, streamingContent: "", statusText: "" });
        return p;
      }
      const next = [...p, {
        id: "cm_" + Date.now(), role: "assistant" as const,
        content: full || "Done!", createdAt: Date.now(),
        tools: tools?.length ? tools : undefined,
      }];
      persist({ phase: "applied", messages: next, runId: null, streamingContent: "", statusText: "" });
      return next;
    });
    finishFromText(full, setDiff, setPhase);
  }, [persist]);

  const attachToRun = useCallback(async (runId: string, after: number, signal: AbortSignal): Promise<string> => {
    const url = `/api/console/chat?sessionId=${encodeURIComponent(sid.current)}`
      + `&runId=${encodeURIComponent(runId)}&after=${after}`;
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Error " + res.status);
    return consumeConsoleSse(res.body, signal, bindSseHandlers(), streamRef.current);
  }, [bindSseHandlers]);

  const resumeActive = useCallback(async () => {
    if (resumingRef.current) return;
    resumingRef.current = true;
    try {
      const res = await fetch(`/api/console/chat?sessionId=${encodeURIComponent(sid.current)}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json() as {
        messages?: ConsoleMessage[];
        activeRun?: ConsoleRunSnapshot | null;
      };
      if (Array.isArray(d.messages) && d.messages.length) {
        setMsgs(d.messages.slice(-20));
      }
      const active = d.activeRun;
      if (!active) {
        if (runIdRef.current) {
          runIdRef.current = undefined;
          lastEventIdRef.current = 0;
          const nextPhase = phaseRef.current === "thinking" ? "idle" : phaseRef.current;
          persist({ runId: null, phase: nextPhase });
          if (phaseRef.current === "thinking") setPhase("idle");
        }
        return;
      }
      runIdRef.current = active.runId;
      lastEventIdRef.current = Math.max(lastEventIdRef.current, active.lastEventId);
      if (active.status === "running") {
        setPhase("thinking");
        if (active.fullText) setStreamingContent(active.fullText);
        setStatusText("Resuming…");
        persist({ phase: "thinking", runId: active.runId, streamingContent: active.fullText || undefined });
        ab.current?.abort();
        const c = new AbortController(); ab.current = c;
        try {
          const full = await attachToRun(active.runId, lastEventIdRef.current, c.signal);
          const text = full || active.fullText || "Done!";
          applyAssistantResult(text);
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setStatusText("Reconnecting…");
        }
      } else if (active.status === "done" && active.fullText) {
        setMsgs(p => {
          const last = p[p.length - 1];
          if (last?.role === "assistant" && last.content === active.fullText) return p;
          const next = [...p, {
            id: "cm_" + Date.now(), role: "assistant" as const,
            content: active.fullText, createdAt: Date.now(),
          }];
          persist({ phase: "applied", messages: next, runId: null, streamingContent: "" });
          return next;
        });
        setStreamingContent("");
        runIdRef.current = undefined;
        finishFromText(active.fullText, setDiff, setPhase);
      } else if (active.status === "error") {
        setError(active.error || "Run failed");
        setPhase("error");
        setStreamingContent("");
        runIdRef.current = undefined;
        persist({ phase: "error", runId: null, error: active.error || "Run failed" });
      }
    } finally {
      resumingRef.current = false;
    }
  }, [attachToRun, applyAssistantResult, persist]);

  // Restore local context once, then sync from server when panel opens
  useEffect(() => {
    if (!open) return;
    if (!restoredRef.current) {
      restoredRef.current = true;
      const ctx = loadCodeAgentPanelContext();
      if (ctx.sessionId === sid.current || !ctx.sessionId) {
        if (ctx.messages.length) setMsgs(ctx.messages);
        if (ctx.phase === "thinking" || ctx.runId) {
          setPhase("thinking");
          if (ctx.streamingContent) setStreamingContent(ctx.streamingContent);
          if (ctx.statusText) setStatusText(ctx.statusText);
          runIdRef.current = ctx.runId;
          lastEventIdRef.current = ctx.lastEventId ?? 0;
        } else if (ctx.phase && ctx.phase !== "idle") {
          setPhase(ctx.phase);
        }
        if (ctx.error) setError(ctx.error);
      }
    }
    void resumeActive();
  }, [open, resumeActive]);

  // Mobile: when tab/app becomes visible again, reattach
  useEffect(() => {
    if (!open) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void resumeActive();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [open, resumeActive]);

  // Persist panel context while open
  useEffect(() => {
    if (!open) return;
    persist();
  }, [open, msgs, phase, streamingContent, statusText, err, persist]);

  useEffect(() => {
    if (!open) return; let cancelled = false;
    fetch(ACC_URL, { mode: "no-cors" })
      .then(() => { if (!cancelled) setAccAvailable(true); })
      .catch(() => { if (!cancelled) setAccAvailable(false); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (phase !== "idle") return;
    const t = setInterval(() => setHint(HINT_EXAMPLES[Math.floor(Math.random() * HINT_EXAMPLES.length)]), 4000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  const send = useCallback(async ({ text, attachments, voiceLang }: ComposerSubmit) => {
    setPhase("thinking"); setError(""); setDiff(null);
    setStreamingContent(""); setStatusText("Starting…"); setRunningTools([]);
    lastEventIdRef.current = 0;
    const userMsg: ConsoleMessage = {
      id: "cm_" + Date.now(), role: "user", content: text,
      attachments: attachments.map((a: ClientAttachment) => ({ name: a.name, kind: a.kind })),
      createdAt: Date.now(),
    };
    setMsgs(p => {
      const next = [...p, userMsg];
      persist({ phase: "thinking", messages: next, streamingContent: "", statusText: "Starting…" });
      return next;
    });
    ab.current?.abort();
    const c = new AbortController(); ab.current = c;

    const startPost = async (): Promise<{ full: string; runId?: string }> => {
      const res = await fetch("/api/console/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid.current, message: text, voiceLang,
          attachments: attachments.map((a: ClientAttachment) => ({
            name: a.name, mimeType: a.mimeType, kind: a.kind,
            data: a.data, dataUrl: a.dataUrl, textContent: a.textContent,
          })),
        }),
        signal: c.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Error " + res.status);
      const runId = res.headers.get("X-Console-Run-Id") || undefined;
      if (runId) {
        runIdRef.current = runId;
        persist({ phase: "thinking", runId });
      }
      if (!res.body) throw new Error("No stream");
      const full = await consumeConsoleSse(res.body, c.signal, bindSseHandlers());
      return { full, runId };
    };

    let retries = 0;
    while (retries <= 2) {
      try {
        retries++;
        let full: string;
        if (retries === 1) {
          ({ full } = await startPost());
        } else if (runIdRef.current) {
          setStatusText("Reconnecting…");
          full = await attachToRun(runIdRef.current, lastEventIdRef.current, c.signal);
        } else {
          ({ full } = await startPost());
        }
        applyAssistantResult(full, runningTools);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Error";
        if ((msg === "watchdog" || msg.includes("network") || msg.includes("fetch") || msg.includes("Failed")) && retries < 3) {
          setStatusText("Reconnecting…");
          continue;
        }
        const friendly: Record<string, string> = {
          "Failed to fetch": "Connection lost — check network and try again",
          "Error 503": "Service starting up — try again in a moment",
          "Error 502": "Service is restarting — try again shortly",
        };
        setError(friendly[msg] || friendly[msg.split(" ").slice(0, 2).join(" ")] || msg);
        setPhase("error"); setStreamingContent(""); setStatusText("");
        setMsgs(p => [...p, { id: "cm_" + Date.now(), role: "system", content: "Error: " + msg, createdAt: Date.now() }]);
        persist({ phase: "error", error: msg });
        return;
      }
    }
  }, [runningTools, bindSseHandlers, attachToRun, applyAssistantResult, persist]);

  const clearSession = useCallback(() => {
    setMsgs([]); setPhase("idle"); setDiff(null); setError("");
    setStreamingContent(""); setStatusText(""); setRunningTools([]);
    runIdRef.current = undefined; lastEventIdRef.current = 0;
    ab.current?.abort();
    clearCodeAgentPanelContext();
  }, []);

  const requestSend = useCallback((payload: ComposerSubmit) => {
    if (needsParentPinForConsole(payload.text, isParentSessionUnlocked())) {
      setPendingSubmit(payload);
      setPinReason("send");
      setShowPin(true);
      return;
    }
    void send(payload);
  }, [send]);

  const onPinUnlock = useCallback(() => {
    setShowPin(false);
    if (pinReason === "send" && pendingSubmit) {
      const payload = pendingSubmit;
      setPendingSubmit(null);
      void send(payload);
      return;
    }
    setPhase("applied");
    setTimeout(() => { setPhase("idle"); setDiff(null); }, 3000);
  }, [pinReason, pendingSubmit, send]);

  const requestApply = useCallback(() => {
    if (isParentSessionUnlocked()) {
      setPhase("applied");
      setTimeout(() => { setPhase("idle"); setDiff(null); }, 3000);
      return;
    }
    setPinReason("apply");
    setShowPin(true);
  }, []);

  if (!open) return null;

  const hd = (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--line)]/50">
      <div className="flex items-center gap-2">
        <span className="text-base">🤖</span>
        <span className="text-sm font-semibold text-[var(--ink)]">Code Agent</span>
        {msgs.length > 0 && (
          <button type="button" onClick={clearSession}
            className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)] hover:bg-[var(--mist)]"
            title="New session">+ New</button>
        )}
      </div>
      <div className="flex items-center gap-1">
        {accAvailable && (
          <a href={ACC_URL} target="_blank" rel="noopener noreferrer"
            className="rounded-full px-3 py-1 text-[11px] font-medium text-[var(--teal)] hover:bg-[var(--teal)]/10"
            title="Open full Agent Chat Console">↗ ACC</a>
        )}
        <button type="button" onClick={onMinimize}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--mist)]"
          aria-label="Minimize" title="Minimize">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button type="button" onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--mist)]"
          aria-label="Close" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </div>
  );

  const empty = phase === "idle" && msgs.length === 0 && (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-6 text-center">
      <span className="text-3xl">🛠</span>
      <p className="text-sm font-semibold text-[var(--ink)]">Tell Spark how to improve</p>
      <p className="text-xs text-[var(--ink-muted)] leading-relaxed max-w-[260px]">
        Describe what you want changed — fonts, colors, layout, features. Publish / deploy needs a parent PIN.
      </p>
      <div className="flex flex-col gap-1.5 mt-1">
        <p className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wide">Try:</p>
        {HINT_EXAMPLES.map(ex => (
          <button key={ex} type="button" onClick={() => requestSend({ text: ex, attachments: [] })}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)] transition text-left">• {ex}</button>
        ))}
      </div>
    </div>
  );

  const panelContent = (
    <>
      {hd}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty}
        <CodeAgentThread
          messages={msgs}
          streamingContent={streamingContent}
          statusText={statusText}
          runningTools={runningTools}
          isStreaming={phase === "thinking"}
        />
      </div>
      {err ? (
        <div className="mx-3 mb-1 rounded-lg border border-[var(--coral)]/30 bg-[var(--coral)]/5 px-3 py-2">
          <p className="text-xs font-medium text-[var(--coral)]">{err}</p>
          <button type="button" onClick={() => { setError(""); setPhase("idle"); }}
            className="mt-1 text-[11px] font-medium text-[var(--teal)] hover:underline">Dismiss</button>
        </div>
      ) : null}
      {phase === "applied" ? (
        <div className="mx-3 mb-2 rounded-lg bg-[var(--teal)]/10 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-[var(--teal)]">✓ Changes applied</p>
        </div>
      ) : null}
      {phase === "diff" && diff ? (
        <div className="mx-3 mb-2">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--bg0)] p-2">
            <p className="mb-1 text-[10px] font-semibold text-[var(--ink-muted)]">
              {diff.filepath} <span className="text-[var(--teal)]">+{diff.added}</span> <span className="text-[var(--coral)]">-{diff.removed}</span>
            </p>
            <pre className="max-h-[120px] overflow-y-auto rounded bg-[var(--mist)]/50 p-2 text-[11px] text-[var(--ink)] leading-snug whitespace-pre-wrap">{diff.hunks.slice(0, 600)}</pre>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={requestApply}
              className="flex-1 rounded-full bg-[var(--teal)] py-1.5 text-xs font-semibold text-white hover:brightness-105">Apply</button>
            <button type="button" onClick={() => { setPhase("idle"); setDiff(null); }}
              className="flex-1 rounded-full border border-[var(--line)] py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--mist)]">Cancel</button>
          </div>
        </div>
      ) : null}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <ConsoleComposer disabled={phase === "thinking"} singleLine placeholder={`Try: ${hint}`} onSubmit={requestSend} />
      </div>
    </>
  );

  return (
    <>
      <div className="hidden lg:block">
        <div className="fixed right-0 top-0 z-30 flex h-dvh w-[min(480px,48vw)] flex-col border-l border-[var(--line)] bg-[var(--bg0)] shadow-2xl animate-slide-in-right">
          {panelContent}
        </div>
      </div>
      <div className="fixed inset-0 z-30 lg:hidden">
        <button type="button" className="absolute inset-0 bg-[rgba(10,28,34,0.45)]" onClick={onClose} aria-label="Close" />
        <div className="absolute inset-x-0 bottom-0 flex max-h-[65vh] flex-col rounded-t-2xl bg-[var(--bg0)] shadow-2xl animate-slide-up">
          <div className="flex justify-center py-2 cursor-grab"
            onPointerDown={(e) => {
              const startY = e.clientY;
              const onMove = (ev: PointerEvent) => { if (ev.clientY - startY > 60) { onClose(); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); } };
              const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
              window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
            }}>
            <div className="h-1 w-10 rounded-full bg-[var(--line)]" />
          </div>
          {panelContent}
        </div>
      </div>
      {showPin ? (
        <PinGate
          onUnlock={onPinUnlock}
          onCancel={() => {
            setShowPin(false);
            setPendingSubmit(null);
          }}
        />
      ) : null}
    </>
  );
}
