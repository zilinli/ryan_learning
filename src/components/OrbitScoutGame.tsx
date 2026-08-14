"use client";

import { useCallback, useState } from "react";
import {
  generateOrbitMission,
  orbitMissionLabel,
  orbitSkillSeed,
  validateOrbitAnswer,
  type OrbitMission,
  type OrbitMissionKind,
} from "@/lib/entertain/orbit-scout";
import {
  applyMisconceptionToMemory,
  loadLearningMemory,
  pushLearningMemoryToServer,
  saveLearningMemory,
} from "@/lib/learning-memory";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";
import { recordInterest } from "@/lib/interest-store";
import { difficultyFromPKnown } from "@/lib/entertain/orbit-scout";
import { GAME_TOKENS } from "./learning-games/tokens";
import { useJuice } from "./learning-games/juice";

// Shared Orbit Scout tokens (learning-games-v2.md §5.2) — single violet accent.
const {
  base: BASE,
  surface: SURFACE,
  stroke: STROKE,
  accent: VIOLET,
  danger: CORAL,
  ink: INK,
  inkMuted: INK_MUTED,
  inkFaint: INK_FAINT,
} = GAME_TOKENS["orbit-scout"];

const KINDS: OrbitMissionKind[] = ["drop", "always-down", "arc"];

