"use client";

import { useCallback, useState, type CSSProperties } from "react";
import {
  canConvert,
  energySkillSeed,
  generateEnergyMission,
  validateEnergyChain,
  type EnergyChainMission,
  type EnergyTile,
} from "@/lib/entertain/energy-chain";
import {
  applyMisconceptionToMemory,
  loadLearningMemory,
  pushLearningMemoryToServer,
  saveLearningMemory,
} from "@/lib/learning-memory";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";
import { recordInterest } from "@/lib/interest-store";
import { difficultyFromPKnown } from "@/lib/entertain/energy-chain";
import { GAME_TOKENS } from "./learning-games/tokens";
import { useJuice } from "./learning-games/juice";

// Shared Energy Chain tokens (learning-games-v2.md §5.2) — single amber accent.
const {
  base: BASE,
  surface: SURFACE,
  stroke: STROKE,
  accent: AMBER,
  danger: CORAL,
  ink: INK,
  inkMuted: INK_MUTED,
  inkFaint: INK_FAINT,
} = GAME_TOKENS["energy-chain"];

const TILE_LABEL: Record<EnergyTile, string> = {
  height: "Height",
  spring: "Spring",
  motion: "Motion",
  heat: "Heat",
  sound: "Sound",
  light: "Light",
  battery: "Battery",
  bell: "Bell",
};

