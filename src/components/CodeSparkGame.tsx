"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  availableOps,
  bandFromProfile,
  codeSparkSkillSeed,
  countOps,
  difficultyFromPKnown,
  generateLevel,
  opLabel,
  validateProgram,
  type CodeBand,
  type CodeLevel,
  type CodeOp,
  type CodeSnapshot,
  type CodeResult,
} from "@/lib/entertain/code-spark";
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
} = GAME_TOKENS["code-spark"];

type Phase = "build" | "running" | "done";

export function CodeSparkGame() {
  const juice = useJuice();
  const account = useMemo(() => {
    try {
      return getActiveAccount(loadAccounts());
    } catch {
      return null;
    }
  }, []);
  const accountId = account?.id ?? "acct_ryan";
  const band: CodeBand = bandFromProfile({
    grade: account?.profile.grade,
    age: account?.profile.age,
  });
  const opsAllowed = availableOps(band);

  const [level, setLevel] = useState<CodeLevel | null>(null);
  const [program, setProgram] = useState<CodeOp[]>([]);
  const [phase, setPhase] = useState<Phase>("build");
  const [cursor, setCursor] = useState(0);
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [cleared, setCleared] = useState(0);
  const [nesting, setNesting] = useState<null | "repeat" | "ifClear">(null);
  const [repeatTimes, setRepeatTimes] = useState<2 | 3 | 4>(2);

  const startLevel = useCallback(() => {
    const mem = loadLearningMemory(accountId);
    const skill = mem.skills?.find((s) =>
      /coding|algorithm|computational|sequence|loop/i.test(
        `${s.id} ${s.label ?? ""}`,
      ),
    );
    const diff = difficultyFromPKnown(skill?.pKnown ?? 0.45);
    const next = generateLevel(band, diff);
    setLevel(next);
    setProgram([]);
    setPhase("build");
    setCursor(0);
    setSnapshots([{ ...next.start, status: "ok" }]);
    setResult(null);
    setNesting(null);
  }, [accountId, band]);

  useEffect(() => {
    startLevel();
  }, [startLevel]);

  const pushOp = useCallback(
    (op: CodeOp) => {
      if (phase === "running") return;
      setResult(null);
      setPhase("build");
      if (nesting === "repeat") {
        setProgram((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "repeat") {
            return [
              ...prev.slice(0, -1),
              { ...last, body: [...last.body, op] },
            ];
          }
          return [
            ...prev,
            { type: "repeat", times: repeatTimes, body: [op] },
          ];
        });
        return;
      }
      if (nesting === "ifClear") {
        setProgram((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "ifClear") {
            return [
              ...prev.slice(0, -1),
              { ...last, body: [...last.body, op] },
            ];
          }
          return [...prev, { type: "ifClear", body: [op] }];
        });
        return;
      }
      setProgram((prev) => [...prev, op]);
    },
    [phase, nesting, repeatTimes],
  );

  const undo = useCallback(() => {
    if (phase === "running") return;
    setProgram((prev) => prev.slice(0, -1));
    setResult(null);
    setPhase("build");
  }, [phase]);

  const clearProgram = useCallback(() => {
    if (phase === "running") return;
    setProgram([]);
    setResult(null);
    setPhase("build");
    setNesting(null);
  }, [phase]);

  const run = useCallback(() => {
    if (!level || phase === "running") return;
    const res = validateProgram(level, program);
    setResult(res);
    setSnapshots(res.run.snapshots);
    setCursor(0);
    setPhase("running");
    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Code Spark · ${band} L${level.difficulty}`,
      userText: `program ops=${countOps(program)} → ${res.run.reason}`,
      skillSeed: codeSparkSkillSeed(level),
      outcome: res.outcome,
    });
  }, [level, program, phase, accountId, band]);

  // Animate snapshots
  useEffect(() => {
    if (phase !== "running" || snapshots.length === 0) return;
    if (cursor >= snapshots.length - 1) {
      const last = snapshots[snapshots.length - 1];
      if (last?.status === "goal" || result?.correct) {
        juice.playCorrect();
        setCleared((c) => Math.min(5, c + 1));
        setPhase("done");
      } else {
        juice.playError();
        setPhase("done");
      }
      return;
    }
    const id = window.setTimeout(() => setCursor((c) => c + 1), 280);
    return () => window.clearTimeout(id);
  }, [phase, cursor, snapshots, result, juice]);

  const pose = snapshots[Math.min(cursor, snapshots.length - 1)] ??
    (level ? { ...level.start, status: "ok" as const } : null);

  if (!level || !pose) {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ background: BASE, color: INK_MUTED }}>
        Loading Code Spark…
      </div>
    );
  }

  const size = level.grid.length;

  return (
    <div className="flex flex-1 flex-col" style={{ background: BASE, color: INK }}>
      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}18`, color: ACCENT }}
          >
            Code Spark
            <span style={{ color: INK_MUTED }}>· {band} · L{level.difficulty}</span>
          </span>
          <span className="flex items-center gap-1.5" aria-label={`${cleared} clears`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: i < cleared ? ACCENT : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        <div
          className="rounded-2xl border p-3"
          style={{ borderColor: STROKE, background: SURFACE }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
            Mission
          </p>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            {level.prompt}
          </p>
        </div>

        {/* Grid */}
        <div
          className="mx-auto grid gap-1 rounded-2xl border p-2"
          style={{
            borderColor: STROKE,
            background: "rgba(0,0,0,0.25)",
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            width: "min(100%, 280px)",
          }}
          aria-label="Code Spark map"
        >
          {level.grid.map((row, r) =>
            row.map((cell, c) => {
              const isBot = pose.r === r && pose.c === c;
              const isGoal = level.goal.r === r && level.goal.c === c;
              return (
                <div
                  key={`${r}-${c}`}
                  className="relative aspect-square rounded-md"
                  style={{
                    background:
                      cell === "#"
                        ? "rgba(251,113,133,0.35)"
                        : isGoal
                          ? `${ACCENT}33`
                          : "rgba(255,255,255,0.06)",
                    outline: isBot ? `2px solid ${ACCENT}` : undefined,
                  }}
                >
                  {isGoal && !isBot ? (
                    <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: ACCENT }}>
                      ★
                    </span>
                  ) : null}
                  {isBot ? (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-sm transition-transform duration-200"
                      style={{
                        color: ACCENT,
                        transform: `rotate(${pose.facing * 90}deg)`,
                      }}
                      aria-label={`Bot facing ${pose.facing}`}
                    >
                      ▲
                    </span>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        {/* Program strip */}
        <div
          className="min-h-14 rounded-2xl border p-2"
          style={{ borderColor: STROKE, background: SURFACE }}
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
            Program {nesting ? `· editing ${nesting}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {program.length === 0 ? (
              <span className="text-xs" style={{ color: INK_MUTED }}>
                Empty — tap blocks below
              </span>
            ) : (
              program.map((op, i) => (
                <span
                  key={i}
                  className="rounded-lg border px-2 py-1 text-[11px] font-medium"
                  style={{ borderColor: `${ACCENT}55`, color: ACCENT, background: `${ACCENT}14` }}
                >
                  {opLabel(op)}
                  {op.type === "repeat" || op.type === "ifClear"
                    ? ` {${op.body.map(opLabel).join(", ")}}`
                    : ""}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Palette */}
        <div className="flex flex-wrap gap-2">
          {opsAllowed.includes("forward") && (
            <PaletteBtn label="Forward" onClick={() => pushOp({ type: "forward" })} disabled={phase === "running"} />
          )}
          {opsAllowed.includes("left") && (
            <PaletteBtn label="Turn left" onClick={() => pushOp({ type: "left" })} disabled={phase === "running"} />
          )}
          {opsAllowed.includes("right") && (
            <PaletteBtn label="Turn right" onClick={() => pushOp({ type: "right" })} disabled={phase === "running"} />
          )}
          {opsAllowed.includes("repeat") && (
            <>
              <PaletteBtn
                label={nesting === "repeat" ? "Done repeat" : `Repeat ×${repeatTimes}`}
                onClick={() => {
                  if (nesting === "repeat") {
                    setNesting(null);
                    return;
                  }
                  setNesting("repeat");
                  setProgram((prev) => [
                    ...prev,
                    { type: "repeat", times: repeatTimes, body: [] },
                  ]);
                }}
                disabled={phase === "running"}
              />
              {nesting === "repeat" ? (
                <PaletteBtn
                  label="× cycle"
                  onClick={() =>
                    setRepeatTimes((t) => (t === 2 ? 3 : t === 3 ? 4 : 2))
                  }
                  disabled={phase === "running"}
                />
              ) : null}
            </>
          )}
          {opsAllowed.includes("ifClear") && (
            <PaletteBtn
              label={nesting === "ifClear" ? "Done if" : "If clear"}
              onClick={() => {
                if (nesting === "ifClear") {
                  setNesting(null);
                  return;
                }
                setNesting("ifClear");
                setProgram((prev) => [...prev, { type: "ifClear", body: [] }]);
              }}
              disabled={phase === "running"}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={run}
            disabled={phase === "running" || program.length === 0}
            className="min-h-12 flex-1 rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: ACCENT, color: BASE }}
          >
            {phase === "running" ? "Running…" : "Run"}
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={phase === "running" || program.length === 0}
            className="min-h-12 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: STROKE, color: INK_MUTED }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={clearProgram}
            disabled={phase === "running" || program.length === 0}
            className="min-h-12 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: STROKE, color: INK_MUTED }}
          >
            Clear
          </button>
        </div>

        {result && phase === "done" ? (
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
            <div className="mt-3 flex gap-2">
              {!result.correct ? (
                <button
                  type="button"
                  onClick={() => {
                    setPhase("build");
                    setResult(null);
                    setSnapshots([{ ...level.start, status: "ok" }]);
                    setCursor(0);
                  }}
                  className="min-h-11 flex-1 rounded-xl text-sm font-semibold"
                  style={{ background: ACCENT, color: BASE }}
                >
                  Edit &amp; run again
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startLevel}
                  className="min-h-11 flex-1 rounded-xl text-sm font-semibold"
                  style={{ background: ACCENT, color: BASE }}
                >
                  Next mission
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PaletteBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-10 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-40"
      style={{ borderColor: `${ACCENT}55`, color: ACCENT, background: `${ACCENT}12` }}
    >
      {label}
    </button>
  );
}
