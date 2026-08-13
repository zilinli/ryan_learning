"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  generateMission,
  validateVoyagerAnswer,
  difficultyFromPKnown,
  voyagerSkillSeed,
  voyagerMissionLabel,
  type VoyagerMission,
  type VoyagerMissionKind,
} from "@/lib/entertain/fraction-voyager";
import {
  loadLearningMemory,
  applyMisconceptionToMemory,
  saveLearningMemory,
  pushLearningMemoryToServer,
} from "@/lib/learning-memory";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

const KIND_ORDER: VoyagerMissionKind[] = ["place", "compare", "partition"];

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** Fraction tick labels for the number line (place missions). */
function tickLabels(ticks: number, lineMax: number): Array<{ i: number; label: string }> {
  const out: Array<{ i: number; label: string }> = [];
  for (let i = 0; i <= ticks; i++) {
    const g = gcd(i, ticks);
    const n = (i / g) * lineMax;
    const d = ticks / g;
    if (d === 1) {
      out.push({ i, label: `${n}` });
    } else {
      out.push({ i, label: `${n}/${d}` });
    }
  }
  return out;
}

export function FractionVoyagerGame() {
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [mission, setMission] = useState<VoyagerMission | null>(null);
  const [phase, setPhase] = useState<"idle" | "flying" | "solved">("idle");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState("");
  const [misconception, setMisconception] = useState<string | null>(null);
  const [placeTick, setPlaceTick] = useState<number | null>(null);
  const [comparePick, setComparePick] = useState<"left" | "right" | null>(null);
  const [filledPieces, setFilledPieces] = useState(0);
  const [stars, setStars] = useState(0);
  const shipRef = useRef<HTMLDivElement>(null);

  const startMission = useCallback(
    (kind?: VoyagerMissionKind) => {
      const mem = loadLearningMemory(accountId);
      const fracSkill =
        mem.skills?.find(
          (s) => s.id === "fractions-concepts" || s.id === "equivalent-fractions",
        ) || mem.skills?.find((s) => s.id === "fraction-word-problems");
      const pKnown = fracSkill?.pKnown ?? 0.5;
      const diff = difficultyFromPKnown(pKnown);
      const k = kind ?? KIND_ORDER[Math.floor(Math.random() * KIND_ORDER.length)];
      const m = generateMission(k, diff);
      setMission(m);
      setPhase("flying");
      setMessage("");
      setMisconception(null);
      setPlaceTick(null);
      setComparePick(null);
      setFilledPieces(0);
    },
    [accountId],
  );

  const submitAnswer = useCallback(async () => {
    if (!mission || phase !== "flying") return;
    let answer: { kind: VoyagerMissionKind; placeTick?: number; comparePick?: "left" | "right"; fillCount?: number };
    if (mission.kind === "place") {
      if (placeTick === null) return;
      answer = { kind: "place", placeTick };
    } else if (mission.kind === "compare") {
      if (!comparePick) return;
      answer = { kind: "compare", comparePick };
    } else {
      answer = { kind: "partition", fillCount: filledPieces };
    }

    const result = validateVoyagerAnswer(mission, answer);
    setMessage(result.message);
    setMisconception(result.misconceptionId ?? null);

    void recordStudioLearningTurn({
      accountId,
      source: "writing",
      title: `Fraction Voyager · ${voyagerMissionLabel(mission.kind)} ${mission.target[0]}/${mission.target[1]}`,
      userText: voyagerSkillSeed(mission),
      outcome: result.correct ? "correct" : "incorrect",
    });

    if (result.correct) {
      setPhase("solved");
      setScore((s) => s + 10 + streak * 2);
      setStreak((s) => s + 1);
      setStars((s) => s + 1);
    } else {
      setStreak(0);
      if (result.misconceptionId) {
        const mem = loadLearningMemory(accountId);
        const next = applyMisconceptionToMemory(mem, mission.skill, {
          id: result.misconceptionId,
          count: 1,
          lastSeen: Date.now(),
        });
        saveLearningMemory(next, accountId);
        void pushLearningMemoryToServer(next, accountId);
      }
    }
  }, [mission, phase, placeTick, comparePick, filledPieces, streak, accountId]);

  // Ship flies to the placed tick when a place mission has a selection.
  const shipLeftPct = useMemo(() => {
    if (!mission || mission.kind !== "place" || placeTick === null) return null;
    return (placeTick / mission.ticks) * 100;
  }, [mission, placeTick]);

  const labels = useMemo(
    () => (mission ? tickLabels(mission.ticks, mission.lineMax) : []),
    [mission],
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0a1220] text-[#e8f0ff]">
      {/* Starfield backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 80% -10%, #16305c 0%, transparent 55%), radial-gradient(70% 50% at 10% 110%, #12214a 0%, transparent 50%), linear-gradient(175deg, #0a1220 0%, #0c1830 45%, #070d18 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, #7fb0ff, transparent), radial-gradient(1px 1px at 80% 20%, #9fc8ff, transparent), radial-gradient(1.5px 1.5px at 60% 70%, #6aa0ff, transparent), radial-gradient(1px 1px at 30% 80%, #cfe0ff, transparent), radial-gradient(1px 1px at 90% 55%, #7fb0ff, transparent)",
        }}
        aria-hidden
      />

      {/* Top bar */}
      <header className="relative z-10 shrink-0 px-4 pb-2 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between text-sm">
          <span className="text-[#8fb0d8]">
            Score{" "}
            <span className="tabular-nums font-semibold text-[#e8f0ff]">{score}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#ffd66b]">
            <span aria-hidden>★</span>
            <span className="tabular-nums font-semibold">{stars}</span>
          </span>
          {streak > 1 && (
            <span className="rounded-full bg-[#ff9d4d]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#ffb877]">
              {streak}x streak
            </span>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-6">
        {!mission || phase === "idle" ? (
          /* ── Mission select / start ── */
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="mb-3 text-6xl" aria-hidden>🚀</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              Fraction Voyager
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#9fb8da]">
              Pilot your ship along the fuel gauge. Land on fractions,
              compare fuel tanks, and slice bars into equal parts.
            </p>
            <button
              type="button"
              onClick={() => startMission()}
              className="mt-6 min-h-12 rounded-xl bg-[#3f7fd1] px-8 text-sm font-semibold text-white shadow-lg shadow-[#3f7fd1]/30 transition hover:bg-[#4f8fe1]"
            >
              Launch a mission
            </button>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => startMission(k)}
                  className="min-h-10 rounded-full border border-[#3f7fd1]/50 px-4 text-xs text-[#9fc8ff] transition hover:bg-[#3f7fd1]/15"
                >
                  {voyagerMissionLabel(k)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            {/* Mission card */}
            <div className="rounded-2xl border border-[#3f7fd1]/30 bg-[#0d1830]/80 p-4 shadow-xl shadow-black/30 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6aa0ff]">
                  {voyagerMissionLabel(mission.kind)} · level {mission.difficulty}
                </p>
                {phase === "solved" && (
                  <span className="rounded-full bg-[#3fbf7f]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#7fe0b0]">
                    ✓ Solved
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg font-semibold leading-snug text-[#e8f0ff]">
                {mission.prompt}
              </p>
              {phase === "solved" && (
                <button
                  type="button"
                  onClick={() => startMission()}
                  className="mt-3 min-h-11 rounded-xl bg-[#3f7fd1] px-5 text-sm font-semibold text-white transition hover:bg-[#4f8fe1]"
                >
                  Next mission →
                </button>
              )}
            </div>

            {/* ── Place: number line ── */}
            {mission.kind === "place" && (
              <div className="rounded-2xl border border-[#3f7fd1]/20 bg-[#0d1830]/80 p-4 backdrop-blur">
                <div className="relative mt-2">
                  {/* Track */}
                  <div className="h-2 rounded-full bg-[#1a2c50]" />
                  <div
                    className="absolute top-0 h-2 rounded-full bg-gradient-to-r from-[#3f7fd1] to-[#9fc8ff] transition-all duration-700"
                    style={{
                      width: shipLeftPct !== null ? `${shipLeftPct}%` : "0%",
                      opacity: shipLeftPct !== null ? 1 : 0.35,
                    }}
                  />
                  {/* Ticks + tappable segments */}
                  <div className="absolute inset-x-0 top-0 flex">
                    {Array.from({ length: mission.ticks + 1 }).map((_, i) => {
                      const selected = placeTick === i;
                      const label = labels.find((l) => l.i === i);
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={phase === "solved"}
                          onClick={() => setPlaceTick(i)}
                          aria-label={`place at ${label?.label ?? i}`}
                          className="group relative flex-1 pt-6 focus-visible:outline-none"
                          style={{ height: 0 }}
                        >
                          <span
                            className={`absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 ${
                              selected ? "bg-[#9fc8ff]" : "bg-[#3a5b8f]"
                            }`}
                          />
                          <span
                            className={`absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border transition ${
                              selected
                                ? "border-[#9fc8ff] bg-[#9fc8ff] shadow-[0_0_10px_#9fc8ff]"
                                : "border-[#3a5b8f] bg-[#0a1220] group-hover:border-[#6aa0ff]"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  {/* Ship */}
                  {shipLeftPct !== null && (
                    <div
                      ref={shipRef}
                      className="pointer-events-none absolute -top-8 z-10 text-2xl transition-all duration-500"
                      style={{ left: `calc(${shipLeftPct}% - 12px)` }}
                      aria-hidden
                    >
                      🚀
                    </div>
                  )}
                  {/* Tick labels */}
                  <div className="mt-6 flex">
                    {labels.map((l) => (
                      <span
                        key={l.i}
                        className="flex-1 text-center text-[10px] tabular-nums text-[#7fa0c8]"
                        aria-hidden
                      >
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>
                {phase === "flying" && (
                  <button
                    type="button"
                    disabled={placeTick === null}
                    onClick={() => void submitAnswer()}
                    className="mt-4 min-h-12 w-full rounded-xl bg-[#3f7fd1] text-sm font-semibold text-white transition hover:bg-[#4f8fe1] disabled:opacity-40"
                  >
                    Land here
                  </button>
                )}
              </div>
            )}

            {/* ── Compare: two fuel tanks ── */}
            {mission.kind === "compare" && mission.compareLeft && mission.compareRight && (
              <div className="space-y-3">
                {(["left", "right"] as const).map((side) => {
                  const [n, d] = side === "left" ? mission.compareLeft! : mission.compareRight!;
                  const ratio = Math.min(1, n / d);
                  const selected = comparePick === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      disabled={phase === "solved"}
                      onClick={() => setComparePick(side)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left backdrop-blur transition ${
                        selected
                          ? "border-[#9fc8ff] bg-[#1a2c50]/80"
                          : "border-[#3f7fd1]/25 bg-[#0d1830]/80 hover:border-[#6aa0ff]/50"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden>⛽</span>
                      <div className="flex-1">
                        <div className="flex h-9 overflow-hidden rounded-lg border border-[#3a5b8f] bg-[#0a1220]">
                          <div
                            className="h-full bg-gradient-to-b from-[#7fe0b0] to-[#3fbf7f] transition-all duration-500"
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-sm font-semibold tabular-nums text-[#e8f0ff]">
                          {n}/{d}
                        </p>
                      </div>
                      {selected && <span className="text-[#9fc8ff]">✓</span>}
                    </button>
                  );
                })}
                {phase === "flying" && (
                  <button
                    type="button"
                    disabled={!comparePick}
                    onClick={() => void submitAnswer()}
                    className="min-h-12 w-full rounded-xl bg-[#3f7fd1] text-sm font-semibold text-white transition hover:bg-[#4f8fe1] disabled:opacity-40"
                  >
                    Confirm tank
                  </button>
                )}
              </div>
            )}

            {/* ── Partition: slice a bar ── */}
            {mission.kind === "partition" && mission.pieceCount && (
              <div className="rounded-2xl border border-[#3f7fd1]/20 bg-[#0d1830]/80 p-4 backdrop-blur">
                <p className="mb-3 text-xs text-[#9fb8da]">
                  Slice into <span className="font-semibold text-[#e8f0ff]">{mission.pieceCount}</span> equal
                  pieces, then fill{" "}
                  <span className="font-semibold text-[#e8f0ff]">{mission.target[0]}/{mission.target[1]}</span>.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: mission.pieceCount }).map((_, i) => {
                    const filled = i < filledPieces;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={phase === "solved"}
                        onClick={() =>
                          setFilledPieces((prev) => (i < prev ? i : i + 1))
                        }
                        aria-label={`piece ${i + 1} of ${mission.pieceCount}`}
                        className={`h-9 w-8 rounded-md border transition ${
                          filled
                            ? "border-[#9fc8ff] bg-[#3f7fd1]/80 shadow-[0_0_8px_#3f7fd1]/40"
                            : "border-[#3a5b8f] bg-[#0a1220] hover:border-[#6aa0ff]/60"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-sm tabular-nums text-[#9fb8da]">
                    Filled:{" "}
                    <span className="font-semibold text-[#e8f0ff]">
                      {filledPieces}/{mission.pieceCount}
                    </span>
                  </p>
                  {phase === "flying" && (
                    <button
                      type="button"
                      disabled={filledPieces === 0}
                      onClick={() => void submitAnswer()}
                      className="ml-auto min-h-11 rounded-xl bg-[#3f7fd1] px-5 text-sm font-semibold text-white transition hover:bg-[#4f8fe1] disabled:opacity-40"
                    >
                      Forge slice
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Feedback */}
            {message && phase !== "solved" && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm backdrop-blur ${
                  misconception
                    ? "border-[#ff9d4d]/40 bg-[#ff9d4d]/10 text-[#ffd2a1]"
                    : "border-[#3fbf7f]/30 bg-[#3fbf7f]/10 text-[#a9e8c8]"
                }`}
              >
                {misconception ? (
                  <span className="flex items-start gap-2">
                    <span aria-hidden>💡</span>
                    <span>{message}</span>
                  </span>
                ) : (
                  message
                )}
              </div>
            )}
            {message && phase === "solved" && (
              <p className="text-center text-sm font-medium text-[#7fe0b0]">{message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
