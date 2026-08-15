"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectTedCoherenceSignal,
  type TedChallengeKickoff,
} from "@/lib/entertain/ted-challenge-handoff";
import {
  contextFromKickoff,
  type TedDiscussContext,
} from "@/lib/entertain/ted-discuss";
import { appendVoiceTranscript } from "@/lib/entertain/ted-challenge";
import { useRyanBritishListen } from "@/hooks/useRyanBritishListen";
import { MicTranscribeButton } from "./MicTranscribeButton";

type ChatTurn = {
  id: string;
  role: "coach" | "you" | "system";
  text: string;
};

type Props = {
  accountId?: string;
  kickoff: Pick<
    TedChallengeKickoff,
    | "talkTitle"
    | "speaker"
    | "kind"
    | "prompt"
    | "choices"
    | "selected"
    | "essay"
  >;
  sessionKey: number;
  hasNext: boolean;
  onNextQuestion: () => void;
  onClose: () => void;
};

export function TedDiscussDialogue({
  accountId = "acct_ryan",
  kickoff,
  sessionKey,
  hasNext,
  onNextQuestion,
  onClose,
}: Props) {
  const ctx: TedDiscussContext = contextFromKickoff(kickoff);
  const [reply, setReply] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coherent, setCoherent] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const seededKeyRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastSpokenCoachRef = useRef<string | null>(null);
  const {
    auto: coachListenAuto,
    listening: coachListening,
    speakingId,
    play: playCoachListen,
    stop: stopCoachListen,
    toggleAuto: toggleCoachListenAuto,
  } = useRyanBritishListen(accountId);

  useEffect(() => {
    if (seededKeyRef.current === sessionKey) return;
    seededKeyRef.current = sessionKey;
    setReply("");
    setError(null);
    setCoherent(false);
    setTurns([]);
    lastSpokenCoachRef.current = null;
    stopCoachListen();
    setBusy(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ted/discuss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "open", context: ctx }),
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
  }, [sessionKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  useEffect(() => {
    const last = [...turns].reverse().find((t) => t.role === "coach");
    if (!last || !coachListenAuto) return;
    if (lastSpokenCoachRef.current === last.id) return;
    lastSpokenCoachRef.current = last.id;
    void playCoachListen(last.text, last.id);
  }, [turns, coachListenAuto, playCoachListen]);

  const sendReply = useCallback(async () => {
    const text = reply.trim();
    if (text.length < 1 || busy) return;
    stopCoachListen();
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
      const res = await fetch("/api/ted/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
  }, [reply, busy, turns, ctx, stopCoachListen]);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#6db8a8]/40 bg-black/45 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#6db8a8]/12 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6db8a8]">
            Discuss with AI teacher
          </p>
          <p className="truncate text-xs text-[#a89f92]">
            Prompt stays above — keep arguing from your essay
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleCoachListenAuto}
            className={`min-h-9 rounded-lg px-2 text-[11px] font-medium ${
              coachListenAuto ? "text-[#6db8a8]" : "text-[#a89f92]"
            }`}
            aria-pressed={coachListenAuto}
            title={
              coachListenAuto
                ? "Auto Listen on — coach replies read in British English"
                : "Auto Listen off"
            }
          >
            {coachListenAuto ? "Auto Listen on" : "Auto Listen off"}
          </button>
          <button
            type="button"
            onClick={() => {
              stopCoachListen();
              onClose();
            }}
            className="min-h-9 shrink-0 rounded-lg px-2 text-xs text-[#a89f92] hover:bg-white/5 hover:text-[#e8e2d8]"
          >
            Close
          </button>
        </div>
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
                  ? "rounded-tl-sm bg-white/8 text-[#e8e2d8]"
                  : t.role === "you"
                    ? "rounded-tr-sm bg-[#4f7356] text-white"
                    : "bg-transparent text-[11px] text-[#a89f92]"
              }`}
            >
              {t.role === "coach" && (
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[#6db8a8]">
                  Spark
                </p>
              )}
              {t.text}
              {t.role === "coach" ? (
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (coachListening && speakingId === t.id) {
                        stopCoachListen();
                        return;
                      }
                      void playCoachListen(t.text, t.id);
                    }}
                    className={`inline-flex min-h-8 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      coachListening && speakingId === t.id
                        ? "bg-[#6db8a8]/25 text-[#6db8a8]"
                        : "text-[#a89f92] hover:text-[#6db8a8]"
                    }`}
                    aria-label={
                      coachListening && speakingId === t.id
                        ? "Stop reading"
                        : "Listen to coach reply"
                    }
                  >
                    {coachListening && speakingId === t.id ? "Stop" : "Listen"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy && (
          <p className="text-[11px] text-[#a89f92]">Spark is thinking…</p>
        )}
        {error && <p className="text-[12px] text-[#e07a5f]">{error}</p>}
      </div>

      <div className="border-t border-white/10 bg-black/30 p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            disabled={busy}
            placeholder="Answer the teacher here…"
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-[#e8e2d8] outline-none focus:border-[#6db8a8] disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendReply();
              }
            }}
          />
          <MicTranscribeButton
            language="auto"
            tone="onDark"
            disabled={busy}
            onRecordingStart={stopCoachListen}
            onTranscript={(t) =>
              setReply((prev) => appendVoiceTranscript(prev, t))
            }
          />
          <button
            type="button"
            disabled={busy || reply.trim().length < 1}
            onClick={() => void sendReply()}
            className="min-h-11 shrink-0 rounded-xl bg-[#4f7356] px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-[#a89f92]">
            Mic or type · Enter send · Shift+Enter new line
          </p>
          {hasNext ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                stopCoachListen();
                onNextQuestion();
              }}
              className={`min-h-9 rounded-lg px-3 text-[12px] font-semibold ${
                coherent
                  ? "bg-[#6db8a8] text-[#1a1814]"
                  : "border border-[#6db8a8]/50 text-[#6db8a8]"
              }`}
            >
              {coherent ? "Ready — next TED question" : "Next TED question"}
            </button>
          ) : (
            <p className="text-[11px] text-[#a89f92]">Last question in this set</p>
          )}
        </div>
      </div>
    </div>
  );
}
