"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  availableOps,
  bandForConcept,
  countOps,
  difficultyFromPKnown,
  opLabel,
  opsToPython,
  validateProgram,
  type CodeConcept,
  type CodeLevel,
  type CodeOp,
  type CodeResult,
  type CodingResultNote,
} from "@/lib/entertain/code-spark";
import {
  conceptSkillSeed,
  generateMicroLevel,
} from "@/lib/entertain/code-spark-curriculum";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { loadLearningMemory } from "@/lib/learning-memory";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

type Props = {
  concept: CodeConcept;
  accountId?: string;
  onResult: (note: CodingResultNote) => void;
  onClose: () => void;
};

const BLOCK_COLOR: Record<CodeOp["type"], string> = {
  forward: "#4C97FF",
  left: "#4C97FF",
  right: "#4C97FF",
  repeat: "#FFAB19",
  ifClear: "#5CB1D6",
};

/**
 * Tier 1 — a compact, on-topic 30-second micro-challenge shown inside the
 * main chat. Keyed to the exact concept the student asked about (sequence /
 * loop / conditional), not their age band. Run validates the path, shows
 * plain-language coaching, and reports the result back to the conversation
 * via `onResult` so the tutor can keep coaching the SAME idea next turn.
 */
export function InlineCodingCard({
  concept,
  accountId,
  onResult,
  onClose,
}: Props) {
  const acct = accountId && accountId !== "default" ? accountId : "acct_ryan";
  const band = bandForConcept(concept);
  const opsAllowed = availableOps(band);

  const difficulty = useMemo(() => {
    try {
      const mem = loadLearningMemory(acct);
      const skill = mem.skills?.find((s) =>
        /coding|algorithm|computational|sequence|loop|python/i.test(
          `${s.id} ${s.label ?? ""}`,
        ),
      );
      return difficultyFromPKnown(skill?.pKnown ?? 0.45);
    } catch {
      return 2;
    }
  }, [acct]);

  const [level, setLevel] = useState<CodeLevel>(() =>
    generateMicroLevel(concept, difficulty),
  );
  const [program, setProgram] = useState<CodeOp[]>([]);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [nesting, setNesting] = useState<null | "repeat" | "ifClear">(null);
  const [repeatTimes, setRepeatTimes] = useState<2 | 3 | 4>(2);
  const [showPyPreview, setShowPyPreview] = useState(false);

  useEffect(() => {
    setLevel(generateMicroLevel(concept, difficulty));
    setProgram([]);
    setResult(null);
    setNesting(null);
    setShowPyPreview(false);
  }, [concept, difficulty]);

  const pushOp = useCallback(
    (op: CodeOp) => {
      setResult(null);
      if (nesting === "repeat") {
        setProgram((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "repeat") {
            return [
              ...prev.slice(0, -1),
              { ...last, body: [...last.body, op] },
            ];
          }
          return [...prev, { type: "repeat", times: repeatTimes, body: [op] }];
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
    [nesting, repeatTimes],
  );

  const undo = useCallback(() => {
    setProgram((prev) => prev.slice(0, -1));
    setResult(null);
  }, []);

  const run = useCallback(() => {
    if (program.length === 0) return;
    const res = validateProgram(level, program);
    setResult(res);
    const note: CodingResultNote = {
      concept,
      outcome: res.outcome,
      stars: res.stars,
      steps: Math.max(0, res.run.snapshots.length - 1),
      mode: "blocks",
      levelTitle: level.title,
    };
    onResult(note);
    void recordStudioLearningTurn({
      accountId: acct,
      source: "game",
      title: `Code Spark · micro · ${concept} · ${level.title}`,
      userText: `blocks ops=${countOps(program)} → ${res.run.reason} ★${res.stars}`,
      skillSeed: conceptSkillSeed(concept),
      outcome: res.outcome,
    });
  }, [program, level, concept, acct, onResult]);

  const size = level.grid.length;

  return (
    <div className="mt-3 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--teal)]/40 bg-[var(--surface)] shadow-[0_8px_28px_rgba(20,40,35,0.08)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--teal)]/8 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Try it · 30s
          </p>
          <p className="truncate text-xs text-[var(--ink-muted)]">
            {level.title} · {level.conceptFocus}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 shrink-0 rounded-lg px-2 text-xs text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
        >
          Close
        </button>
      </div>

      <div className="px-4 py-3">
        <p className="text-sm text-[var(--ink-muted)]">{level.prompt}</p>

        {/* Grid */}
        <div
          className="mx-auto my-3 grid gap-1 rounded-xl border p-2"
          style={{
            borderColor: "var(--line)",
            background: "rgba(0,0,0,0.18)",
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            width: "min(100%, 220px)",
          }}
          aria-label="Micro challenge map"
        >
          {level.grid.map((row, r) =>
            row.map((cell, c) => {
              const isStart = level.start.r === r && level.start.c === c;
              const isGoal = level.goal.r === r && level.goal.c === c;
              return (
                <div
                  key={`${r}-${c}`}
                  className="relative aspect-square rounded-md"
                  style={{
                    background:
                      cell === "#"
                        ? "rgba(251,113,133,0.4)"
                        : isGoal
                          ? "rgba(32,178,170,0.28)"
                          : "rgba(255,255,255,0.06)",
                  }}
                >
                  {isGoal ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] text-[var(--teal)]">
                      ★
                    </span>
                  ) : null}
                  {isStart ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[12px] text-[var(--teal)]">
                      ▲
                    </span>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        {/* Program */}
        <div className="min-h-12 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/40 p-2">
          {program.length === 0 ? (
            <span className="text-xs text-[var(--ink-muted)]">
              Tap blocks below to build the path.
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              {program.map((op, i) => (
                <BlockChip key={i} op={op} />
              ))}
            </div>
          )}
        </div>

        {/* Palette */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {opsAllowed.includes("forward") && (
            <PaletteBtn label="Forward" color={BLOCK_COLOR.forward} onClick={() => pushOp({ type: "forward" })} />
          )}
          {opsAllowed.includes("left") && (
            <PaletteBtn label="Left" color={BLOCK_COLOR.left} onClick={() => pushOp({ type: "left" })} />
          )}
          {opsAllowed.includes("right") && (
            <PaletteBtn label="Right" color={BLOCK_COLOR.right} onClick={() => pushOp({ type: "right" })} />
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
              />
              {nesting === "repeat" ? (
                <PaletteBtn
                  label="×cycle"
                  color={BLOCK_COLOR.repeat}
                  onClick={() =>
                    setRepeatTimes((t) => (t === 2 ? 3 : t === 3 ? 4 : 2))
                  }
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
            />
          )}
        </div>

        {result ? (
          <div
            className="mt-2 rounded-xl border px-3 py-2"
            style={{
              borderColor: result.correct
                ? "rgba(32,178,170,0.5)"
                : "rgba(251,113,133,0.5)",
              background: result.correct
                ? "rgba(32,178,170,0.1)"
                : "rgba(251,113,133,0.08)",
            }}
          >
            {result.correct && result.stars > 0 ? (
              <p className="text-sm text-[var(--teal)]" aria-label={`${result.stars} stars`}>
                {"★".repeat(result.stars)}
                <span className="opacity-35">{"☆".repeat(3 - result.stars)}</span>
              </p>
            ) : null}
            <p
              className="text-[13px]"
              style={{ color: result.correct ? "var(--teal)" : "var(--coral)" }}
            >
              {result.message}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={run}
            disabled={program.length === 0}
            className="min-h-11 flex-1 rounded-xl bg-[var(--teal)] px-3 text-[13px] font-semibold text-white transition hover:bg-[var(--teal)]/90 active:scale-95 disabled:opacity-40"
          >
            Run
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={program.length === 0}
            className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-[13px] text-[var(--ink-muted)] disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setShowPyPreview((v) => !v)}
            className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-[13px] text-[var(--ink-muted)]"
          >
            Python
          </button>
        </div>

        {showPyPreview ? (
          <pre className="mt-2 overflow-x-auto rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--teal)]">
            {program.length === 0 ? "# tap blocks — Python appears here" : opsToPython(program)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function BlockChip({ op, depth = 0 }: { op: CodeOp; depth?: number }) {
  const color = BLOCK_COLOR[op.type];
  return (
    <div style={{ marginLeft: depth * 10 }}>
      <span
        className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
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
  color,
}: {
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 rounded-lg border px-2.5 text-xs font-semibold text-white transition active:scale-95"
      style={{ borderColor: `${color}99`, background: color }}
    >
      {label}
    </button>
  );
}
