"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  bayMissionLabel,
  baySkillSeed,
  difficultyFromPKnown,
  generateBayMission,
  kindsForDifficulty,
  validateBayAnswer,
  type BayMission,
  type BayMissionKind,
  type BayResult,
  type ForceArrow,
} from "@/lib/entertain/force-bay";
import {
  applyMisconceptionToMemory,
  loadLearningMemory,
  pushLearningMemoryToServer,
  saveLearningMemory,
} from "@/lib/learning-memory";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";
import { recordInterest } from "@/lib/interest-store";
import { GAME_TOKENS } from "./learning-games/tokens";
import { useJuice } from "./learning-games/juice";

// Shared Force Bay tokens (learning-games-v2.md §5.2) — single teal accent,
// coral for the opposite direction / collision feedback.
const {
  base: BASE,
  surface: SURFACE,
  stroke: STROKE,
  accent: TEAL,
  danger: CORAL,
  ink: INK,
  inkMuted: INK_MUTED,
  inkFaint: INK_FAINT,
} = GAME_TOKENS["force-bay"];

type Phase = "idle" | "play";

// Deterministic particle offsets for the "correct" burst (keyed by `burst`).
const PARTICLES = [
  { dx: -30, dy: -26 },
  { dx: -14, dy: -36 },
  { dx: 8, dy: -34 },
  { dx: 26, dy: -24 },
  { dx: 36, dy: -8 },
  { dx: 22, dy: 12 },
  { dx: 4, dy: 16 },
  { dx: -20, dy: 10 },
];