export function OrbitScoutGame() {
  const juice = useJuice();
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [mission, setMission] = useState<OrbitMission | null>(null);
  const [push, setPush] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [predictedBand, setPredictedBand] = useState<number | null>(null);
  const [dropGuess, setDropGuess] = useState<"light" | "heavy" | "same">("same");
  const [gravityDir, setGravityDir] = useState<"down" | "up" | "side">("down");
  const [result, setResult] = useState<ReturnType<typeof validateOrbitAnswer> | null>(null);
  const [cleared, setCleared] = useState(0);

  const start = useCallback(
    (kind?: OrbitMissionKind) => {
      const mem = loadLearningMemory(accountId);
      const skill = mem.skills?.find(
        (s) => s.id === "forces-motion" || s.id === "earth-moon-sun",
      );
      const diff = difficultyFromPKnown(skill?.pKnown ?? 0.55);
      const k = kind ?? KINDS[Math.floor(Math.random() * KINDS.length)]!;
      setMission(generateOrbitMission(k, diff));
      setPush(2);
      setPredictedBand(null);
      setDropGuess("same");
      setGravityDir("down");
      setResult(null);
    },
    [accountId],
  );

  const submit = useCallback(() => {
    if (!mission) return;
    if (mission.kind === "arc" && predictedBand === null) return;
    const res = validateOrbitAnswer(mission, {
      push,
      predictedBand: predictedBand ?? undefined,
      dropGuess,
      gravityDir,
    });
    setResult(res);
    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Orbit Scout · ${orbitMissionLabel(mission.kind)}`,
      userText: `${mission.kind} push ${push}`,
      skillSeed: orbitSkillSeed(mission),
      outcome: res.outcome,
    });
    try {
      recordInterest(accountId, { topicId: "space", label: "Space & planets", emoji: "🚀" });
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
        const next = applyMisconceptionToMemory(mem, mission.skill, {
          id: res.misconceptionId,
          count: 1,
          lastSeen: Date.now(),
        });
        saveLearningMemory(next, accountId);
        void pushLearningMemoryToServer(next, accountId);
      }
    }
  }, [mission, push, predictedBand, dropGuess, gravityDir, accountId]);

  return (
    <div className="flex flex-1 flex-col bg-[#0b0d14] text-[#e8f0ff]">
      <style>{`
        @keyframes osPulse { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes osGlow {
          0%,100%{filter:drop-shadow(0 0 0 rgba(167,139,250,0))}
          45%{filter:drop-shadow(0 0 16px rgba(167,139,250,.9))}
        }
        @keyframes osRise { from{transform:translateY(0)} to{transform:translateY(var(--rise))} }
      `}</style>

      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#a78bfa]">
            Orbit Scout
            {mission && <span className="text-[#5f6a8a]">· L{mission.difficulty}</span>}
          </span>
          <span className="flex items-center gap-1.5" aria-label={`${cleared} shards collected`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: i < cleared ? VIOLET : "rgba(255,255,255,0.12)",
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
            <PlanetMark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#9fb8da]">
              Gravity always pulls toward the planet. No orbital math — just
              pushes and drops.
            </p>
            <button
              type="button"
              onClick={() => start()}
              className="mt-7 min-h-12 rounded-xl px-10 text-sm font-semibold text-[#0b0d14] transition active:scale-[0.98]"
              style={{ background: VIOLET }}
            >
              Launch scout
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border p-4" style={{ borderColor: STROKE, background: SURFACE }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a78bfa]">
                {orbitMissionLabel(mission.kind)}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{mission.prompt}</p>
            </div>

            {/* Diorama stage */}
            <Stage
              kind={mission.kind}
              bands={mission.bands}
              peakBand={result?.peakBand}
              gravityDir={gravityDir}
              dropGuess={dropGuess}
            />

            {/* Controls per kind */}
            {mission.kind === "drop" && (
              <Segmented
                label="Who hits the ground first?"
                options={[
                  { id: "same", label: "Together" },
                  { id: "light", label: "Light" },
                  { id: "heavy", label: "Heavy" },
                ]}
                value={dropGuess}
                onChange={(v) => {
                  setDropGuess(v as "light" | "heavy" | "same");
                  setResult(null);
                }}
              />
            )}

            {mission.kind === "always-down" && (
              <Segmented
                label="Which way does gravity pull?"
                options={[
                  { id: "down", label: "Toward planet" },
                  { id: "up", label: "Away" },
                  { id: "side", label: "Sideways" },
                ]}
                value={gravityDir}
                onChange={(v) => {
                  setGravityDir(v as "down" | "up" | "side");
                  setResult(null);
                }}
              />
            )}

            {mission.kind === "arc" && (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#5f6a8a]">
                    Predict the peak band
                  </p>
                  <div className="flex gap-2">
                    {Array.from({ length: mission.bands }, (_, i) => {
                      const active = predictedBand === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setPredictedBand(i);
                            setResult(null);
                          }}
                          className="min-h-11 flex-1 rounded-xl border text-xs font-semibold transition active:scale-[0.97]"
                          style={{
                            borderColor: active ? VIOLET : STROKE,
                            background: active ? "rgba(167,139,250,0.16)" : "rgba(255,255,255,0.04)",
                            color: active ? VIOLET : INK_MUTED,
                          }}
                        >
                          H{i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#5f6a8a]">
                    Push
                  </p>
                  <div className="flex gap-1.5">
                    {([1, 2, 3, 4, 5] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPush(s)}
                        className="min-h-11 flex-1 rounded-lg text-sm font-bold transition active:scale-[0.97]"
                        style={{
                          background: push === s ? VIOLET : "rgba(255,255,255,0.06)",
                          color: push === s ? "#0b0d14" : INK_MUTED,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Result */}
            {result && (
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: result.correct ? "rgba(167,139,250,0.45)" : "rgba(251,113,133,0.45)",
                  background: result.correct ? "rgba(167,139,250,0.08)" : "rgba(251,113,133,0.08)",
                }}
              >
                <p className="text-sm" style={{ color: result.correct ? VIOLET : CORAL }}>
                  {result.message}
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="mt-auto">
              {result?.correct ? (
                <button
                  type="button"
                  onClick={() => start()}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold text-[#0b0d14] transition active:scale-[0.98]"
                  style={{ background: VIOLET }}
                >
                  Next scout
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  className="min-h-12 w-full rounded-xl text-sm font-semibold text-[#0b0d14] transition active:scale-[0.98]"
                  style={{ background: VIOLET }}
                >
                  Launch
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- diorama stage (SVG, no emoji) ---- */

function Stage(props: {
  kind: OrbitMissionKind;
  bands: number;
  peakBand?: number;
  gravityDir: "down" | "up" | "side";
  dropGuess: "light" | "heavy" | "same";
}) {
  const { kind, bands, peakBand, gravityDir, dropGuess } = props;
  const W = 400;
  const H = 190;

  if (kind === "arc") {
    const bandH = (H - 40) / bands;
    const craftY = peakBand !== undefined ? H - 40 - (peakBand + 0.5) * bandH : H - 20;
    return (
      <div className="rounded-2xl border" style={{ borderColor: STROKE, background: SURFACE }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Height bands">
          {Array.from({ length: bands }, (_, i) => (
            <g key={i}>
              <rect
                x={30}
                y={H - 40 - (i + 1) * bandH}
                width={W - 60}
                height={bandH - 4}
                rx={4}
                fill={peakBand !== undefined && i === peakBand ? "rgba(167,139,250,0.22)" : "rgba(255,255,255,0.03)"}
                stroke={peakBand !== undefined && i === peakBand ? VIOLET : STROKE}
              />
              <text x={22} y={H - 40 - (i + 0.5) * bandH + 3} fontSize="11" fill={INK_FAINT}>
                H{i + 1}
              </text>
            </g>
          ))}
          {/* planet */}
          <circle cx={W / 2} cy={H - 18} r={26} fill="rgba(167,139,250,0.16)" stroke={VIOLET} strokeWidth={2} />
          {/* craft */}
          <g
            style={{
              transform: `translate(${W / 2 - 8}px, ${craftY - 8}px)`,
              transition: "transform .6s ease",
            }}
          >
            <path d="M8 0 L16 16 L8 11 L0 16 Z" fill="#e8f0ff" />
            <circle cx={8} cy={16} r={2} fill={VIOLET} />
          </g>
        </svg>
      </div>
    );
  }

  if (kind === "drop") {
    return (
      <div className="rounded-2xl border" style={{ borderColor: STROKE, background: SURFACE }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Drop test">
          <rect x={0} y={H - 24} width={W} height={24} fill="rgba(167,139,250,0.14)" />
          <line x1={0} y1={H - 24} x2={W} y2={H - 24} stroke={VIOLET} strokeWidth={2} />
          {/* light craft */}
          <g transform={`translate(110, ${dropGuess === "light" ? H - 46 : 40})`} style={{ transition: "transform .6s" }}>
            <path d="M10 0 L20 14 L10 10 L0 14 Z" fill="#e8f0ff" opacity={0.85} />
          </g>
          <text x={110} y={H - 6} textAnchor="middle" fontSize="11" fill={INK_FAINT}>light</text>
          {/* heavy craft */}
          <g transform={`translate(270, ${dropGuess === "heavy" ? H - 46 : 40})`} style={{ transition: "transform .6s" }}>
            <path d="M12 0 L24 16 L12 12 L0 16 Z" fill="#c4b5fd" />
          </g>
          <text x={270} y={H - 6} textAnchor="middle" fontSize="11" fill={INK_FAINT}>heavy</text>
        </svg>
      </div>
    );
  }

  // always-down: planet + gravity arrow
  const arrow = gravityDir;
  return (
    <div className="rounded-2xl border" style={{ borderColor: STROKE, background: SURFACE }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gravity direction">
        <circle cx={W / 2} cy={H / 2 + 10} r={56} fill="rgba(167,139,250,0.14)" stroke={VIOLET} strokeWidth={2} />
        <circle cx={W / 2} cy={H / 2 + 10} r={10} fill={VIOLET} opacity={0.5} />
        <GravityArrow dir={arrow} cx={W / 2} cy={H / 2 + 10} />
      </svg>
    </div>
  );
}

function GravityArrow({ dir, cx, cy }: { dir: "down" | "up" | "side"; cx: number; cy: number }) {
  if (dir === "down") {
    return (
      <g>
        <line x1={cx} y1={cy + 26} x2={cx} y2={cy + 66} stroke={VIOLET} strokeWidth={4} strokeLinecap="round" />
        <path d={`M ${cx} ${cy + 66} L ${cx - 8} ${cy + 56} L ${cx + 8} ${cy + 56} Z`} fill={VIOLET} />
      </g>
    );
  }
  if (dir === "up") {
    return (
      <g>
        <line x1={cx} y1={cy - 26} x2={cx} y2={cy - 66} stroke={VIOLET} strokeWidth={4} strokeLinecap="round" />
        <path d={`M ${cx} ${cy - 66} L ${cx - 8} ${cy - 56} L ${cx + 8} ${cy - 56} Z`} fill={VIOLET} />
      </g>
    );
  }
  return (
    <g>
      <line x1={cx + 26} y1={cy} x2={cx + 66} y2={cy} stroke={VIOLET} strokeWidth={4} strokeLinecap="round" />
      <path d={`M ${cx + 66} ${cy} L ${cx + 56} ${cy - 8} L ${cx + 56} ${cy + 8} Z`} fill={VIOLET} />
    </g>
  );
}

function PlanetMark() {
  return (
    <svg width={120} height={120} viewBox="0 0 96 96" aria-hidden>
      <circle cx={48} cy={48} r={46} fill="rgba(167,139,250,0.08)" />
      <circle cx={48} cy={48} r={46} fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth={2} />
      <circle cx={48} cy={48} r={24} fill="rgba(167,139,250,0.18)" stroke="#a78bfa" strokeWidth={2} />
      <ellipse cx={48} cy={48} rx={32} ry={8} fill="none" stroke="#a78bfa" strokeWidth={1.5} transform="rotate(-18 48 48)" />
      <g style={{ animation: "osPulse 1.6s ease infinite" }}>
        <path d="M40 16 L48 6 L56 16 Z" fill="#a78bfa" />
      </g>
    </svg>
  );
}

function Segmented(props: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#5f6a8a]">
        {props.label}
      </p>
      <div className="flex gap-2">
        {props.options.map((o) => {
          const active = props.value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => props.onChange(o.id)}
              className="min-h-11 flex-1 rounded-xl border text-sm font-semibold transition active:scale-[0.97]"
              style={{
                borderColor: active ? VIOLET : STROKE,
                background: active ? "rgba(167,139,250,0.16)" : "rgba(255,255,255,0.04)",
                color: active ? VIOLET : INK_MUTED,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
