"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  availableOps,
  bandFromProfile,
  codeSparkSkillSeed,
  countOps,
  defaultEditorMode,
  difficultyFromPKnown,
  generateLevel,
  opLabel,
  opsToPython,
  parsePythonProgram,
  pythonStarter,
  trackFromBand,
  trackLabel,
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
type EditorMode = "blocks" | "python";

const TRACKS: Array<ReturnType<typeof trackFromBand>> = [
  "foundations",
  "loops",
  "branching",
  "text-bridge",
];

/** Scratch-inspired palette colors (Motion / Control / Sensing). */
const BLOCK_COLOR: Record<CodeOp["type"], string> = {
  forward: "#4C97FF",
  left: "#4C97FF",
  right: "#4C97FF",
  repeat: "#FFAB19",
  ifClear: "#5CB1D6",
};

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
  const track = trackFromBand(band);

  const [level, setLevel] = useState<CodeLevel | null>(null);
  const [program, setProgram] = useState<CodeOp[]>([]);
  const [mode, setMode] = useState<EditorMode>(() => defaultEditorMode(band));
  const [pythonSrc, setPythonSrc] = useState(() => pythonStarter(band));
  const [parseError, setParseError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("build");
  const [cursor, setCursor] = useState(0);
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [cleared, setCleared] = useState(0);
  const [bestStars, setBestStars] = useState(0);
  const [nesting, setNesting] = useState<null | "repeat" | "ifClear">(null);
  const [repeatTimes, setRepeatTimes] = useState<2 | 3 | 4>(2);
  const [showPyPreview, setShowPyPreview] = useState(false);

  const startLevel = useCallback(() => {
    const mem = loadLearningMemory(accountId);
    const skill = mem.skills?.find((s) =>
      /coding|algorithm|computational|sequence|loop|python/i.test(
        `${s.id} ${s.label ?? ""}`,
      ),
    );
    const diff = difficultyFromPKnown(skill?.pKnown ?? 0.45);
    const next = generateLevel(band, diff);
    setLevel(next);
    setProgram([]);
    setPythonSrc(pythonStarter(band));
    setParseError(null);
    setPhase("build");
    setCursor(0);
    setSnapshots([{ ...next.start, status: "ok" }]);
    setResult(null);
    setNesting(null);
    setShowPyPreview(false);
  }, [accountId, band]);

  useEffect(() => {
    startLevel();
  }, [startLevel]);

  useEffect(() => {
    setMode(defaultEditorMode(band));
  }, [band]);

  const switchMode = useCallback(
    (next: EditorMode) => {
      if (phase === "running") return;
      if (next === "python" && mode === "blocks" && program.length > 0) {
        setPythonSrc(opsToPython(program) + "\n");
      }
      if (next === "blocks" && mode === "python") {
        const parsed = parsePythonProgram(pythonSrc);
        if (parsed.ok) {
          setProgram(parsed.program);
          setParseError(null);
        }
      }
      setMode(next);
      setResult(null);
      setPhase("build");
    },
    [mode, phase, program, pythonSrc],
  );

  /** CodeCombat-style remake: same mission, typed Python from current blocks. */
  const remakeInPython = useCallback(() => {
    if (phase === "running" || !level) return;
    const src =
      program.length > 0 ? opsToPython(program) + "\n" : pythonStarter(band);
    setPythonSrc(src);
    setMode("python");
    setParseError(null);
    setResult(null);
    setPhase("build");
    setSnapshots([{ ...level.start, status: "ok" }]);
    setCursor(0);
    setShowPyPreview(false);
  }, [phase, level, program, band]);

  const pushOp = useCallback(
    (op: CodeOp) => {
      if (phase === "running" || mode !== "blocks") return;
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
    [phase, nesting, repeatTimes, mode],
  );

  const undo = useCallback(() => {
    if (phase === "running" || mode !== "blocks") return;
    setProgram((prev) => prev.slice(0, -1));
    setResult(null);
    setPhase("build");
  }, [phase, mode]);

  const clearProgram = useCallback(() => {
    if (phase === "running") return;
    setProgram([]);
    setPythonSrc(pythonStarter(band));
    setParseError(null);
    setResult(null);
    setPhase("build");
    setNesting(null);
  }, [phase, band]);

  const run = useCallback(() => {
    if (!level || phase === "running") return;
    let ops = program;
    if (mode === "python") {
      const parsed = parsePythonProgram(pythonSrc);
      if (!parsed.ok) {
        setParseError(
          parsed.line
            ? `Line ${parsed.line}: ${parsed.error}`
            : parsed.error,
        );
        juice.playError();
        return;
      }
      setParseError(null);
      ops = parsed.program;
      setProgram(ops);
    }
    if (ops.length === 0) return;
    const res = validateProgram(level, ops);
    setResult(res);
    setSnapshots(res.run.snapshots);
    setCursor(0);
    setPhase("running");
    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Code Spark · ${level.title} · ${band} L${level.difficulty}`,
      userText: `${mode} ops=${countOps(ops)} → ${res.run.reason} ★${res.stars}`,
      skillSeed: codeSparkSkillSeed(level),
      outcome: res.outcome,
    });
  }, [level, program, phase, accountId, band, mode, pythonSrc, juice]);

  useEffect(() => {
    if (phase !== "running" || snapshots.length === 0) return;
    if (cursor >= snapshots.length - 1) {
      const last = snapshots[snapshots.length - 1];
      if (last?.status === "goal" || result?.correct) {
        juice.playCorrect();
        setCleared((c) => Math.min(5, c + 1));
        if (result?.stars) {
          setBestStars((s) => Math.max(s, result.stars));
        }
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
  const canRun =
    phase !== "running" &&
    (mode === "blocks" ? program.length > 0 : pythonSrc.trim().length > 0);

  return (
    <div className="flex flex-1 flex-col" style={{ background: BASE, color: INK }}>
      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
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
          {/* freeCodeCamp-style skill track */}
          <div className="flex flex-wrap gap-1.5" aria-label="Skill track">
            {TRACKS.map((t) => {
              const active = t === track;
              return (
                <span
                  key={t}
                  className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    borderColor: active ? `${ACCENT}66` : "rgba(255,255,255,0.1)",
                    background: active ? `${ACCENT}22` : "transparent",
                    color: active ? ACCENT : INK_MUTED,
                  }}
                >
                  {trackLabel(t)}
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        <div
          className="rounded-2xl border p-3"
          style={{ borderColor: STROKE, background: SURFACE }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
            Mission · {level.title}
          </p>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            {level.prompt}
          </p>
          {bestStars > 0 ? (
            <p className="mt-1.5 text-[11px]" style={{ color: ACCENT }} aria-label={`Best ${bestStars} stars`}>
              {"★".repeat(bestStars)}
              <span style={{ color: INK_MUTED }}>{"☆".repeat(3 - bestStars)} session best</span>
            </p>
          ) : null}
        </div>

        {/* Mode toggle — Blocks default (Scratch/Code.org) | Python Bridge (CodeCombat) */}
        <div className="flex gap-1 rounded-xl border p-1" style={{ borderColor: STROKE, background: SURFACE }}>
          {(["blocks", "python"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              disabled={phase === "running"}
              className="min-h-9 flex-1 rounded-lg text-xs font-semibold transition disabled:opacity-40"
              style={{
                background: mode === m ? ACCENT : "transparent",
                color: mode === m ? BASE : INK_MUTED,
              }}
            >
              {m === "blocks" ? "Blocks" : "Python Bridge"}
            </button>
          ))}
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

        {mode === "blocks" ? (
          <>
            <div
              className="min-h-14 rounded-2xl border p-2"
              style={{ borderColor: STROKE, background: SURFACE }}
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
                Program {nesting ? `· editing ${nesting}` : ""}
              </p>
              <div className="flex flex-col gap-1">
                {program.length === 0 ? (
                  <span className="text-xs" style={{ color: INK_MUTED }}>
                    Empty — tap blocks below (Scratch-style)
                  </span>
                ) : (
                  program.map((op, i) => (
                    <BlockChip key={i} op={op} />
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {opsAllowed.includes("forward") && (
                <PaletteBtn label="Forward" color={BLOCK_COLOR.forward} onClick={() => pushOp({ type: "forward" })} disabled={phase === "running"} />
              )}
              {opsAllowed.includes("left") && (
                <PaletteBtn label="Turn left" color={BLOCK_COLOR.left} onClick={() => pushOp({ type: "left" })} disabled={phase === "running"} />
              )}
              {opsAllowed.includes("right") && (
                <PaletteBtn label="Turn right" color={BLOCK_COLOR.right} onClick={() => pushOp({ type: "right" })} disabled={phase === "running"} />
              )}
              {opsAllowed.includes("repeat") && (
                <>
                  <PaletteBtn
                    label={nesting === "repeat" ? "Done repeat" : `Repeat ×${repeatTimes}`}
                    color={BLOCK_COLOR.repeat}
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
                      color={BLOCK_COLOR.repeat}
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
                  color={BLOCK_COLOR.ifClear}
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

            {/* MakeCode / Code Monster style side-by-side translation */}
            <div
              className="rounded-2xl border"
              style={{ borderColor: STROKE, background: SURFACE }}
            >
              <button
                type="button"
                onClick={() => setShowPyPreview((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: INK_MUTED }}
                aria-expanded={showPyPreview}
              >
                <span>See as Python</span>
                <span aria-hidden>{showPyPreview ? "▾" : "▸"}</span>
              </button>
              {showPyPreview ? (
                <pre
                  className="overflow-x-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed"
                  style={{
                    borderColor: STROKE,
                    color: ACCENT,
                    background: "rgba(0,0,0,0.28)",
                  }}
                >
                  {program.length === 0
                    ? "# tap blocks — Python appears here"
                    : opsToPython(program)}
                </pre>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
              Python Bridge (CodeCombat-style DSL)
            </label>
            <textarea
              value={pythonSrc}
              onChange={(e) => {
                setPythonSrc(e.target.value);
                setParseError(null);
                setResult(null);
                setPhase("build");
              }}
              disabled={phase === "running"}
              spellCheck={false}
              rows={8}
              className="w-full resize-y rounded-2xl border p-3 font-mono text-[12px] leading-relaxed outline-none disabled:opacity-60"
              style={{
                borderColor: parseError ? `${CORAL}88` : STROKE,
                background: "rgba(0,0,0,0.35)",
                color: INK,
              }}
              aria-label="Python program"
            />
            {parseError ? (
              <p className="text-xs" style={{ color: CORAL }}>
                {parseError}
              </p>
            ) : (
              <p className="text-[11px]" style={{ color: INK_MUTED }}>
                move_forward · turn_left/right · for i in range(2|3|4) · if clear()
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="min-h-12 flex-1 rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: ACCENT, color: BASE }}
          >
            {phase === "running" ? "Running…" : "Run"}
          </button>
          {mode === "blocks" ? (
            <button
              type="button"
              onClick={undo}
              disabled={phase === "running" || program.length === 0}
              className="min-h-12 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"
              style={{ borderColor: STROKE, color: INK_MUTED }}
            >
              Undo
            </button>
          ) : null}
          <button
            type="button"
            onClick={clearProgram}
            disabled={phase === "running"}
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
            {result.correct && result.stars > 0 ? (
              <p className="mb-1 text-base tracking-wide" style={{ color: ACCENT }} aria-label={`${result.stars} stars`}>
                {"★".repeat(result.stars)}
                <span style={{ opacity: 0.35 }}>{"☆".repeat(3 - result.stars)}</span>
              </p>
            ) : null}
            <p className="text-sm" style={{ color: result.correct ? ACCENT : CORAL }}>
              {result.message}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
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
                <>
                  <button
                    type="button"
                    onClick={startLevel}
                    className="min-h-11 flex-1 rounded-xl text-sm font-semibold"
                    style={{ background: ACCENT, color: BASE }}
                  >
                    Next mission
                  </button>
                  {mode === "blocks" ? (
                    <button
                      type="button"
                      onClick={remakeInPython}
                      className="min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold"
                      style={{ borderColor: `${ACCENT}88`, color: ACCENT }}
                    >
                      Try in Python
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BlockChip({ op, depth = 0 }: { op: CodeOp; depth?: number }) {
  const color = BLOCK_COLOR[op.type];
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <span
        className="inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold text-white"
        style={{ background: color }}
      >
        {opLabel(op)}
      </span>
      {(op.type === "repeat" || op.type === "ifClear") &&
        op.body.map((child, i) => (
          <BlockChip key={i} op={child} depth={depth + 1} />
        ))}
    </div>
  );
}

function PaletteBtn({
  label,
  onClick,
  disabled,
  color,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}) {
  const fill = color ?? ACCENT;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-10 rounded-xl border px-3 text-xs font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
      style={{ borderColor: `${fill}99`, background: fill }}
    >
      {label}
    </button>
  );
}
