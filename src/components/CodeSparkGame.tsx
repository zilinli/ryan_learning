"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  availableOps,
  countOps,
  opLabel,
  opsToPython,
  parsePythonProgram,
  pythonStarter,
  runProgram,
  validateProgram,
  type CodeLevel,
  type CodeOp,
  type CodeSnapshot,
  type CodeResult,
} from "@/lib/entertain/code-spark";
import {
  conceptSkillSeed,
  getCurriculum,
  hintLadder,
  narrateStep,
  type CodeLessonPhase,
  type CurriculumNode,
} from "@/lib/entertain/code-spark-curriculum";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import {
  loadLearningMemory,
  needsReviewSkills,
  prerequisitesSatisfied,
  type LearningMemory,
} from "@/lib/learning-memory";
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

type RunPhase = "build" | "running" | "done";
type EditorMode = "blocks" | "python";

const MASTER_THRESHOLD = 0.8;

/** Scratch-inspired palette colors (Motion / Control / Sensing). */
const BLOCK_COLOR: Record<CodeOp["type"], string> = {
  forward: "#4C97FF",
  left: "#4C97FF",
  right: "#4C97FF",
  repeat: "#FFAB19",
  ifClear: "#5CB1D6",
};

type ParsonsItem = { key: number; op: CodeOp };

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Derive a plain-English caption between two animation frames. */
function captionBetween(prev: CodeSnapshot, next: CodeSnapshot): string {
  if (next.status === "bump") return narrateStep({ type: "forward" }, next);
  if (next.status === "goal") return "The bot reaches the star.";
  if (next.r !== prev.r || next.c !== prev.c) {
    return narrateStep({ type: "forward" }, next);
  }
  const d = (next.facing - prev.facing + 4) % 4;
  if (d === 1) return narrateStep({ type: "right" }, next);
  if (d === 3) return narrateStep({ type: "left" }, next);
  return "";
}

