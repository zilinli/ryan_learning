"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  difficultyFromPKnown,
  pickRound,
  spellingHint,
  validateSpelling,
  wordEchoSkillSeed,
  type WordEchoRound,
  type WordEchoSpellResult,
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

type Phase = "idle" | "study" | "spell" | "done";

export function WordEchoGame() {
  const juice = useJuice();
  const inputRef = useRef<HTMLInputElement>(null);
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [round, setRound] = useState<WordEchoRound | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [spellIndex, setSpellIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<WordEchoSpellResult | null>(null);
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
    setSpellIndex(0);
    setTyped("");
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
        setPhase("spell");
      }
    }, 50);
    return () => window.clearInterval(tick);
  }, [phase, round]);

  useEffect(() => {
    if (phase !== "spell") return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [phase, spellIndex]);

  const check = useCallback(() => {
    if (!round || phase !== "spell") return;
    const expected = round.targets[spellIndex]!;
    const res = validateSpelling(expected, typed);
    setResult(res);
    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Word Echo · L${round.difficulty}`,
      userText: `spell ${expected} → ${typed}`,
      skillSeed: wordEchoSkillSeed(round),
      outcome: res.outcome,
    });
    if (res.correct) {
      juice.playCorrect();
      const nextIdx = spellIndex + 1;
      if (nextIdx >= round.targets.length) {
        setCleared((c) => Math.min(5, c + 1));
        setPhase("done");
      } else {
        setSpellIndex(nextIdx);
        setTyped("");
        setResult(null);
      }
    } else {
      juice.playError();
    }
  }, [round, phase, spellIndex, typed, accountId, juice]);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      check();
    },
    [check],
  );

  const currentWord = round?.targets[spellIndex] ?? "";
  const hint =
    round && currentWord ? spellingHint(currentWord, round.hintMode) : "";

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
              Study a short list of words. Then spell each one from memory — typing beats tapping.
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
                Remember how each word is spelled. You will type them next.
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
                  {i + 1}. {w}
                </span>
              ))}
            </div>
            <StudyBar fraction={studyLeft / round.studyMs} />
          </>
        )}

        {(phase === "spell" || phase === "done") && round && (
          <>
            <Panel>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
                {phase === "done" ? "Clear" : "Spell"}
              </p>
              <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
                {phase === "done"
                  ? `All ${round.targets.length} spellings echoed.`
                  : `Word ${spellIndex + 1} of ${round.targets.length} — type the spelling.`}
              </p>
              {phase === "spell" && hint ? (
                <p
                  className="mt-3 font-mono text-lg tracking-[0.2em] tabular-nums"
                  style={{ color: ACCENT }}
                  aria-label={`Hint: ${hint}`}
                >
                  {hint}
                </p>
              ) : null}
            </Panel>

            {phase === "spell" && (
              <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setResult(null);
                  }}
                  placeholder="Type the word"
                  className="min-h-14 w-full rounded-xl border px-4 text-center text-lg font-semibold outline-none"
                  style={{
                    borderColor: result && !result.correct ? CORAL : STROKE,
                    background: "rgba(255,255,255,0.04)",
                    color: INK,
                  }}
                  aria-label={`Spell word ${spellIndex + 1}`}
                />
                <button
                  type="submit"
                  disabled={typed.trim().length === 0}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
                  style={{ background: ACCENT, color: BASE }}
                >
                  Check spelling
                </button>
              </form>
            )}

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

            {phase === "done" && (
              <div className="mt-auto">
                <button
                  type="button"
                  onClick={start}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold transition active:scale-[0.98]"
                  style={{ background: ACCENT, color: BASE }}
                >
                  Next echo
                </button>
              </div>
            )}
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
