"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  difficultyFromPKnown,
  pickRound,
  validateEcho,
  wordEchoSkillSeed,
  type WordEchoResult,
  type WordEchoRound,
} from "@/lib/entertain/word-echo";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { loadLearningMemory } from "@/lib/learning-memory";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";
import { GAME_TOKENS } from "./learning-games/tokens";
import { useJuice } from "./learning-games/juice";

const {
  base: BASE,
  surface: SURFACE,
  stroke: STROKE,
  accent: ACCENT,
  danger: CORAL,
  ink: INK,
  inkMuted: INK_MUTED,
} = GAME_TOKENS["word-echo"];

type Phase = "idle" | "study" | "recall" | "done";

export function WordEchoGame() {
  const juice = useJuice();
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [round, setRound] = useState<WordEchoRound | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<WordEchoResult | null>(null);
  const [cleared, setCleared] = useState(0);
  const [studyLeft, setStudyLeft] = useState(0);

  const start = useCallback(() => {
    const mem = loadLearningMemory(accountId);
    const skill = mem.skills?.find(
      (s) => s.id === "letter-sounds" || s.id === "reading-evidence",
    );
    const diff = difficultyFromPKnown(skill?.pKnown ?? 0.45);
    const next = pickRound(diff);
    setRound(next);
    setSelected([]);
    setResult(null);
    setPhase("study");
    setStudyLeft(next.studyMs);
  }, [accountId]);

  useEffect(() => {
    if (phase !== "study" || !round) return;
    let left = round.studyMs;
    setStudyLeft(left);
    const tick = window.setInterval(() => {
      if (document.hidden) return;
      left = Math.max(0, left - 50);
      setStudyLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        setPhase("recall");
      }
    }, 50);
    return () => window.clearInterval(tick);
  }, [phase, round]);

  const toggle = useCallback(
    (word: string) => {
      if (phase !== "recall" || !round) return;
      setResult(null);
      setSelected((prev) => {
        if (round.requireOrder) {
          if (prev.includes(word)) return prev.filter((w) => w !== word);
          if (prev.length >= round.targets.length) return prev;
          return [...prev, word];
        }
        return prev.includes(word)
          ? prev.filter((w) => w !== word)
          : [...prev, word];
      });
    },
    [phase, round],
  );

  const check = useCallback(() => {
    if (!round || phase !== "recall") return;
    const res = validateEcho(round, selected);
    setResult(res);
    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Word Echo · L${round.difficulty}`,
      userText: `recall ${selected.join(", ")}`,
      skillSeed: wordEchoSkillSeed(round),
      outcome: res.outcome,
    });
    if (res.correct) {
      juice.playCorrect();
      setCleared((c) => Math.min(5, c + 1));
      setPhase("done");
    } else {
      juice.playError();
    }
  }, [round, phase, selected, accountId, juice]);

  return (
    <div className="flex flex-1 flex-col" style={{ background: BASE, color: INK }}>
      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}18`, color: ACCENT }}
          >
            Word Echo
            {round && <span style={{ color: INK_MUTED }}>· L{round.difficulty}</span>}
          </span>
          <span className="flex items-center gap-1.5" aria-label={`${cleared} echoes collected`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: i < cleared ? ACCENT : "rgba(255,255,255,0.12)",
                  transition: "background .3s",
                }}
              />
            ))}
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {phase === "idle" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <EchoMark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed" style={{ color: INK_MUTED }}>
              Study a short list of random words. Then tap the same words when they hide.
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-7 min-h-12 rounded-xl px-10 text-sm font-semibold transition active:scale-[0.98]"
              style={{ background: ACCENT, color: BASE }}
            >
              Start echo
            </button>
          </div>
        )}

        {phase === "study" && round && (
          <>
            <Panel>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                Study · {Math.ceil(studyLeft / 1000)}s
              </p>
              <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
                Remember these words{round.requireOrder ? " in order" : ""}.
              </p>
            </Panel>
            <div className="flex flex-wrap justify-center gap-2">
              {round.targets.map((w, i) => (
                <span
                  key={w}
                  className="min-h-12 rounded-xl border px-4 py-3 text-base font-semibold tabular-nums"
                  style={{
                    borderColor: `${ACCENT}55`,
                    background: `${ACCENT}14`,
                    color: INK,
                  }}
                >
                  {round.requireOrder ? `${i + 1}. ${w}` : w}
                </span>
              ))}
            </div>
            <StudyBar fraction={studyLeft / round.studyMs} />
          </>
        )}

        {(phase === "recall" || phase === "done") && round && (
          <>
            <Panel>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                {phase === "done" ? "Clear" : "Recall"}
              </p>
              <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
                {round.requireOrder
                  ? `Tap the ${round.targets.length} words in study order.`
                  : `Tap all ${round.targets.length} words you studied.`}
              </p>
              {round.requireOrder && selected.length > 0 && (
                <p className="mt-2 text-xs tabular-nums" style={{ color: ACCENT }}>
                  Order: {selected.map((w, i) => `${i + 1}.${w}`).join(" · ")}
                </p>
              )}
            </Panel>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {round.pool.map((w) => {
                const on = selected.includes(w);
                const extra = result && !result.correct && result.extra.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    disabled={phase === "done"}
                    onClick={() => toggle(w)}
                    className="min-h-12 rounded-xl border text-sm font-semibold transition active:scale-[0.97] disabled:opacity-80"
                    style={{
                      borderColor: extra ? CORAL : on ? ACCENT : STROKE,
                      background: extra
                        ? "rgba(251,113,133,0.12)"
                        : on
                          ? `${ACCENT}22`
                          : "rgba(255,255,255,0.04)",
                      color: extra ? CORAL : on ? ACCENT : INK_MUTED,
                    }}
                  >
                    {w}
                    {round.requireOrder && on ? (
                      <span className="ml-1 tabular-nums opacity-70">
                        {selected.indexOf(w) + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {result && (
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: result.correct ? `${ACCENT}66` : `${CORAL}66`,
                  background: result.correct ? `${ACCENT}14` : "rgba(251,113,133,0.1)",
                }}
              >
                <p className="text-sm" style={{ color: result.correct ? ACCENT : CORAL }}>
                  {result.message}
                </p>
              </div>
            )}

            <div className="mt-auto">
              {phase === "done" ? (
                <button
                  type="button"
                  onClick={start}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold transition active:scale-[0.98]"
                  style={{ background: ACCENT, color: BASE }}
                >
                  Next echo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={check}
                  disabled={selected.length === 0}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
                  style={{ background: ACCENT, color: BASE }}
                >
                  Check
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: STROKE, background: SURFACE }}>
      {children}
    </div>
  );
}

function StudyBar({ fraction }: { fraction: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="h-full rounded-full transition-[width] duration-75"
        style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: ACCENT }}
      />
    </div>
  );
}

function EchoMark() {
  return (
    <svg width={112} height={112} viewBox="0 0 96 96" aria-hidden>
      <circle cx={48} cy={48} r={44} fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.35)" strokeWidth={2} />
      <path
        d="M28 48 C34 34, 42 28, 48 28 C54 28, 62 34, 68 48 C62 62, 54 68, 48 68 C42 68, 34 62, 28 48 Z"
        fill="none"
        stroke="#38bdf8"
        strokeWidth={2}
      />
      <circle cx={48} cy={48} r={6} fill="#38bdf8" />
      <path d="M18 48 H26" stroke="#38bdf8" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      <path d="M70 48 H78" stroke="#38bdf8" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
    </svg>
  );
}