export function ForceBayGame() {
  const juice = useJuice();
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [mission, setMission] = useState<BayMission | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dir, setDir] = useState<-1 | 1>(1);
  const [strength, setStrength] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [aimed, setAimed] = useState(false);
  const [predictedDock, setPredictedDock] = useState<number | null>(null);
  const [collideGuess, setCollideGuess] = useState<"mover" | "parked" | "both">("parked");
  const [massGuess, setMassGuess] = useState<"light" | "heavy">("light");
  const [result, setResult] = useState<BayResult | null>(null);
  const [simIndex, setSimIndex] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [burst, setBurst] = useState(0);
  const [cleared, setCleared] = useState(0);

  const aimRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);

  const startMission = useCallback(
    (kind?: BayMissionKind) => {
      const mem = loadLearningMemory(accountId);
      const skill = mem.skills?.find((s) => s.id === "forces-motion");
      const pKnown = skill?.pKnown ?? 0.4;
      const diff = difficultyFromPKnown(pKnown);
      const kinds = kindsForDifficulty(diff);
      const k =
        kind && kinds.includes(kind) ? kind : kinds[Math.floor(Math.random() * kinds.length)]!;
      const m = generateBayMission(k, diff);
      setMission(m);
      setPhase("play");
      setDir(1);
      setStrength(2);
      setAimed(false);
      setPredictedDock(null);
      setCollideGuess("parked");
      setMassGuess("light");
      setResult(null);
      setSimIndex(null);
      setShake(false);
    },
    [accountId],
  );

  // Animate the discrete stepper's snapshots after a run.
  useEffect(() => {
    if (simIndex === null || !result) return;
    const last = result.run.snapshots.length - 1;
    if (simIndex >= last) return;
    const t = window.setTimeout(() => setSimIndex(simIndex + 1), 80);
    return () => window.clearTimeout(t);
  }, [simIndex, result]);

  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(false), 420);
    return () => window.clearTimeout(t);
  }, [shake]);

  const submit = useCallback(async () => {
    if (!mission || phase !== "play") return;
    if (predictedDock === null && mission.kind !== "mass" && mission.kind !== "collide") return;

    const arrows: ForceArrow[] = [{ dir, strength }];
    if (mission.kind === "balance") {
      arrows.push({ dir: -1, strength });
    }

    const res = validateBayAnswer(mission, {
      arrows,
      predictedDock: predictedDock ?? mission.startDock,
      collideGuess,
      massGuess,
    });
    setResult(res);
    setSimIndex(0);
    setShake(!res.correct || mission.kind === "collide");

    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Force Bay · ${bayMissionLabel(mission.kind)}`,
      userText: `${mission.kind} predicted ${predictedDock} landed ${res.run.landedDock}`,
      skillSeed: baySkillSeed(mission),
      outcome: res.outcome,
    });
    try {
      recordInterest(accountId, {
        topicId: "physics",
        label: "Forces & motion",
        emoji: "⚡",
      });
    } catch {
      /* ignore */
    }

    if (res.correct) {
      juice.playCorrect();
      setCleared((c) => c + 1);
      setBurst((b) => b + 1);
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
  }, [
    mission,
    phase,
    dir,
    strength,
    predictedDock,
    collideGuess,
    massGuess,
    accountId,
  ]);

  return (
    <div className="flex flex-1 flex-col bg-[#0b1210] text-[#e8f0ff]">
      <style>{`
        @keyframes fbShake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-4px)} 40%{transform:translateX(4px)}
          60%{transform:translateX(-3px)} 80%{transform:translateX(3px)}
        }
        @keyframes fbPulse {
          0%,100%{opacity:.28} 50%{opacity:.75}
        }
        @keyframes fbBurst {
          from{transform:translate(0,0);opacity:.9}
          to{transform:translate(var(--dx),var(--dy));opacity:0}
        }
        @keyframes fbGlow {
          0%,100%{filter:drop-shadow(0 0 0 rgba(45,212,191,0))}
          45%{filter:drop-shadow(0 0 14px rgba(45,212,191,.85))}
        }
        @keyframes fbBounce {
          0%{transform:translateX(0)} 35%{transform:translateX(var(--bx))}
          70%{transform:translateX(calc(var(--bx) * -0.4))} 100%{transform:translateX(0)}
        }
      `}</style>

      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2dd4bf]/30 bg-[#2dd4bf]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#2dd4bf]">
            {mission ? bayMissionLabel(mission.kind) : "Force Bay"}
            {mission && <span className="text-[#5f7a8f]">· L{mission.difficulty}</span>}
          </span>
          <span className="flex items-center gap-1.5" aria-label={`${cleared} docks cleared`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: i < cleared ? TEAL : "rgba(255,255,255,0.12)",
                  transition: "background .3s",
                }}
              />
            ))}
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {!mission || phase === "idle" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShipMark size={120} />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#9fb8da]">
              Push barges with force arrows. Aim the push, predict the dock, launch.
            </p>
            <button
              type="button"
              onClick={() => startMission()}
              className="mt-7 min-h-12 rounded-xl px-10 text-sm font-semibold text-[#052e2b] transition active:scale-[0.98]"
              style={{ background: TEAL }}
            >
              Start
            </button>
          </div>
        ) : (
          <Play
            mission={mission}
            dir={dir}
            strength={strength}
            aimed={aimed}
            predictedDock={predictedDock}
            collideGuess={collideGuess}
            massGuess={massGuess}
            result={result}
            simIndex={simIndex}
            shake={shake}
            burst={burst}
            aimRef={aimRef}
            onAimDown={(e) => {
              dragStart.current = e.clientX;
              aimRef.current?.setPointerCapture?.(e.pointerId);
            }}
            onAimMove={(e) => {
              if (dragStart.current === null) return;
              const dx = e.clientX - dragStart.current;
              const d: -1 | 1 = dx >= 0 ? 1 : -1;
              const mag = Math.min(5, Math.max(1, Math.floor(Math.abs(dx) / 34) + 1)) as
                | 1
                | 2
                | 3
                | 4
                | 5;
              setDir(d);
              setStrength(mag);
              setAimed(true);
            }}
            onAimUp={() => {
              dragStart.current = null;
            }}
            onPredict={setPredictedDock}
            onCollide={setCollideGuess}
            onMass={setMassGuess}
            onSubmit={() => void submit()}
            onNext={() => startMission()}
            onRetry={() => {
              setResult(null);
              setSimIndex(null);
              setShake(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Play(props: {
  mission: BayMission;
  dir: -1 | 1;
  strength: 1 | 2 | 3 | 4 | 5;
  aimed: boolean;
  predictedDock: number | null;
  collideGuess: "mover" | "parked" | "both";
  massGuess: "light" | "heavy";
  result: BayResult | null;
  simIndex: number | null;
  shake: boolean;
  burst: number;
  aimRef: RefObject<HTMLDivElement | null>;
  onAimDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onAimMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onAimUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPredict: (d: number) => void;
  onCollide: (g: "mover" | "parked" | "both") => void;
  onMass: (g: "light" | "heavy") => void;
  onSubmit: () => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  const {
    mission,
    dir,
    strength,
    aimed,
    predictedDock,
    collideGuess,
    massGuess,
    result,
    simIndex,
    shake,
    burst,
    aimRef,
    onAimDown,
    onAimMove,
    onAimUp,
    onPredict,
    onCollide,
    onMass,
    onSubmit,
    onNext,
    onRetry,
  } = props;

  const snapshots = result?.run.snapshots ?? null;
  const last = snapshots ? snapshots.length - 1 : 0;
  const idx = simIndex === null ? -1 : Math.min(simIndex, last);
  const moverX =
    snapshots && idx >= 0
      ? snapshots[idx][0]
      : mission.startDock;
  const parkedX =
    snapshots && idx >= 0 && snapshots[idx].length > 1
      ? snapshots[idx][1]
      : mission.parkedDock;

  const showResult = !!result && (simIndex === null || idx >= last);
  const solved = !!result?.correct;
  const needsPrediction = mission.kind !== "mass" && mission.kind !== "collide";
  const ready = needsPrediction ? predictedDock !== null : true;
  const running = !!result && idx >= 0 && idx < last;

  return (
    <>
      {/* Mission brief */}
      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: STROKE, background: SURFACE }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2dd4bf]">
          {bayMissionLabel(mission.kind)} · level {mission.difficulty}
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: INK }}>
          {mission.prompt}
        </p>
      </div>

      {/* Dock rail */}
      <div
        className="relative rounded-2xl border p-2"
        style={{
          borderColor: STROKE,
          background: SURFACE,
          animation: shake ? "fbShake .42s ease" : undefined,
        }}
      >
        <Rail
          mission={mission}
          moverX={moverX}
          parkedX={parkedX}
          predictedDock={predictedDock}
          solved={solved}
          result={result}
          onPredict={onPredict}
          disabled={running}
        />
        {burst > 0 && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {PARTICLES.map((p, i) => (
              <span
                key={`${burst}-${i}`}
                className="absolute h-1.5 w-1.5 rounded-full"
                style={
                  {
                    left: "50%",
                    top: "38%",
                    background: TEAL,
                    animation: "fbBurst .6s ease forwards",
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
        <p className="pb-1 text-center text-[11px]" style={{ color: INK_FAINT }}>
          Tap a dock to predict where it lands
        </p>
      </div>

      {/* Aim pad — drag to set direction + strength in one gesture */}
      <div
        ref={aimRef}
        onPointerDown={onAimDown}
        onPointerMove={onAimMove}
        onPointerUp={onAimUp}
        onPointerCancel={onAimUp}
        className="select-none rounded-2xl border p-2"
        style={{ borderColor: STROKE, background: SURFACE, touchAction: "none" }}
      >
        <AimPad dir={dir} strength={strength} ghost={!aimed} />
        <p className="pb-1 text-center text-[11px]" style={{ color: INK_FAINT }}>
          {aimed ? "Drag to retune the push" : "Drag from the barge to aim your push"}
        </p>
      </div>

      {/* Collision / mass guess */}
      {mission.kind === "collide" && (
        <Segmented
          label="Who reaches the far dock?"
          options={[
            { id: "mover", label: "Mover" },
            { id: "parked", label: "Parked" },
            { id: "both", label: "Both" },
          ]}
          value={collideGuess}
          onChange={(v) => onCollide(v as "mover" | "parked" | "both")}
        />
      )}
      {mission.kind === "mass" && (
        <Segmented
          label="Same push — which travels farther?"
          options={[
            { id: "light", label: "Light" },
            { id: "heavy", label: "Heavy" },
          ]}
          value={massGuess}
          onChange={(v) => onMass(v as "light" | "heavy")}
        />
      )}

      {/* Result */}
      {showResult && result && (
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{
            borderColor: solved ? "rgba(45,212,191,0.45)" : "rgba(251,113,133,0.45)",
            background: solved ? "rgba(45,212,191,0.08)" : "rgba(251,113,133,0.08)",
          }}
        >
          <p className="text-sm" style={{ color: solved ? TEAL : CORAL }}>
            {result.message}
          </p>
        </div>
      )}

      {/* Single CTA */}
      <div className="mt-auto">
        {solved && showResult ? (
          <button
            type="button"
            onClick={onNext}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-[#052e2b] transition active:scale-[0.98]"
            style={{ background: TEAL }}
          >
            Next dock
          </button>
        ) : result && showResult && !solved ? (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-12 w-full rounded-xl border text-sm font-semibold transition active:scale-[0.98]"
            style={{ borderColor: "rgba(251,113,133,0.5)", color: CORAL }}
          >
            Adjust the push
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!ready || running}
            className="min-h-12 w-full rounded-xl text-sm font-semibold text-[#052e2b] transition active:scale-[0.98] disabled:opacity-35"
            style={{ background: TEAL }}
          >
            {running ? "…" : "Launch"}
          </button>
        )}
      </div>
    </>
  );
}

/* ---- geometric SVG pieces (no emoji) ---- */

function Rail(props: {
  mission: BayMission;
  moverX: number;
  parkedX?: number;
  predictedDock: number | null;
  solved: boolean;
  result: BayResult | null;
  onPredict: (d: number) => void;
  disabled: boolean;
}) {
  const { mission, moverX, parkedX, predictedDock, solved, result, onPredict, disabled } = props;
  const W = 400;
  const H = 120;
  const docks = mission.docks;
  const slotW = W / docks;
  const toPx = (x: number) => ((x + 0.5) / docks) * W;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Dock rail">
      {/* dock slots */}
      {Array.from({ length: docks }, (_, i) => {
        const cx = (i + 0.5) * slotW;
        const hit = result && result.run.landedDock === i;
        const predicted = predictedDock === i;
        return (
          <g key={i}>
            <rect
              x={cx - slotW / 2 + 5}
              y={H - 40}
              width={slotW - 10}
              height={26}
              rx={6}
              fill={hit ? "rgba(45,212,191,0.18)" : "rgba(255,255,255,0.04)"}
              stroke={predicted ? TEAL : hit ? "rgba(45,212,191,0.6)" : STROKE}
              strokeWidth={predicted ? 2 : 1}
            />
            <text
              x={cx}
              y={H - 20}
              textAnchor="middle"
              fontSize="12"
              fill={predicted ? TEAL : INK_FAINT}
            >
              {i + 1}
            </text>
            {/* tap target */}
            <rect
              x={cx - slotW / 2}
              y={H - 46}
              width={slotW}
              height={34}
              fill="transparent"
              style={{ cursor: disabled ? "default" : "pointer" }}
              onClick={disabled ? undefined : () => onPredict(i)}
            />
          </g>
        );
      })}

      {/* parked barge (collide) */}
      {parkedX !== undefined && parkedX !== null && (
        <Barge x={toPx(parkedX)} y={H - 58} tone="#5f7a8f" />
      )}

      {/* mover barge */}
      <g style={{ animation: solved ? "fbGlow .7s ease" : undefined }}>
        <Barge x={toPx(moverX)} y={H - 58} tone={TEAL} />
      </g>

      {/* landing marker glow on correct */}
      {solved && result && (
        <circle
          cx={toPx(result.run.landedDock)}
          cy={H - 32}
          r={12}
          fill="none"
          stroke={TEAL}
          strokeWidth={2}
          style={{ animation: "fbPulse .9s ease" }}
        />
      )}
    </svg>
  );
}

function Barge({ x, y, tone }: { x: number; y: number; tone: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* hull */}
      <path
        d="M -18 6 L 18 6 L 12 16 L -12 16 Z"
        fill={tone}
        opacity={0.9}
      />
      {/* sail */}
      <path d="M 0 -14 L 14 2 L 0 2 Z" fill={tone} opacity={0.55} />
      <rect x={-2} y={-14} width={4} height={30} rx={2} fill="rgba(255,255,255,0.35)" />
    </g>
  );
}

function AimPad({ dir, strength, ghost }: { dir: -1 | 1; strength: number; ghost: boolean }) {
  const W = 400;
  const H = 96;
  const cx = W / 2;
  const cy = 44;
  const len = strength * 27;
  const x2 = cx + dir * len;
  const color = dir === 1 ? TEAL : CORAL;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      {/* magnitude ticks */}
      {Array.from({ length: 5 }, (_, i) => {
        const tx = cx + (i + 1) * 30;
        const lit = i < strength;
        return (
          <rect
            key={i}
            x={tx - 1.5}
            y={H - 18}
            width={3}
            height={lit ? 8 : 5}
            rx={1.5}
            fill={lit ? color : "rgba(255,255,255,0.14)"}
          />
        );
      })}

      {/* arrow (ghost pulses before first aim) */}
      <g style={ghost ? { animation: "fbPulse 1.4s ease infinite" } : undefined}>
        <line
          x1={cx}
          y1={cy}
          x2={x2}
          y2={cy}
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <path
          d={`M ${x2} ${cy} L ${x2 - dir * 13} ${cy - 7} L ${x2 - dir * 13} ${cy + 7} Z`}
          fill={color}
        />
      </g>

      {/* origin craft */}
      <g>
        <path d={`M ${cx - 12} ${cy + 4} L ${cx + 12} ${cy + 4} L ${cx + 7} ${cy + 12} L ${cx - 7} ${cy + 12} Z`} fill={color} />
        <path d={`M ${cx} ${cy - 10} L ${cx + 9} ${cy + 2} L ${cx} ${cy + 2} Z`} fill={color} opacity={0.55} />
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
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: INK_FAINT }}>
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
                borderColor: active ? TEAL : STROKE,
                background: active ? "rgba(45,212,191,0.16)" : "rgba(255,255,255,0.04)",
                color: active ? TEAL : INK_MUTED,
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

function ShipMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden>
      <circle cx={48} cy={48} r={46} fill="rgba(45,212,191,0.08)" />
      <circle cx={48} cy={48} r={46} fill="none" stroke="rgba(45,212,191,0.35)" strokeWidth={2} />
      <g transform="translate(48 50)">
        <path d="M -22 6 L 22 6 L 14 18 L -14 18 Z" fill={TEAL} />
        <path d="M 0 -20 L 18 0 L 0 0 Z" fill={TEAL} opacity={0.55} />
        <rect x={-2} y={-20} width={4} height={38} rx={2} fill="rgba(255,255,255,0.35)" />
      </g>
      <g style={{ animation: "fbPulse 1.6s ease infinite" }}>
        <line x1={16} y1={70} x2={44} y2={70} stroke={TEAL} strokeWidth={4} strokeLinecap="round" />
        <path d="M 44 70 L 38 65 L 38 75 Z" fill={TEAL} />
      </g>
    </svg>
  );
}