export function CodeSparkGame() {
  const juice = useJuice();
  const nodes = useMemo(() => getCurriculum(), []);

  const account = useMemo(() => {
    try {
      return getActiveAccount(loadAccounts());
    } catch {
      return null;
    }
  }, []);
  const accountId = account?.id ?? "acct_ryan";

  const [memory, setMemory] = useState<LearningMemory>(() => {
    try {
      return loadLearningMemory(accountId);
    } catch {
      return { topics: [], skills: [] } as unknown as LearningMemory;
    }
  });

  const reviewIds = useMemo(() => {
    try {
      return new Set(needsReviewSkills(memory, 10).map((s) => s.id));
    } catch {
      return new Set<string>();
    }
  }, [memory]);

  const nodeStatus = useCallback(
    (node: CurriculumNode): "locked" | "available" | "mastered" => {
      const unlocked = prerequisitesSatisfied(memory, node.id);
      if (!unlocked) return "locked";
      const pKnown = memory.skills?.find((s) => s.id === node.id)?.pKnown ?? 0;
      return pKnown >= MASTER_THRESHOLD ? "mastered" : "available";
    },
    [memory],
  );

  const [selectedNode, setSelectedNode] = useState<CurriculumNode | null>(null);
  const [lessonPhase, setLessonPhase] = useState<CodeLessonPhase>("learn");

  // ── Learn phase state ─────────────────────────────────────────────
  const [learnSnapshots, setLearnSnapshots] = useState<CodeSnapshot[]>([]);
  const [learnCursor, setLearnCursor] = useState(0);

  // ── Parsons phase state ───────────────────────────────────────────
  const [parsonsPool, setParsonsPool] = useState<ParsonsItem[]>([]);
  const [parsonsSlots, setParsonsSlots] = useState<ParsonsItem[]>([]);
  const [parsonsResult, setParsonsResult] = useState<CodeResult | null>(null);

  // ── Apply phase state (block editor) ──────────────────────────────
  const [applyIndex, setApplyIndex] = useState(0);
  const [program, setProgram] = useState<CodeOp[]>([]);
  const [mode, setMode] = useState<EditorMode>("blocks");
  const [pythonSrc, setPythonSrc] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [runPhase, setRunPhase] = useState<RunPhase>("build");
  const [cursor, setCursor] = useState(0);
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [nesting, setNesting] = useState<null | "repeat" | "ifClear">(null);
  const [repeatTimes, setRepeatTimes] = useState<2 | 3 | 4>(2);
  const [showPyPreview, setShowPyPreview] = useState(false);
  const [hintCount, setHintCount] = useState(0);

  const applyLevel: CodeLevel | null = selectedNode?.apply[applyIndex] ?? null;
  const opsAllowed = applyLevel ? availableOps(applyLevel.band) : [];

  // ── enter / exit lesson ───────────────────────────────────────────
  const openNode = useCallback((node: CurriculumNode) => {
    setSelectedNode(node);
    setLessonPhase("learn");
    setApplyIndex(0);
    setProgram([]);
    setPythonSrc(pythonStarter(node.apply[0]?.band ?? "early"));
    setParseError(null);
    setRunPhase("build");
    setResult(null);
    setNesting(null);
    setShowPyPreview(false);
    setHintCount(0);
    const run = runProgram(node.learn.level, node.learn.worked);
    setLearnSnapshots(run.snapshots);
    setLearnCursor(0);
  }, []);

  const closeLesson = useCallback(() => {
    setSelectedNode(null);
    setLessonPhase("learn");
  }, []);

  const startParsons = useCallback(() => {
    if (!selectedNode) return;
    setLessonPhase("parsons");
    setParsonsResult(null);
    setParsonsPool(
      shuffle(selectedNode.parsons.solution.map((op, i) => ({ key: i, op }))),
    );
    setParsonsSlots([]);
  }, [selectedNode]);

  const startApply = useCallback(() => {
    if (!selectedNode) return;
    setLessonPhase("apply");
    setParsonsResult(null);
    setProgram([]);
    setPythonSrc(pythonStarter(selectedNode.apply[applyIndex]?.band ?? "early"));
    setParseError(null);
    setRunPhase("build");
    setCursor(0);
    setSnapshots([
      { ...(selectedNode.apply[applyIndex]?.start ?? { r: 0, c: 0, facing: 0 as const }), status: "ok" as const },
    ]);
    setResult(null);
    setNesting(null);
    setShowPyPreview(false);
    setHintCount(0);
  }, [selectedNode, applyIndex]);

  // ── Learn animation ───────────────────────────────────────────────
  useEffect(() => {
    if (lessonPhase !== "learn" || learnSnapshots.length === 0) return;
    if (learnCursor >= learnSnapshots.length - 1) return;
    const id = window.setTimeout(() => setLearnCursor((c) => c + 1), 360);
    return () => window.clearTimeout(id);
  }, [lessonPhase, learnCursor, learnSnapshots]);

  // ── Parsons: tap pool → slot, tap slot → pool ─────────────────────
  const addToSlots = useCallback((item: ParsonsItem) => {
    setParsonsResult(null);
    setParsonsPool((p) => p.filter((x) => x.key !== item.key));
    setParsonsSlots((s) => [...s, item]);
  }, []);
  const removeFromSlots = useCallback((item: ParsonsItem) => {
    setParsonsResult(null);
    setParsonsSlots((s) => s.filter((x) => x.key !== item.key));
    setParsonsPool((p) => [...p, item]);
  }, []);

  const runParsons = useCallback(() => {
    if (!selectedNode) return;
    const res = validateProgram(
      selectedNode.parsons.level,
      parsonsSlots.map((s) => s.op),
    );
    setParsonsResult(res);
    if (res.correct) {
      juice.playCorrect();
      window.setTimeout(() => startApply(), 550);
    } else {
      juice.playError();
    }
  }, [selectedNode, parsonsSlots, juice, startApply]);

  // ── Apply: block editor (reused from previous Code Spark) ─────────
  const pushOp = useCallback(
    (op: CodeOp) => {
      if (runPhase === "running" || mode !== "blocks") return;
      setResult(null);
      setRunPhase("build");
      if (nesting === "repeat") {
        setProgram((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "repeat") {
            return [...prev.slice(0, -1), { ...last, body: [...last.body, op] }];
          }
          return [...prev, { type: "repeat", times: repeatTimes, body: [op] }];
        });
        return;
      }
      if (nesting === "ifClear") {
        setProgram((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "ifClear") {
            return [...prev.slice(0, -1), { ...last, body: [...last.body, op] }];
          }
          return [...prev, { type: "ifClear", body: [op] }];
        });
        return;
      }
      setProgram((prev) => [...prev, op]);
    },
    [runPhase, nesting, repeatTimes, mode],
  );

  const undo = useCallback(() => {
    if (runPhase === "running" || mode !== "blocks") return;
    setProgram((prev) => prev.slice(0, -1));
    setResult(null);
    setRunPhase("build");
  }, [runPhase, mode]);

  const clearProgram = useCallback(() => {
    if (runPhase === "running") return;
    setProgram([]);
    setPythonSrc(pythonStarter(applyLevel?.band ?? "early"));
    setParseError(null);
    setResult(null);
    setRunPhase("build");
    setNesting(null);
  }, [runPhase, applyLevel]);

  const switchMode = useCallback(
    (next: EditorMode) => {
      if (runPhase === "running") return;
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
      setRunPhase("build");
    },
    [mode, runPhase, program, pythonSrc],
  );

  const runApply = useCallback(async () => {
    if (!selectedNode || !applyLevel || runPhase === "running") return;
    let ops = program;
    if (mode === "python") {
      const parsed = parsePythonProgram(pythonSrc);
      if (!parsed.ok) {
        setParseError(parsed.line ? `Line ${parsed.line}: ${parsed.error}` : parsed.error);
        juice.playError();
        return;
      }
      setParseError(null);
      ops = parsed.program;
      setProgram(ops);
    }
    if (ops.length === 0) return;
    const res = validateProgram(applyLevel, ops);
    setResult(res);
    setSnapshots(res.run.snapshots);
    setCursor(0);
    setRunPhase("running");
    const next = await recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Code Spark · ${selectedNode.label} · ${applyLevel.title}`,
      userText: `${mode} ops=${countOps(ops)} → ${res.run.reason} ★${res.stars}`,
      skillSeed: conceptSkillSeed(selectedNode.concept),
      outcome: res.outcome,
    });
    if (next) setMemory(next);
  }, [selectedNode, applyLevel, program, runPhase, accountId, mode, pythonSrc, juice]);

  useEffect(() => {
    if (runPhase !== "running" || snapshots.length === 0) return;
    if (cursor >= snapshots.length - 1) {
      const last = snapshots[snapshots.length - 1];
      if (last?.status === "goal" || result?.correct) {
        juice.playCorrect();
        setRunPhase("done");
        if (result?.correct) setLessonPhase("done");
      } else {
        juice.playError();
        setRunPhase("done");
      }
      return;
    }
    const id = window.setTimeout(() => setCursor((c) => c + 1), 280);
    return () => window.clearTimeout(id);
  }, [runPhase, cursor, snapshots, result, juice]);

  const nextConcept = useCallback(() => {
    if (!selectedNode) return;
    const idx = nodes.findIndex((n) => n.id === selectedNode.id);
    const rest = nodes.slice(idx + 1);
    const next = rest.find((n) => nodeStatus(n) !== "locked") ?? rest[0];
    if (next) openNode(next);
    else closeLesson();
  }, [selectedNode, nodes, nodeStatus, openNode, closeLesson]);

  const learnPose =
    lessonPhase === "learn" && selectedNode
      ? learnSnapshots[Math.min(learnCursor, learnSnapshots.length - 1)] ??
        { ...selectedNode.learn.level.start, status: "ok" as const }
      : null;

  const applyPose =
    lessonPhase === "apply" && applyLevel
      ? snapshots[Math.min(cursor, snapshots.length - 1)] ??
        { ...applyLevel.start, status: "ok" as const }
      : null;

  const activeLevel =
    lessonPhase === "learn" && selectedNode
      ? selectedNode.learn.level
      : lessonPhase === "parsons" && selectedNode
        ? selectedNode.parsons.level
        : applyLevel;

  return (
    <div className="flex flex-1 flex-col" style={{ background: BASE, color: INK }}>
      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}18`, color: ACCENT }}
            >
              Code Spark · Course
            </span>
            {selectedNode ? (
              <button
                type="button"
                onClick={closeLesson}
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
                style={{ borderColor: STROKE, color: INK_MUTED }}
              >
                ← Path
              </button>
            ) : null}
          </div>

          {/* Duolingo-style concept path */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" aria-label="Concept path">
            {nodes.map((node, i) => {
              const status = nodeStatus(node);
              const isActive = selectedNode?.id === node.id;
              const review = reviewIds.has(node.id);
              return (
                <div key={node.id} className="flex items-center gap-1.5">
                  {i > 0 ? (
                    <span
                      className="h-0.5 w-4 shrink-0 rounded"
                      style={{ background: status === "locked" ? "rgba(255,255,255,0.12)" : `${ACCENT}66` }}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openNode(node)}
                    disabled={status === "locked"}
                    title={`${node.label} — ${node.trackLabel}`}
                    className="relative flex h-10 min-w-10 items-center justify-center rounded-full border text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35"
                    style={{
                      borderColor: isActive ? ACCENT : status === "mastered" ? `${ACCENT}99` : status === "locked" ? "rgba(255,255,255,0.12)" : `${ACCENT}55`,
                      background: isActive
                        ? ACCENT
                        : status === "mastered"
                          ? `${ACCENT}33`
                          : status === "locked"
                            ? "rgba(255,255,255,0.04)"
                            : `${ACCENT}14`,
                      color: isActive ? BASE : status === "locked" ? INK_MUTED : ACCENT,
                    }}
                  >
                    {status === "mastered" ? "✓" : status === "locked" ? "🔒" : node.label[0]}
                    {review ? (
                      <span
                        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                        style={{ background: CORAL }}
                      >
                        ↻
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
            {selectedNode ? `${selectedNode.trackLabel} · ${selectedNode.label}` : "Pick a concept to begin"}
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {!selectedNode || !activeLevel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm" style={{ color: INK_MUTED }}>
              Follow the path from Order → Repeat → Decide → Combine → Translate.
            </p>
            <p className="text-xs" style={{ color: INK_MUTED }}>
              Each node is a mini-lesson: watch it, reorder it, then write it yourself.
            </p>
          </div>
        ) : (
          <LessonLoop
            node={selectedNode}
            phase={lessonPhase}
            level={activeLevel}
            // learn
            learnSnapshots={learnSnapshots}
            learnCursor={learnCursor}
            learnPose={learnPose}
            // parsons
            parsonsPool={parsonsPool}
            parsonsSlots={parsonsSlots}
            parsonsResult={parsonsResult}
            addToSlots={addToSlots}
            removeFromSlots={removeFromSlots}
            runParsons={runParsons}
            startParsons={startParsons}
            startApply={startApply}
            // apply
            applyPose={applyPose}
            program={program}
            mode={mode}
            pythonSrc={pythonSrc}
            parseError={parseError}
            result={result}
            runPhase={runPhase}
            opsAllowed={opsAllowed}
            nesting={nesting}
            repeatTimes={repeatTimes}
            showPyPreview={showPyPreview}
            hintCount={hintCount}
            pushOp={pushOp}
            undo={undo}
            clearProgram={clearProgram}
            switchMode={switchMode}
            runApply={runApply}
            setPythonSrc={setPythonSrc}
            setParseError={setParseError}
            setResult={setResult}
            setRunPhase={setRunPhase}
            setMode={setMode}
            setProgram={setProgram}
            setNesting={setNesting}
            setRepeatTimes={setRepeatTimes}
            setShowPyPreview={setShowPyPreview}
            setHintCount={setHintCount}
            nextConcept={nextConcept}
            closeLesson={closeLesson}
          />
        )}
      </div>
    </div>
  );
}

function LessonLoop(props: {
  node: CurriculumNode;
  phase: CodeLessonPhase;
  level: CodeLevel;
  learnSnapshots: CodeSnapshot[];
  learnCursor: number;
  learnPose: CodeSnapshot | null;
  parsonsPool: ParsonsItem[];
  parsonsSlots: ParsonsItem[];
  parsonsResult: CodeResult | null;
  addToSlots: (i: ParsonsItem) => void;
  removeFromSlots: (i: ParsonsItem) => void;
  runParsons: () => void;
  startParsons: () => void;
  startApply: () => void;
  applyPose: CodeSnapshot | null;
  program: CodeOp[];
  mode: EditorMode;
  pythonSrc: string;
  parseError: string | null;
  result: CodeResult | null;
  runPhase: RunPhase;
  opsAllowed: Array<CodeOp["type"]>;
  nesting: null | "repeat" | "ifClear";
  repeatTimes: 2 | 3 | 4;
  showPyPreview: boolean;
  hintCount: number;
  pushOp: (op: CodeOp) => void;
  undo: () => void;
  clearProgram: () => void;
  switchMode: (m: EditorMode) => void;
  runApply: () => void;
  setPythonSrc: (s: string) => void;
  setParseError: (s: string | null) => void;
  setResult: (r: CodeResult | null) => void;
  setRunPhase: (p: RunPhase) => void;
  setMode: (m: EditorMode) => void;
  setProgram: (updater: (prev: CodeOp[]) => CodeOp[]) => void;
  setNesting: (n: null | "repeat" | "ifClear") => void;
  setRepeatTimes: (t: 2 | 3 | 4) => void;
  setShowPyPreview: (v: boolean) => void;
  setHintCount: (n: number) => void;
  nextConcept: () => void;
  closeLesson: () => void;
}) {
  const p = props;
  const { node } = p;
  const size = p.level.grid.length;

  if (p.phase === "learn") {
    const prevSnap = p.learnSnapshots[Math.max(0, p.learnCursor - 1)];
    const currSnap = p.learnSnapshots[Math.min(p.learnCursor, p.learnSnapshots.length - 1)];
    const caption = prevSnap && currSnap ? captionBetween(prevSnap, currSnap) : "";
    return (
      <>
        <div className="rounded-2xl border p-3" style={{ borderColor: STROKE, background: SURFACE }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
            Learn · {node.label}
          </p>
          <p className="mt-1 text-sm" style={{ color: INK }}>
            {node.learn.title}
          </p>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            {node.learn.explanation}
          </p>
        </div>

        <Grid level={p.level} pose={p.learnPose} />

        <div className="min-h-8 rounded-xl border px-3 py-2" style={{ borderColor: STROKE, background: SURFACE }}>
          <p className="text-sm" style={{ color: caption ? ACCENT : INK_MUTED }}>
            {caption || "Watch the bot…"}
          </p>
        </div>

        <div className="rounded-2xl border p-3" style={{ borderColor: STROKE, background: SURFACE }}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
            Why this works
          </p>
          <ul className="flex flex-col gap-1.5">
            {node.learn.narration.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: INK_MUTED }}>
                <span className="mt-0.5 text-[10px]" style={{ color: ACCENT }}>
                  {i + 1}
                </span>
                <span>{n.line}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={p.startParsons}
          className="min-h-12 flex-1 rounded-xl text-sm font-semibold transition active:scale-[0.98]"
          style={{ background: ACCENT, color: BASE }}
        >
          Got it — Practice
        </button>
      </>
    );
  }

  if (p.phase === "parsons") {
    const canRun = p.parsonsSlots.length > 0;
    return (
      <>
        <div className="rounded-2xl border p-3" style={{ borderColor: STROKE, background: SURFACE }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
            Parsons · {node.label}
          </p>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            {p.level.prompt}
          </p>
          <p className="mt-1 text-xs" style={{ color: INK_MUTED }}>
            Tap blocks to build the plan in order — then Run.
          </p>
        </div>

        <Grid level={p.level} pose={null} />

        <div className="min-h-16 rounded-2xl border p-2" style={{ borderColor: STROKE, background: SURFACE }}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
            Your order
          </p>
          <div className="flex flex-wrap gap-1.5">
            {p.parsonsSlots.length === 0 ? (
              <span className="text-xs" style={{ color: INK_MUTED }}>
                Tap blocks below to add them here, in order.
              </span>
            ) : (
              p.parsonsSlots.map((item) => (
                <button key={item.key} type="button" onClick={() => p.removeFromSlots(item)}>
                  <BlockChip op={item.op} />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="min-h-16 rounded-2xl border p-2" style={{ borderColor: STROKE, background: SURFACE }}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
            Block pool
          </p>
          <div className="flex flex-wrap gap-1.5">
            {p.parsonsPool.length === 0 ? (
              <span className="text-xs" style={{ color: INK_MUTED }}>
                All blocks placed.
              </span>
            ) : (
              p.parsonsPool.map((item) => (
                <button key={item.key} type="button" onClick={() => p.addToSlots(item)}>
                  <BlockChip op={item.op} />
                </button>
              ))
            )}
          </div>
        </div>

        {p.parsonsResult ? (
          <div
            className="rounded-xl border px-3 py-2.5"
            style={{
              borderColor: p.parsonsResult.correct ? `${ACCENT}66` : `${CORAL}66`,
              background: p.parsonsResult.correct ? `${ACCENT}14` : "rgba(251,113,133,0.1)",
            }}
          >
            <p className="text-sm" style={{ color: p.parsonsResult.correct ? ACCENT : CORAL }}>
              {p.parsonsResult.message}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={p.runParsons}
            disabled={!canRun}
            className="min-h-12 flex-1 rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
            style={{ background: ACCENT, color: BASE }}
          >
            Run
          </button>
          <button
            type="button"
            onClick={p.startApply}
            className="min-h-12 rounded-xl border px-4 text-sm font-semibold"
            style={{ borderColor: STROKE, color: INK_MUTED }}
          >
            Skip to write
          </button>
        </div>
      </>
    );
  }

  if (p.phase === "done") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-3xl" style={{ color: ACCENT }}>
          ★
        </div>
        <p className="text-base font-semibold" style={{ color: INK }}>
          {node.label} — concept complete!
        </p>
        {p.result?.correct ? (
          <p className="text-sm" style={{ color: ACCENT }} aria-label={`${p.result.stars} stars`}>
            {"★".repeat(p.result.stars)}
            <span style={{ opacity: 0.35 }}>{"☆".repeat(3 - p.result.stars)}</span>
          </p>
        ) : null}
        <p className="max-w-xs text-sm" style={{ color: INK_MUTED }}>
          {p.result?.correct ? p.result.message : "Your progress is saved to your learning memory, so the tutor and the path stay in sync."}
        </p>
        <div className="flex w-full flex-wrap gap-2">
          <button
            type="button"
            onClick={p.nextConcept}
            className="min-h-12 flex-1 rounded-xl text-sm font-semibold"
            style={{ background: ACCENT, color: BASE }}
          >
            Next concept
          </button>
          <button
            type="button"
            onClick={p.closeLesson}
            className="min-h-12 rounded-xl border px-4 text-sm font-semibold"
            style={{ borderColor: STROKE, color: INK_MUTED }}
          >
            Back to path
          </button>
        </div>
      </div>
    );
  }

  // ── apply ─────────────────────────────────────────────────────────
  const canRun =
    p.runPhase !== "running" &&
    (p.mode === "blocks" ? p.program.length > 0 : p.pythonSrc.trim().length > 0);
  const hintText = hintLadder(node, "apply", p.hintCount);

  return (
    <>
      <div className="rounded-2xl border p-3" style={{ borderColor: STROKE, background: SURFACE }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
          Apply · {p.level.title}
        </p>
        <p className="mt-1.5 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}14`, color: ACCENT }}>
          Think · {p.level.conceptFocus}
        </p>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          {p.level.prompt}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-xl border p-1" style={{ borderColor: STROKE, background: SURFACE }}>
        {(["blocks", "python"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => p.switchMode(m)}
            disabled={p.runPhase === "running"}
            className="min-h-9 flex-1 rounded-lg text-xs font-semibold transition disabled:opacity-40"
            style={{ background: p.mode === m ? ACCENT : "transparent", color: p.mode === m ? BASE : INK_MUTED }}
          >
            {m === "blocks" ? "Blocks" : "Python Bridge"}
          </button>
        ))}
      </div>

      <Grid level={p.level} pose={p.applyPose} />

      {p.mode === "blocks" ? (
        <>
          <div className="min-h-14 rounded-2xl border p-2" style={{ borderColor: STROKE, background: SURFACE }}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
              Program {p.nesting ? `· editing ${p.nesting}` : ""}
            </p>
            <div className="flex flex-col gap-1">
              {p.program.length === 0 ? (
                <span className="text-xs" style={{ color: INK_MUTED }}>
                  Empty — tap blocks below (Scratch-style)
                </span>
              ) : (
                p.program.map((op, i) => <BlockChip key={i} op={op} />)
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.opsAllowed.includes("forward") && (
              <PaletteBtn label="Forward" color={BLOCK_COLOR.forward} onClick={() => p.pushOp({ type: "forward" })} disabled={p.runPhase === "running"} />
            )}
            {p.opsAllowed.includes("left") && (
              <PaletteBtn label="Turn left" color={BLOCK_COLOR.left} onClick={() => p.pushOp({ type: "left" })} disabled={p.runPhase === "running"} />
            )}
            {p.opsAllowed.includes("right") && (
              <PaletteBtn label="Turn right" color={BLOCK_COLOR.right} onClick={() => p.pushOp({ type: "right" })} disabled={p.runPhase === "running"} />
            )}
            {p.opsAllowed.includes("repeat") && (
              <>
                <PaletteBtn
                  label={p.nesting === "repeat" ? "Done repeat" : `Repeat ×${p.repeatTimes}`}
                  color={BLOCK_COLOR.repeat}
                  onClick={() => {
                    if (p.nesting === "repeat") {
                      p.setNesting(null);
                      return;
                    }
                    p.setNesting("repeat");
                    p.setProgram((prev) => [...prev, { type: "repeat", times: p.repeatTimes, body: [] }]);
                  }}
                  disabled={p.runPhase === "running"}
                />
                {p.nesting === "repeat" ? (
                  <PaletteBtn
                    label="× cycle"
                    color={BLOCK_COLOR.repeat}
                    onClick={() => p.setRepeatTimes((t) => (t === 2 ? 3 : t === 3 ? 4 : 2))}
                    disabled={p.runPhase === "running"}
                  />
                ) : null}
              </>
            )}
            {p.opsAllowed.includes("ifClear") && (
              <PaletteBtn
                label={p.nesting === "ifClear" ? "Done if" : "If clear"}
                color={BLOCK_COLOR.ifClear}
                onClick={() => {
                  if (p.nesting === "ifClear") {
                    p.setNesting(null);
                    return;
                  }
                  p.setNesting("ifClear");
                  p.setProgram((prev) => [...prev, { type: "ifClear", body: [] }]);
                }}
                disabled={p.runPhase === "running"}
              />
            )}
          </div>

          <div className="rounded-2xl border" style={{ borderColor: STROKE, background: SURFACE }}>
            <button
              type="button"
              onClick={() => p.setShowPyPreview((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: INK_MUTED }}
              aria-expanded={p.showPyPreview}
            >
              <span>See as Python</span>
              <span aria-hidden>{p.showPyPreview ? "▾" : "▸"}</span>
            </button>
            {p.showPyPreview ? (
              <pre className="overflow-x-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed" style={{ borderColor: STROKE, color: ACCENT, background: "rgba(0,0,0,0.28)" }}>
                {p.program.length === 0 ? "# tap blocks — Python appears here" : opsToPython(p.program)}
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
            value={p.pythonSrc}
            onChange={(e) => {
              p.setPythonSrc(e.target.value);
              p.setParseError(null);
              p.setResult(null);
              p.setRunPhase("build");
            }}
            disabled={p.runPhase === "running"}
            spellCheck={false}
            rows={8}
            className="w-full resize-y rounded-2xl border p-3 font-mono text-[12px] leading-relaxed outline-none disabled:opacity-60"
            style={{ borderColor: p.parseError ? `${CORAL}88` : STROKE, background: "rgba(0,0,0,0.35)", color: INK }}
            aria-label="Python program"
          />
          {p.parseError ? (
            <p className="text-xs" style={{ color: CORAL }}>
              {p.parseError}
            </p>
          ) : (
            <p className="text-[11px]" style={{ color: INK_MUTED }}>
              move_forward · turn_left/right · for i in range(2|3|4) · if clear()
            </p>
          )}
        </div>
      )}

      {/* Hint ladder */}
      <button
        type="button"
        onClick={() => p.setHintCount(p.hintCount + 1)}
        className="flex items-center justify-between rounded-xl border px-3 py-2 text-left"
        style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}0f` }}
      >
        <span className="text-xs font-semibold" style={{ color: ACCENT }}>
          {p.hintCount === 0 ? "Need a hint?" : `Hint ${p.hintCount}`}
        </span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: INK_MUTED }}>
          {p.hintCount === 0 ? "tap" : "more"}
        </span>
      </button>
      {p.hintCount > 0 ? (
        <p className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: STROKE, color: INK_MUTED, background: SURFACE }}>
          {hintText}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={p.runApply}
          disabled={!canRun}
          className="min-h-12 flex-1 rounded-xl text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
          style={{ background: ACCENT, color: BASE }}
        >
          {p.runPhase === "running" ? "Running…" : "Run"}
        </button>
        {p.mode === "blocks" ? (
          <button
            type="button"
            onClick={p.undo}
            disabled={p.runPhase === "running" || p.program.length === 0}
            className="min-h-12 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: STROKE, color: INK_MUTED }}
          >
            Undo
          </button>
        ) : null}
        <button
          type="button"
          onClick={p.clearProgram}
          disabled={p.runPhase === "running"}
          className="min-h-12 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: STROKE, color: INK_MUTED }}
        >
          Clear
        </button>
      </div>

      {p.result && p.runPhase === "done" ? (
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{
            borderColor: p.result.correct ? `${ACCENT}66` : `${CORAL}66`,
            background: p.result.correct ? `${ACCENT}14` : "rgba(251,113,133,0.1)",
          }}
        >
          {p.result.correct && p.result.stars > 0 ? (
            <p className="mb-1 text-base tracking-wide" style={{ color: ACCENT }} aria-label={`${p.result.stars} stars`}>
              {"★".repeat(p.result.stars)}
              <span style={{ opacity: 0.35 }}>{"☆".repeat(3 - p.result.stars)}</span>
            </p>
          ) : null}
          <p className="text-sm" style={{ color: p.result.correct ? ACCENT : CORAL }}>
            {p.result.message}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!p.result.correct ? (
              <button
                type="button"
                onClick={() => {
                  p.setRunPhase("build");
                  p.setResult(null);
                }}
                className="min-h-11 flex-1 rounded-xl text-sm font-semibold"
                style={{ background: ACCENT, color: BASE }}
              >
                Edit &amp; run again
              </button>
            ) : (
              <button
                type="button"
                onClick={p.nextConcept}
                className="min-h-11 flex-1 rounded-xl text-sm font-semibold"
                style={{ background: ACCENT, color: BASE }}
              >
                Next concept
              </button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Grid({
  level,
  pose,
}: {
  level: CodeLevel;
  pose: CodeSnapshot | null;
}) {
  const size = level.grid.length;
  return (
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
          const isBot = pose?.r === r && pose?.c === c;
          const isGoal = level.goal.r === r && level.goal.c === c;
          const isStart = !pose && level.start.r === r && level.start.c === c;
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
                  style={{ color: ACCENT, transform: `rotate(${pose?.facing ?? 0 * 90}deg)` }}
                  aria-label={`Bot facing ${pose?.facing}`}
                >
                  ▲
                </span>
              ) : isStart ? (
                <span className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: ACCENT }}>
                  ▲
                </span>
              ) : null}
            </div>
          );
        }),
      )}
    </div>
  );
}

function BlockChip({ op, depth = 0 }: { op: CodeOp; depth?: number }) {
  const color = BLOCK_COLOR[op.type];
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <span className="inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold text-white" style={{ background: color }}>
        {opLabel(op)}
      </span>
      {(op.type === "repeat" || op.type === "ifClear") &&
        op.body.map((child, i) => <BlockChip key={i} op={child} depth={depth + 1} />)}
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