export function EnergyChainGame() {
  const juice = useJuice();
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [mission, setMission] = useState<EnergyChainMission | null>(null);
  const [path, setPath] = useState<EnergyTile[]>([]);
  const [prediction, setPrediction] = useState<"works" | "fails" | null>(null);
  const [result, setResult] = useState<ReturnType<typeof validateEnergyChain> | null>(null);
  const [cleared, setCleared] = useState(0);

  const start = useCallback(() => {
    const mem = loadLearningMemory(accountId);
    const skill = mem.skills?.find((s) => s.id === "energy-transfer" || s.id === "forces-motion");
    const m = generateEnergyMission(difficultyFromPKnown(skill?.pKnown ?? 0.45));
    setMission(m);
    setPath([]);
    setPrediction(null);
    setResult(null);
  }, [accountId]);

  const toggleTile = useCallback((t: EnergyTile) => {
    setResult(null);
    setPath((prev) => {
      const last = prev[prev.length - 1];
      if (last === t) return prev.slice(0, -1);
      return [...prev, t];
    });
  }, []);

  const submit = useCallback(() => {
    if (!mission || !prediction) return;
    const res = validateEnergyChain(mission, path, prediction);
    setResult(res);
    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Energy Chain · ${mission.goal}`,
      userText: path.join(" → "),
      skillSeed: energySkillSeed(mission),
      outcome: res.outcome,
    });
    try {
      recordInterest(accountId, { topicId: "physics", label: "Energy", emoji: "⚡" });
    } catch {
      /* ignore */
    }
    if (res.correct) {
      juice.playCorrect();
      setCleared((c) => c + 1);
    } else {
      juice.playError();
      if (res.misconceptionId) {
        const mem = loadLearningMemory(accountId);
        const next = applyMisconceptionToMemory(mem, "energy-transfer", {
          id: res.misconceptionId,
          count: 1,
          lastSeen: Date.now(),
        });
        saveLearningMemory(next, accountId);
        void pushLearningMemoryToServer(next, accountId);
      }
    }
  }, [mission, path, prediction, accountId]);

  // First broken conversion index (for the "leak" visual).
  let breakAt = -1;
  for (let i = 0; i < path.length - 1; i++) {
    if (!canConvert(path[i]!, path[i + 1]!)) {
      breakAt = i;
      break;
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-[#120f08] text-[#f4ead5]">
      <style>{`
        @keyframes ecPulse { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes ecFlow {
          0%{transform:translateX(0);opacity:0}
          20%{opacity:1}
          80%{opacity:1}
          100%{transform:translateX(var(--flow));opacity:0}
        }
        @keyframes ecBurst {
          from{transform:translate(0,0);opacity:.9}
          to{transform:translate(var(--dx),var(--dy));opacity:0}
        }
        @keyframes ecFade { to{opacity:.25} }
      `}</style>

      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#fbbf24]">
            Energy Chain
            {mission && <span className="text-[#8a7a5c]">· L{mission.difficulty}</span>}
          </span>
          <span className="flex items-center gap-1.5" aria-label={`${cleared} machines lit`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: i < cleared ? AMBER : "rgba(255,255,255,0.12)",
                  transition: "background .3s",
                }}
              />
            ))}
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {!mission ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <MachineMark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#cbb892]">
              Snap energy conversions. Predict if the machine works, then run it.
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-7 min-h-12 rounded-xl px-10 text-sm font-semibold text-[#1a1208] transition active:scale-[0.98]"
              style={{ background: AMBER }}
            >
              Build a machine
            </button>
          </div>
        ) : (
          <>
            {/* Mission brief */}
            <div className="rounded-2xl border p-4" style={{ borderColor: STROKE, background: SURFACE }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#fbbf24]">
                Goal · {mission.goal === "bell" ? "Ring the bell" : "Light the lamp"}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{mission.prompt}</p>
            </div>

            {/* Chain board */}
            <div
              className="relative min-h-16 rounded-2xl border p-3"
              style={{ borderColor: STROKE, background: SURFACE }}
            >
              {path.length === 0 ? (
                <p className="py-3 text-center text-sm text-[#8a7a5c]">
                  Tap nodes to snap a chain
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {path.map((t, i) => {
                    const isGoal = t === mission.goal;
                    const isBroken = result && i === breakAt;
                    return (
                      <span key={`${t}-${i}`} className="flex items-center gap-1.5">
                        <span
                          className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5"
                          style={{
                            borderColor: isBroken
                              ? CORAL
                              : isGoal
                                ? AMBER
                                : STROKE,
                            background: isBroken
                              ? "rgba(251,113,133,0.12)"
                              : "rgba(255,255,255,0.04)",
                            animation: isBroken ? "ecFade .5s ease forwards" : undefined,
                          }}
                        >
                          <TileGlyph tile={t} tone={isBroken ? CORAL : isGoal ? AMBER : "#cbb892"} />
                          <span className="text-xs font-semibold">{TILE_LABEL[t]}</span>
                        </span>
                        {i < path.length - 1 && (
                          <span className="text-[#8a7a5c]" aria-hidden>→</span>
                        )}
                      </span>
                    );
                  })}
                  {result?.correct && (
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 h-1 rounded-full"
                      style={{
                        width: "100%",
                        background: AMBER,
                        animation: "ecFlow 1s ease",
                        "--flow": "90%",
                        opacity: 0,
                      } as CSSProperties}
                      aria-hidden
                    />
                  )}
                </div>
              )}
            </div>

            {/* Tile pool */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {mission.pool.map((t) => {
                const used = path.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTile(t)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition active:scale-[0.97]"
                    style={{
                      borderColor: used ? AMBER : STROKE,
                      background: used ? "rgba(251,191,36,0.14)" : "rgba(255,255,255,0.04)",
                      color: used ? AMBER : INK_MUTED,
                    }}
                  >
                    <TileGlyph tile={t} tone={used ? AMBER : "#cbb892"} />
                    {TILE_LABEL[t]}
                  </button>
                );
              })}
            </div>

            {/* Prediction */}
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8a7a5c]">
                Predict
              </p>
              <div className="flex gap-2">
                {(["works", "fails"] as const).map((p) => {
                  const active = prediction === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPrediction(p);
                        setResult(null);
                      }}
                      className="min-h-11 flex-1 rounded-xl border text-sm font-semibold capitalize transition active:scale-[0.97]"
                      style={{
                        borderColor: active ? AMBER : STROKE,
                        background: active ? "rgba(251,191,36,0.16)" : "rgba(255,255,255,0.04)",
                        color: active ? AMBER : INK_MUTED,
                      }}
                    >
                      {p === "works" ? "It works" : "It leaks"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Result */}
            {result && (
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: result.correct ? "rgba(251,191,36,0.45)" : "rgba(251,113,133,0.45)",
                  background: result.correct ? "rgba(251,191,36,0.08)" : "rgba(251,113,133,0.08)",
                }}
              >
                <p className="text-sm" style={{ color: result.correct ? AMBER : CORAL }}>
                  {result.message}
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="mt-auto">
              {result?.correct ? (
                <button
                  type="button"
                  onClick={start}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold text-[#1a1208] transition active:scale-[0.98]"
                  style={{ background: AMBER }}
                >
                  Next machine
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!prediction || path.length < 2}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold text-[#1a1208] transition active:scale-[0.98] disabled:opacity-35"
                  style={{ background: AMBER }}
                >
                  Run
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- geometric tile glyphs (no emoji) ---- */

function TileGlyph({ tile, tone }: { tile: EnergyTile; tone: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden>
      {tile === "height" && (
        <>
          <path d="M4 15 L8 8 L12 12 L16 5" fill="none" stroke={tone} strokeWidth={1.8} />
          <path d="M13 5 L16 5 L16 8" fill="none" stroke={tone} strokeWidth={1.8} />
        </>
      )}
      {tile === "spring" && (
        <path d="M3 10 L6 6 L9 14 L12 6 L15 14 L17 10" fill="none" stroke={tone} strokeWidth={1.8} />
      )}
      {tile === "motion" && (
        <>
          <line x1={3} y1={10} x2={15} y2={10} stroke={tone} strokeWidth={1.8} />
          <path d="M15 10 L11 6 L11 14 Z" fill={tone} />
        </>
      )}
      {tile === "heat" && (
        <path d="M10 2 C13 6 13 9 10 12 C8 14 8 16 10 18" fill="none" stroke={tone} strokeWidth={1.8} strokeLinecap="round" />
      )}
      {tile === "sound" && (
        <>
          <path d="M4 13 L8 13 L12 17 L12 3 L8 7 L4 7 Z" fill={tone} />
          <path d="M13 7 C15 9 15 11 13 13" fill="none" stroke={tone} strokeWidth={1.6} />
        </>
      )}
      {tile === "light" && (
        <>
          <circle cx={10} cy={10} r={3.5} fill={tone} />
          <line x1={10} y1={2} x2={10} y2={5} stroke={tone} strokeWidth={1.4} />
          <line x1={10} y1={15} x2={10} y2={18} stroke={tone} strokeWidth={1.4} />
          <line x1={2} y1={10} x2={5} y2={10} stroke={tone} strokeWidth={1.4} />
          <line x1={15} y1={10} x2={18} y2={10} stroke={tone} strokeWidth={1.4} />
        </>
      )}
      {tile === "battery" && (
        <>
          <rect x={4} y={6} width={10} height={8} rx={1.5} fill="none" stroke={tone} strokeWidth={1.6} />
          <rect x={15} y={8} width={2} height={4} fill={tone} />
          <rect x={6.5} y={8.5} width={5} height={3} fill={tone} />
        </>
      )}
      {tile === "bell" && (
        <>
          <path d="M6 15 C6 9 14 9 14 15 Z" fill={tone} />
          <rect x={5.5} y={15} width={9} height={2} rx={1} fill={tone} />
          <circle cx={10} cy={18} r={1.4} fill={tone} />
        </>
      )}
    </svg>
  );
}

function MachineMark() {
  return (
    <svg width={120} height={120} viewBox="0 0 96 96" aria-hidden>
      <circle cx={48} cy={48} r={46} fill="rgba(251,191,36,0.08)" />
      <circle cx={48} cy={48} r={46} fill="none" stroke="rgba(251,191,36,0.35)" strokeWidth={2} />
      <rect x={24} y={32} width={22} height={32} rx={4} fill="none" stroke="#fbbf24" strokeWidth={2} />
      <rect x={50} y={24} width={22} height={40} rx={4} fill="none" stroke="#fbbf24" strokeWidth={2} />
      <g style={{ animation: "ecPulse 1.6s ease infinite" }}>
        <line x1={46} y1={44} x2={50} y2={44} stroke="#fbbf24" strokeWidth={2} />
        <circle cx={72} cy={60} r={3} fill="#fbbf24" />
        <circle cx={35} cy={24} r={3} fill="#fbbf24" />
      </g>
    </svg>
  );
}
