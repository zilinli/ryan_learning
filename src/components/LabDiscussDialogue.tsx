"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectTedCoherenceSignal } from "@/lib/entertain/ted-challenge-handoff";
import {
  contextFromLabKickoff,
  labDiscussNextNoun,
  type LabDiscussContext,
  type LabDiscussId,
} from "@/lib/entertain/lab-discuss";

type ChatTurn = {
  id: string;
  role: "coach" | "you" | "system";
  text: string;
};

type Kickoff = {
  talkTitle: string;
  speaker: string;
  kind: string;
  prompt: string;
  choices: string[];
  selected: number[];
  essay: string;
};

type Props = {
  lab: LabDiscussId;
  kickoff: Kickoff;
  sessionKey: number;
  hasNext: boolean;
  onNextQuestion: () => void;
  onClose: () => void;
};

export function LabDiscussDialogue({
  lab,
  kickoff,
  sessionKey,
  hasNext,
  onNextQuestion,
  onClose,
}: Props) {
  const ctx: LabDiscussContext = contextFromLabKickoff(kickoff);
  const nextNoun = labDiscussNextNoun(lab);
  const [reply, setReply] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coherent, setCoherent] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const seededKeyRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (seededKeyRef.current === sessionKey) return;
    seededKeyRef.current = sessionKey;
    setReply("");
    setError(null);
    setCoherent(false);
    setTurns([]);
    setBusy(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/lab/discuss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lab, action: "open", context: ctx }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.reply) {
          throw new Error(data.error || "Discuss failed");
        }
        setTurns([
          {
            id: `open_${sessionKey}`,
            role: "coach",
            text: data.reply,
          },
        ]);
        if (detectTedCoherenceSignal(data.reply)) setCoherent(true);
        window.setTimeout(() => inputRef.current?.focus(), 80);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Discuss failed");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Seed once per sessionKey from frozen kickoff context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, lab]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  const sendReply = useCallback(async () => {
    const text = reply.trim();
    if (text.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    const youTurn: ChatTurn = {
      id: `you_${Date.now()}`,
      role: "you",
      text,
    };
    const historyForApi = [...turns, youTurn]
      .filter((t) => t.role === "coach" || t.role === "you")
      .map((t) => ({ role: t.role as "coach" | "you", text: t.text }));
    setTurns((prev) => [...prev, youTurn]);
    setReply("");
    try {
      const res = await fetch("/api/lab/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lab,
          action: "reply",
          context: ctx,
          studentReply: text,
          history: historyForApi,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
      };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || "Discuss failed");
      }
      setTurns((prev) => [
        ...prev,
        {
          id: `coach_${Date.now()}`,
          role: "coach",
          text: data.reply!,
        },
      ]);
      if (detectTedCoherenceSignal(data.reply)) setCoherent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discuss failed");
    } finally {
      setBusy(false);
    }
  }, [reply, busy, turns, ctx, lab]);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--teal)]/35 bg-white/90 shadow-sm dark:bg-black/40">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--teal)]/10 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Discuss with AI teacher
          </p>
          <p className="truncate text-xs text-[var(--ink-muted)]">
            Prompt stays above — keep improving your reasoning
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 shrink-0 rounded-lg px-2 text-xs text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
        >
          Close
        </button>
      </div>

      <div
        ref={scrollerRef}
        className="max-h-[min(40vh,280px)] space-y-2 overflow-y-auto px-3 py-2.5"
      >
        {turns.map((t) => (
          <div
            key={t.id}
            className={`flex ${t.role === "you" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[94%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                t.role === "coach"
                  ? "rounded-tl-sm bg-[var(--mist)] text-[var(--ink)] dark:bg-white/8"
                  : t.role === "you"
                    ? "rounded-tr-sm bg-[var(--teal)] text-white"
                    : "bg-transparent text-[11px] text-[var(--ink-muted)]"
              }`}
            >
              {t.role === "coach" && (
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                  Spark
                </p>
              )}
              {t.text}
            </div>
          </div>
        ))}
        {busy && (
          <p className="text-[11px] text-[var(--ink-muted)]">Spark is thinking…</p>
        )}
        {error && <p className="text-[12px] text-[var(--coral)]">{error}</p>}
      </div>

      <div className="border-t border-[var(--line)] bg-white/50 p-2.5 dark:bg-black/20">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            disabled={busy}
            placeholder="Answer the teacher here…"
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] disabled:opacity-50 dark:bg-white/10"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendReply();
              }
            }}
          />
          <button
            type="button"
            disabled={busy || reply.trim().length < 1}
            onClick={() => void sendReply()}
            className="min-h-11 shrink-0 rounded-xl bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-[var(--ink-muted)]">
            Enter send · Shift+Enter new line · improve, don’t just submit
          </p>
          {hasNext ? (
            <button
              type="button"
              disabled={busy}
              onClick={onNextQuestion}
              className={`min-h-9 rounded-lg px-3 text-[12px] font-semibold ${
                coherent
                  ? "bg-[var(--teal)] text-white"
                  : "border border-[var(--teal)]/50 text-[var(--teal)]"
              }`}
            >
              {coherent
                ? `Ready — next ${nextNoun}`
                : `Next ${nextNoun}`}
            </button>
          ) : (
            <p className="text-[11px] text-[var(--ink-muted)]">
              Last question in this set
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
