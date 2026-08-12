"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TIMELINE_CASES, type TimelineCase } from "@/lib/entertain/timeline-cases";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TimelineDetectiveGame() {
  const [currentCase, setCurrentCase] = useState<TimelineCase | null>(null);
  const [shuffledEvents, setShuffledEvents] = useState<string[]>([]);
  const [userOrder, setUserOrder] = useState<string[]>([]);
  const [citedSentence, setCitedSentence] = useState<number | null>(null);
  const [phase, setPhase] = useState<"briefing" | "sorting" | "result">("briefing");
  const [result, setResult] = useState<{ correct: boolean; score: number } | null>(null);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [accountId, setAccountId] = useState("acct_ryan");

  useEffect(() => {
    try {
      const acct = getActiveAccount(loadAccounts());
      setAccountId(acct.id);
    } catch { /* use default */ }
  }, []);

  const sentences = useMemo(
    () => (currentCase ? currentCase.passage.split(". ").filter(Boolean).map((s) => s.trim() + ".") : []),
    [currentCase],
  );

  const startCase = useCallback(() => {
    const pool = TIMELINE_CASES;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setCurrentCase(picked);
    setShuffledEvents(shuffle(picked.events.map((e) => e.id)));
    setUserOrder([]);
    setCitedSentence(null);
    setPhase("sorting");
    setResult(null);
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    setUserOrder((prev) => {
      if (prev.includes(eventId)) return prev.filter((id) => id !== eventId);
      return [...prev, eventId];
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!currentCase || userOrder.length !== currentCase.events.length) return;

    const correct =
      userOrder.length === currentCase.correctOrder.length &&
      userOrder.every((id, i) => id === currentCase.correctOrder[i]);
    const evidenceCorrect =
      citedSentence !== null &&
      currentCase.evidenceSentenceIndices.includes(citedSentence);

    const bothCorrect = correct && evidenceCorrect;
    const points = bothCorrect ? 20 : correct || evidenceCorrect ? 10 : 0;
    setResult({ correct: bothCorrect, score: points });
    setScore((s) => s + points);
    if (bothCorrect) setSolved((s) => s + 1);
    setPhase("result");

    // BKT
    void recordStudioLearningTurn({
      accountId,
      source: "natgeo",
      title: `Timeline Detective · ${currentCase.title}`,
      userText: `ancient civilization history timeline ${userOrder.join(" ")} reading evidence`,
      outcome: correct ? "correct" : "incorrect",
    });

    if (evidenceCorrect) {
      void recordStudioLearningTurn({
        accountId,
        source: "natgeo",
        title: `Timeline Detective · Evidence · ${currentCase.title}`,
        userText: "reading comprehension evidence passage cite quote paragraph main idea",
        outcome: "correct",
      });
    }
  }, [currentCase, userOrder, citedSentence, accountId]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-[var(--ink-muted)]">
          Score: <span className="tabular-nums font-semibold text-[var(--ink)]">{score}</span>
        </span>
        <span className="text-[var(--ink-muted)]">
          Solved: <span className="tabular-nums font-semibold text-[var(--teal)]">{solved}</span>
        </span>
      </div>

      {phase === "briefing" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="mb-4 text-5xl">🔍</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
            Timeline Detective
          </h2>
          <p className="mt-2 max-w-xs text-sm text-[var(--ink-muted)]">
            Solve history mysteries. Read clues, sort events, and cite evidence!
          </p>
          <button
            type="button"
            onClick={startCase}
            className="mt-6 min-h-12 rounded-xl bg-[var(--teal)] px-6 text-sm font-semibold text-white"
          >
            Start investigating
          </button>
        </div>
      )}

      {currentCase && (phase === "sorting" || phase === "result") && (
        <div className="flex flex-1 flex-col gap-4">
          {/* Case title */}
          <div className="rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Case file
            </p>
            <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
              {currentCase.title}
            </h2>
          </div>

          {/* Reading passage */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Evidence
            </p>
            <div className="mt-2 space-y-2">
              {sentences.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCitedSentence(i)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm leading-relaxed transition ${
                    citedSentence === i
                      ? "border border-[var(--teal)]/50 bg-[var(--teal)]/10 text-[var(--ink)]"
                      : "border border-transparent hover:bg-[var(--mist)] text-[var(--ink-muted)]"
                  }`}
                >
                  <span className="mr-1 text-[10px] text-[var(--ink-muted)]">
                    [{i + 1}]
                  </span>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline sorting */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Sort timeline (earliest first)
            </p>
            <div className="mt-2 space-y-2">
              {shuffledEvents.map((eid) => {
                const ev = currentCase.events.find((e) => e.id === eid);
                const idx = userOrder.indexOf(eid);
                return (
                  <button
                    key={eid}
                    type="button"
                    disabled={phase === "result"}
                    onClick={() => handleEventClick(eid)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                      idx >= 0
                        ? "border border-[var(--teal)]/50 bg-[var(--teal)]/10"
                        : "border border-[var(--line)] hover:bg-[var(--mist)]"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--mist)] text-[11px] font-bold tabular-nums text-[var(--ink)]">
                      {idx >= 0 ? idx + 1 : "·"}
                    </span>
                    <span className="text-[var(--ink)]">{ev?.label ?? eid}</span>
                    {ev?.year != null && (
                      <span className="ml-auto text-[11px] tabular-nums text-[var(--ink-muted)]">
                        {ev.year < 0 ? `${Math.abs(ev.year)} BCE` : `${ev.year} CE`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit / Result */}
          {phase === "sorting" && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={userOrder.length !== currentCase.events.length}
              className="min-h-12 rounded-xl bg-[var(--teal)] text-sm font-semibold text-white disabled:opacity-40"
            >
              Submit timeline
            </button>
          )}

          {phase === "result" && result && (
            <div className={`rounded-xl border-2 p-4 ${
              result.correct
                ? "border-[var(--teal)]/50 bg-[var(--teal)]/5"
                : "border-[var(--coral)]/40 bg-[var(--coral)]/5"
            }`}>
              <p className="text-sm font-semibold text-[var(--ink)]">
                {result.correct ? "Case closed!" : "Not quite right"}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {result.correct
                  ? `+${result.score} points. You sorted the timeline and cited evidence correctly.`
                  : `+${result.score} points. The correct order was: ${currentCase.correctOrder.map((eid, i) => `${i + 1}. ${currentCase.events.find((e) => e.id === eid)?.label ?? eid}`).join(" → ")}`}
              </p>
              <button
                type="button"
                onClick={startCase}
                className="mt-3 min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--ink)]"
              >
                Next case
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
