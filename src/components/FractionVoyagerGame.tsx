"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
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
import { GAME_TOKENS } from "./learning-games/tokens";
import { useJuice } from "./learning-games/juice";

// Shared Fraction Voyager tokens (learning-games-v2.md §5.2) — single blue accent.
const {
  base: BASE,
  surface: SURFACE,
  stroke: STROKE,
  accent: BLUE,
  ink: INK,
  inkMuted: INK_MUTED,
  inkFaint: INK_FAINT,
} = GAME_TOKENS["fraction-voyager"];

const KIND_ORDER: VoyagerMissionKind[] = ["place", "compare", "partition"];

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

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
  const juice = useJuice();
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [mission, setMission] = useState<VoyagerMission | null>(null);
  const [phase, setPhase] = useState<"idle" | "flying" | "solved">("idle");
  const [message, setMessage] = useState("");
  const [misconception, setMisconception] = useState<string | null>(null);
  const [placeTick, setPlaceTick] = useState<number | null>(null);
  const [comparePick, setComparePick] = useState<"left" | "right" | null>(null);
  const [filledPieces, setFilledPieces] = useState(0);
  const [sectors, setSectors] = useState(0);
  const [burst, setBurst] = useState(0);

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
    let answer: {
      kind: VoyagerMissionKind;
      placeTick?: number;
      comparePick?: "left" | "right";
      fillCount?: number;
    };
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
      source: "game",
      title: `Fraction Voyager · ${voyagerMissionLabel(mission.kind)} ${mission.target[0]}/${mission.target[1]}`,
      userText: voyagerSkillSeed(mission),
      outcome: result.correct ? "correct" : "incorrect",
    });

    if (result.correct) {
      juice.playCorrect();
      setPhase("solved");
      setSectors((s) => s + 1);
      setBurst((b) => b + 1);
    } else {
      juice.playError();
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
  }, [mission, phase, placeTick, comparePick, filledPieces, accountId]);

  const shipLeftPct = useMemo(() => {
    if (!mission || mission.kind !== "place" || placeTick === null) return null;
    return (placeTick / mission.ticks) * 100;
  }, [mission, placeTick]);

  const labels = useMemo(
    () => (mission ? tickLabels(mission.ticks, mission.lineMax) : []),
    [mission],
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0a0f1a] text-[#e8f0ff]">
      <style>{`
        @keyframes vgPulse { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes vgGlow {
          0%,100%{filter:drop-shadow(0 0 0 rgba(77,163,255,0))}
          45%{filter:drop-shadow(0 0 14px rgba(77,163,255,.85))}
        }
        @keyframes vgBurst {
          from{transform:translate(0,0);opacity:.9}
          to{transform:translate(var(--dx),var(--dy));opacity:0}
        }
      `}</style>

      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#4da3ff]/30 bg-[#4da3ff]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#4da3ff]">
            {mission ? voyagerMissionLabel(mission.kind) : "Voyager"}
            {mission && <span className="text-[#5f7a8f]">· L{mission.difficulty}</span>}
          </span>
          <span className="flex items-center gap-1.5" aria-label={`${sectors} sectors cleared`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: i < sectors ? BLUE : "rgba(255,255,255,0.12)",
                  transition: "background .3s",
                }}
              />
            ))}
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {!mission || phase === "idle" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShipMark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#9fb8da]">
              Pilot your ship along the fuel gauge. Land on fractions, compare
              tanks, and slice bars into equal parts.
            </p>
            <button
              type="button"
              onClick={() => startMission()}
              className="mt-7 min-h-12 rounded-xl px-10 text-sm font-semibold text-[#05182a] transition active:scale-[0.98]"
              style={{ background: BLUE }}
            >
              Launch
            </button>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => startMission(k)}
                  className="min-h-10 rounded-full border px-4 text-xs text-[#9fc8ff] transition hover:bg-[#4da3ff]/15"
                  style={{ borderColor: "rgba(77,163,255,0.5)" }}
                >
                  {voyagerMissionLabel(k)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            {/* Mission card */}
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: "rgba(77,163,255,0.3)", background: SURFACE }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6aa0ff]">
                  {voyagerMissionLabel(mission.kind)} · level {mission.difficulty}
                </p>
                {phase === "solved" && (
                  <span className="rounded-full border border-[#4da3ff]/40 bg-[#4da3ff]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#9fc8ff]">
                    Docked
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-lg font-semibold leading-snug text-[#e8f0ff]">
                {mission.prompt}
              </p>
              {phase === "solved" && (
                <button
                  type="button"
                  onClick={() => startMission()}
                  className="mt-3 min-h-11 rounded-xl px-5 text-sm font-semibold text-[#05182a] transition active:scale-[0.98]"
                  style={{ background: BLUE }}
                >
                  Next sector
                </button>
              )}
            </div>

            {/* Place: glowing number line */}
            {mission.kind === "place" && (
              <div
                className="relative rounded-2xl border p-4"
                style={{ borderColor: "rgba(77,163,255,0.2)", background: SURFACE }}
              >
                <div className="relative mt-6">
                  <div className="h-1.5 rounded-full bg-[#16233c]" />
                  <div
                    className="absolute top-0 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: shipLeftPct !== null ? `${shipLeftPct}%` : "0%",
                      opacity: shipLeftPct !== null ? 1 : 0.3,
                      background: BLUE,
                    }}
                  />
                  <div className="absolute inset-x-0 top-0 flex">
                    {Array.from({ length: mission.ticks + 1 }).map((_, i) => {
                      const selected = placeTick === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={phase === "solved"}
                          onClick={() => setPlaceTick(i)}
                          aria-label={`place at ${labels.find((l) => l.i === i)?.label ?? i}`}
                          className="group relative flex-1 pt-6 focus-visible:outline-none"
                          style={{ height: 0 }}
                        >
                          <span
                            className={`absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 ${
                              selected ? "bg-[#9fc8ff]" : "bg-[#33476b]"
                            }`}
                          />
                          <span
                            className={`absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border transition ${
                              selected
                                ? "border-[#9fc8ff] bg-[#9fc8ff]"
                                : "border-[#33476b] bg-[#0a0f1a] group-hover:border-[#6aa0ff]"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  {shipLeftPct !== null && (
                    <div
                      className="pointer-events-none absolute -top-8 z-10 transition-all duration-500"
                      style={{ left: `calc(${shipLeftPct}% - 13px)` }}
                    >
                      <ShipGlyph />
                    </div>
                  )}
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
                    className="mt-4 min-h-12 w-full rounded-xl text-sm font-semibold text-[#05182a] transition active:scale-[0.98] disabled:opacity-35"
                    style={{ background: BLUE }}
                  >
                    Land here
                  </button>
                )}
              </div>
            )}

            {/* Compare: two fuel tanks */}
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
                      className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99]"
                      style={{
                        borderColor: selected ? BLUE : "rgba(77,163,255,0.25)",
                        background: selected ? "rgba(77,163,255,0.12)" : SURFACE,
                      }}
                    >
                      <GaugeGlyph ratio={ratio} />
                      <div className="flex-1">
                        <div className="flex h-9 overflow-hidden rounded-lg border border-[#33476b] bg-[#0a0f1a]">
                          <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${ratio * 100}%`, background: BLUE }}
                          />
                        </div>
                        <p className="mt-1.5 text-sm font-semibold tabular-nums text-[#e8f0ff]">
                          {n}/{d}
                        </p>
                      </div>
                      {selected && <DotMark />}
                    </button>
                  );
                })}
                {phase === "flying" && (
                  <button
                    type="button"
                    disabled={!comparePick}
                    onClick={() => void submitAnswer()}
                    className="min-h-12 w-full rounded-xl text-sm font-semibold text-[#05182a] transition active:scale-[0.98] disabled:opacity-35"
                    style={{ background: BLUE }}
                  >
                    Confirm tank
                  </button>
                )}
              </div>
            )}

            {/* Partition: slice a bar */}
            {mission.kind === "partition" && mission.pieceCount && (
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: "rgba(77,163,255,0.2)", background: SURFACE }}
              >
                <p className="mb-3 text-xs text-[#9fb8da]">
                  Slice into{" "}
                  <span className="font-semibold text-[#e8f0ff]">{mission.pieceCount}</span>{" "}
                  equal pieces, then fill{" "}
                  <span className="font-semibold text-[#e8f0ff]">
                    {mission.target[0]}/{mission.target[1]}
                  </span>
                  .
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: mission.pieceCount }).map((_, i) => {
                    const filled = i < filledPieces;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={phase === "solved"}
                        onClick={() => setFilledPieces((prev) => (i < prev ? i : i + 1))}
                        aria-label={`piece ${i + 1} of ${mission.pieceCount}`}
                        className="h-9 w-8 rounded-md border transition"
                        style={{
                          borderColor: filled ? BLUE : "#33476b",
                          background: filled ? "rgba(77,163,255,0.85)" : "#0a0f1a",
                        }}
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
                      className="ml-auto min-h-11 rounded-xl px-5 text-sm font-semibold text-[#05182a] transition active:scale-[0.98] disabled:opacity-35"
                      style={{ background: BLUE }}
                    >
                      Forge slice
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Feedback */}
            {message && phase === "solved" && burst > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={`${burst}-${i}`}
                    className="absolute h-1.5 w-1.5 rounded-full"
                    style={
                      {
                        left: `${50 + (i - 2) * 14}%`,
                        bottom: 0,
                        background: BLUE,
                        animation: "vgBurst .6s ease forwards",
                        "--dx": "0px",
                        "--dy": `${-40 - i * 8}px`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            )}
            {message && phase === "solved" && (
              <p className="text-center text-sm font-medium text-[#7fe0b0]">{message}</p>
            )}
            {message && phase !== "solved" && (
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: misconception ? "rgba(251,113,133,0.4)" : "rgba(77,163,255,0.3)",
                  background: misconception ? "rgba(251,113,133,0.08)" : "rgba(77,163,255,0.08)",
                  color: misconception ? "#ffd2a1" : "#a9e8c8",
                }}
              >
                {message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- geometric SVG glyphs (no emoji) ---- */

function ShipGlyph() {
  return (
    <svg width={26} height={30} viewBox="0 0 26 30" aria-hidden>
      <g style={{ animation: "vgGlow .7s ease" }}>
        <path d="M13 2 L20 22 L13 17 L6 22 Z" fill="#4da3ff" />
        <path d="M13 22 L16 28 L13 25 L10 28 Z" fill="#9fc8ff" opacity={0.6} />
        <rect x={12} y={4} width={2} height={10} rx={1} fill="rgba(255,255,255,0.35)" />
      </g>
    </svg>
  );
}

function ShipMark() {
  return (
    <svg width={120} height={120} viewBox="0 0 96 96" aria-hidden>
      <circle cx={48} cy={48} r={46} fill="rgba(77,163,255,0.08)" />
      <circle cx={48} cy={48} r={46} fill="none" stroke="rgba(77,163,255,0.35)" strokeWidth={2} />
      <g transform="translate(48 46)">
        <path d="M0 -22 L16 0 L0 6 L-16 0 Z" fill="#4da3ff" />
        <rect x={-1.5} y={-20} width={3} height={14} rx={1.5} fill="rgba(255,255,255,0.35)" />
      </g>
      <g style={{ animation: "vgPulse 1.6s ease infinite" }}>
        <line x1={18} y1={66} x2={42} y2={66} stroke="#4da3ff" strokeWidth={3} strokeLinecap="round" />
        <path d="M 42 66 L 36 62 L 36 70 Z" fill="#4da3ff" />
      </g>
    </svg>
  );
}

function GaugeGlyph({ ratio }: { ratio: number }) {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden>
      <rect x={3} y={3} width={22} height={22} rx={6} fill="none" stroke="rgba(77,163,255,0.4)" strokeWidth={2} />
      <rect
        x={6}
        y={6}
        width={16}
        height={16 * ratio}
        rx={3}
        fill="#4da3ff"
        transform={`translate(0 ${16 - 16 * ratio})`}
      />
    </svg>
  );
}

function DotMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <circle cx={8} cy={8} r={6} fill="none" stroke="#4da3ff" strokeWidth={2} />
    </svg>
  );
}
