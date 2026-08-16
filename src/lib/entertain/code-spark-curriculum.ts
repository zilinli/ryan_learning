/**
 * Code Spark curriculum — concept-first course graph (pure data + functions).
 *
 * Replaces the old random `generateLevel(band, difficulty)` maze generator with a
 * structured "one concept per node" course, aligned to mature coding-education
 * products:
 *   - Code.org     — one concept per level, block limits as scaffolding
 *   - Brilliant    — ordered concept path with a worked example per step
 *   - CodeCombat   — one syntax point per level + hints
 *   - Duolingo     — mastery-gated linear path + built-in spaced review
 *   - Parsons      — reorder shuffled blocks as a low-load bridge to writing
 *
 * Each node has a Learn worked example (with per-step narration), a Parsons
 * exercise (correct program that students reorder), and 1..3 Apply levels
 * (from-scratch writing). `prereqs` are BKT skill ids so mastery gating and the
 * in-game path strip share one source of truth with `skill-catalog.ts`.
 */

import { blankGrid, placeWalls } from "./code-spark";
import type {
  CodeBand,
  CodeCell,
  CodeConcept,
  CodeLevel,
  CodeOp,
  CodeSnapshot,
  Facing,
} from "./code-spark";

export type CodeLessonPhase = "learn" | "parsons" | "apply" | "done";

export type StepNarration = { op: CodeOp; line: string };

export type CurriculumNode = {
  id: string; // matches a cs-* skill id in skill-catalog.ts
  concept: CodeConcept;
  label: string; // Order / Repeat / Decide / Combine / Translate
  trackLabel: string; // Thinking in Code / Loops & Patterns / ...
  prereqs: string[];
  learn: {
    title: string;
    explanation: string;
    level: CodeLevel; // grid animated for the worked example
    worked: CodeOp[];
    narration: StepNarration[];
  };
  parsons: {
    level: CodeLevel;
    solution: CodeOp[]; // correct order (shuffled into a pool by the UI)
  };
  apply: CodeLevel[]; // 1..3 from-scratch levels, increasing difficulty
};

const N = 0 as Facing;
const E = 1 as Facing;
const S = 2 as Facing;
const W = 3 as Facing;

const F = (): CodeOp => ({ type: "forward" });
const L = (): CodeOp => ({ type: "left" });
const R = (): CodeOp => ({ type: "right" });
const REP = (times: 2 | 3 | 4, ...body: CodeOp[]): CodeOp => ({
  type: "repeat",
  times,
  body,
});
const IF = (...body: CodeOp[]): CodeOp => ({ type: "ifClear", body });

let levelId = 9000;

function mkLevel(
  band: CodeBand,
  difficulty: number,
  title: string,
  prompt: string,
  conceptFocus: string,
  size: number,
  walls: Array<[number, number]>,
  start: { r: number; c: number; facing: Facing },
  goal: { r: number; c: number },
  parSteps: number,
  maxSteps = 24,
): CodeLevel {
  const grid: CodeCell[][] = blankGrid(size);
  placeWalls(grid, walls);
  grid[start.r]![start.c] = "S";
  grid[goal.r]![goal.c] = "G";
  return {
    id: levelId++,
    band,
    difficulty,
    title,
    prompt,
    conceptFocus,
    grid,
    start,
    goal,
    maxSteps,
    parSteps,
  };
}

// ── cs-sequence — Order ────────────────────────────────────────────

const sequenceLearnLevel = mkLevel(
  "early",
  1,
  "Order It",
  "Watch: three steps, in order, carry the bot to the star.",
  "Sequence — the order of steps matters",
  4,
  [],
  { r: 3, c: 1, facing: N },
  { r: 0, c: 1 },
  3,
);

const sequenceParsonsLevel = mkLevel(
  "early",
  1,
  "Order It",
  "Put these blocks in the right order to reach the star.",
  "Sequence — the order of steps matters",
  4,
  [],
  { r: 3, c: 1, facing: N },
  { r: 1, c: 2 },
  4,
);

// ── cs-loop — Repeat ───────────────────────────────────────────────

const loopLearnLevel = mkLevel(
  "elementary",
  1,
  "Repeat It",
  "Watch: one Repeat block runs the same step four times.",
  "Loops — repeat without rewriting",
  5,
  [],
  { r: 4, c: 0, facing: N },
  { r: 0, c: 0 },
  4,
);

const loopParsonsLevel = mkLevel(
  "elementary",
  1,
  "Repeat It",
  "Order the Repeat block and the forward step.",
  "Loops — repeat without rewriting",
  5,
  [],
  { r: 4, c: 0, facing: N },
  { r: 4, c: 1 },
  5,
);

// ── cs-conditional — Decide ────────────────────────────────────────

const conditionalLearnLevel = mkLevel(
  "middle",
  1,
  "Decide It",
  "Watch: If clear steps only when the way ahead is open.",
  "Conditionals — decide before you move",
  5,
  [],
  { r: 4, c: 0, facing: N },
  { r: 0, c: 0 },
  4,
);

const conditionalParsonsLevel = mkLevel(
  "middle",
  1,
  "Decide It",
  "A wall blocks the way. Peek with If clear, then detour.",
  "Conditionals — decide before you move",
  5,
  [[3, 0]],
  { r: 4, c: 0, facing: N },
  { r: 0, c: 2 },
  9,
);

// ── cs-compose — Combine ───────────────────────────────────────────

const composeLearnLevel = mkLevel(
  "middle",
  1,
  "Combine It",
  "Watch: If clear peeks, then a Repeat loop carries the rest.",
  "Compose — combine If clear and Repeat",
  5,
  [[3, 0]],
  { r: 4, c: 0, facing: N },
  { r: 0, c: 2 },
  9,
);

const composeParsonsLevel = mkLevel(
  "middle",
  1,
  "Combine It",
  "Order the peek, the turn, and the Repeat loop.",
  "Compose — combine If clear and Repeat",
  5,
  [[3, 0]],
  { r: 4, c: 0, facing: N },
  { r: 0, c: 2 },
  9,
);

// ── cs-python — Translate ──────────────────────────────────────────

const pythonLearnLevel = mkLevel(
  "advanced",
  1,
  "Translate It",
  "Watch the same idea, then read it as Python.",
  "Python — translate blocks into code",
  5,
  [[3, 0]],
  { r: 4, c: 0, facing: N },
  { r: 0, c: 2 },
  9,
);

const pythonParsonsLevel = mkLevel(
  "advanced",
  1,
  "Translate It",
  "Order the blocks, then read the Python they produce.",
  "Python — translate blocks into code",
  5,
  [[3, 0]],
  { r: 4, c: 0, facing: N },
  { r: 0, c: 2 },
  9,
);

export function getCurriculum(): CurriculumNode[] {
  return [
    {
      id: "cs-sequence",
      concept: "sequence",
      label: "Order",
      trackLabel: "Thinking in Code",
      prereqs: [],
      learn: {
        title: "The order of steps matters",
        explanation:
          "A program runs one block at a time, from top to bottom. Change the order and the bot goes somewhere else — order IS the program.",
        level: sequenceLearnLevel,
        worked: [F(), F(), F()],
        narration: [
          { op: F(), line: "Step up one square — the bot faces north." },
          { op: F(), line: "Keep going straight — two steps to go." },
          { op: F(), line: "Reach the star. Three steps, top to bottom, in order." },
        ],
      },
      parsons: {
        level: sequenceParsonsLevel,
        solution: [F(), F(), R(), F()],
      },
      apply: [
        sequenceLearnLevel,
        sequenceParsonsLevel,
        mkLevel(
          "early",
          3,
          "Order It",
          "A wall blocks the straight path. Order your steps to detour around it.",
          "Sequence — the order of steps matters",
          4,
          [[2, 1], [1, 1]],
          { r: 3, c: 1, facing: N },
          { r: 0, c: 1 },
          10,
        ),
      ],
    },
    {
      id: "cs-loop",
      concept: "loop",
      label: "Repeat",
      trackLabel: "Loops & Patterns",
      prereqs: ["cs-sequence"],
      learn: {
        title: "Repeat instead of rewrite",
        explanation:
          "A loop runs the same block again and again. Write it once, run it four times — shorter and easier to read.",
        level: loopLearnLevel,
        worked: [REP(4, F())],
        narration: [
          {
            op: REP(4, F()),
            line: "Repeat forward four times — one block beats four.",
          },
        ],
      },
      parsons: {
        level: loopParsonsLevel,
        solution: [REP(2, F(), R()), F()],
      },
      apply: [
        loopLearnLevel,
        loopParsonsLevel,
        mkLevel(
          "elementary",
          3,
          "Repeat It",
          "Go up the column, turn, then go across — use a Repeat for each straight run.",
          "Loops — repeat without rewriting",
          5,
          [],
          { r: 4, c: 0, facing: N },
          { r: 0, c: 4 },
          9,
        ),
      ],
    },
    {
      id: "cs-conditional",
      concept: "conditional",
      label: "Decide",
      trackLabel: "Branching & Logic",
      prereqs: ["cs-sequence"],
      learn: {
        title: "Peek before you step",
        explanation:
          "If clear checks the square ahead first. Clear → run the block. Blocked → skip it safely, no bump.",
        level: conditionalLearnLevel,
        worked: [REP(4, IF(F()))],
        narration: [
          {
            op: REP(4, IF(F())),
            line: "If clear, step forward — peek before each move, four guarded steps.",
          },
        ],
      },
      parsons: {
        level: conditionalParsonsLevel,
        solution: [IF(F()), R(), F(), F(), L(), F(), F(), F(), F()],
      },
      apply: [
        conditionalLearnLevel,
        conditionalParsonsLevel,
        mkLevel(
          "middle",
          3,
          "Decide It",
          "A wall is straight ahead. Peek, detour right, then climb to the star.",
          "Conditionals — decide before you move",
          5,
          [[3, 0]],
          { r: 4, c: 0, facing: N },
          { r: 0, c: 4 },
          10,
        ),
      ],
    },
    {
      id: "cs-compose",
      concept: "compose",
      label: "Combine",
      trackLabel: "Loops & Patterns",
      prereqs: ["cs-loop", "cs-conditional"],
      learn: {
        title: "Put If clear and Repeat together",
        explanation:
          "Real programs compose ideas: peek with If clear, turn, then let a Repeat carry the long straight run.",
        level: composeLearnLevel,
        worked: [IF(F()), R(), F(), F(), L(), REP(4, F())],
        narration: [
          { op: IF(F()), line: "A wall is ahead — If clear peeks and skips safely." },
          { op: R(), line: "Turn right to detour around the wall." },
          { op: F(), line: "Step right." },
          { op: F(), line: "Clear the wall." },
          { op: L(), line: "Turn up toward the star." },
          { op: REP(4, F()), line: "Repeat forward four times to climb." },
        ],
      },
      parsons: {
        level: composeParsonsLevel,
        solution: [IF(F()), R(), F(), F(), L(), REP(4, F())],
      },
      apply: [
        composeLearnLevel,
        mkLevel(
          "middle",
          2,
          "Combine It",
          "Peek, detour, then Repeat the long run to the star.",
          "Compose — combine If clear and Repeat",
          5,
          [[3, 0]],
          { r: 4, c: 0, facing: N },
          { r: 0, c: 4 },
          10,
        ),
        mkLevel(
          "middle",
          3,
          "Combine It",
          "Challenge: use ONE If clear and TWO Repeat blocks.",
          "Compose — combine If clear and Repeat",
          5,
          [[3, 0]],
          { r: 4, c: 0, facing: N },
          { r: 0, c: 4 },
          10,
        ),
      ],
    },
    {
      id: "cs-python",
      concept: "python",
      label: "Translate",
      trackLabel: "Text Bridge",
      prereqs: ["cs-loop", "cs-conditional"],
      learn: {
        title: "Blocks become Python",
        explanation:
          "Every block maps to a line of Python: forward → move(), Repeat → a for loop, If clear → an if statement.",
        level: pythonLearnLevel,
        worked: [IF(F()), R(), F(), F(), L(), REP(4, F())],
        narration: [
          { op: IF(F()), line: "If clear {forward} → if can_move(): move()" },
          { op: R(), line: "right → turn_right()" },
          { op: F(), line: "forward → move()" },
          { op: F(), line: "forward → move()" },
          { op: L(), line: "left → turn_left()" },
          { op: REP(4, F()), line: "Repeat 4 forward → for _ in range(4): move()" },
        ],
      },
      parsons: {
        level: pythonParsonsLevel,
        solution: [IF(F()), R(), F(), F(), L(), REP(4, F())],
      },
      apply: [
        pythonLearnLevel,
        mkLevel(
          "advanced",
          2,
          "Translate It",
          "Solve it in blocks, then read the Python bridge.",
          "Python — translate blocks into code",
          5,
          [[3, 0]],
          { r: 4, c: 0, facing: N },
          { r: 0, c: 4 },
          10,
        ),
        mkLevel(
          "advanced",
          3,
          "Translate It",
          "Challenge: solve it, then hand-type the Python version.",
          "Python — translate blocks into code",
          5,
          [[3, 0]],
          { r: 4, c: 0, facing: N },
          { r: 0, c: 4 },
          10,
        ),
      ],
    },
  ];
}

const NODES = getCurriculum();
const BY_CONCEPT = new Map(NODES.map((n) => [n.concept, n]));
const BY_ID = new Map(NODES.map((n) => [n.id, n]));

export function nodeForConcept(c: CodeConcept): CurriculumNode {
  return BY_CONCEPT.get(c) ?? NODES[0]!;
}

export function nodeForId(id: string): CurriculumNode | undefined {
  return BY_ID.get(id);
}

/**
 * Pull the Nth Apply level for a concept (1-based difficulty) — used by both
 * the full game and the chat micro-challenge so they stay in lockstep.
 */
export function generateMicroLevel(
  concept: CodeConcept,
  difficulty: number,
): CodeLevel {
  const node = nodeForConcept(concept);
  const idx = Math.min(Math.max(Math.round(difficulty) - 1, 0), node.apply.length - 1);
  return node.apply[idx]!;
}

/** 3-tier hint ladder: L1 concept → L2 structure → L3 fall back to Parsons. */
export function hintLadder(
  node: CurriculumNode,
  phase: CodeLessonPhase,
  attempt: number,
): string {
  const n = Math.max(1, Math.floor(attempt));
  if (n <= 1) return conceptHint(node);
  if (n === 2) return structureHint(node, phase);
  return parsonsFallback(node);
}

function conceptHint(node: CurriculumNode): string {
  switch (node.concept) {
    case "sequence":
      return "Think about order: which step must come first, and which last? Trace each block one by one.";
    case "loop":
      return "Is the same move happening again and again? Bundle it into one Repeat block.";
    case "conditional":
      return "Something may be blocking the way. Peek with If clear before you step.";
    case "compose":
      return "This needs both ideas: peek with If clear, then let Repeat carry the long run.";
    default:
      return "Solve it with blocks first — then read the Python each block produces.";
  }
}

function structureHint(node: CurriculumNode, phase: CodeLessonPhase): string {
  if (phase === "parsons") {
    return `Start with the block that comes first in the story (${node.label}). Then keep the step order you'd walk yourself.`;
  }
  const first =
    node.concept === "conditional" || node.concept === "compose" || node.concept === "python"
      ? "Peek with If clear"
      : node.concept === "loop"
        ? "Use a Repeat block"
        : "Move forward first";
  const rest =
    node.concept === "loop"
      ? "then add the turn that breaks the straight line"
      : node.concept === "sequence"
        ? "then turn only when the straight line ends"
        : "then turn to detour around the wall";
  return `Outline: ${first} ${rest}. Write the outline as blocks, then run it.`;
}

function parsonsFallback(node: CurriculumNode): string {
  return `Let's switch to an easier puzzle: reorder these shuffled blocks to match the plan — ${node.label}. Tap them in order and press Run.`;
}

/** Plain-English narration for a single executed step (snapshot AFTER the op). */
export function narrateStep(op: CodeOp, snap: CodeSnapshot): string {
  if (op.type === "forward") {
    if (snap.status === "bump") return "Bump — a wall stops the bot here.";
    if (snap.status === "goal") return "The bot reaches the star.";
    return `Step to row ${snap.r + 1}, column ${snap.c + 1}.`;
  }
  if (op.type === "left") return "Turn left.";
  if (op.type === "right") return "Turn right.";
  if (op.type === "repeat") {
    return `Repeat the block ${op.times} times — write it once, run it ${op.times} times.`;
  }
  return "Peek ahead: clear → run the block, blocked → skip it safely.";
}

/**
 * A seed string that `inferSkillsFromText` latches onto a specific cs-* skill,
 * so a finished level records mastery against the right concept node.
 */
export function conceptSkillSeed(concept: CodeConcept): string {
  switch (concept) {
    case "sequence":
      return "sequence order of steps instructions coding robot path";
    case "loop":
      return "loop repeat pattern for range coding robot path";
    case "conditional":
      return "conditional if clear branch algorithmic thinking coding robot path";
    case "compose":
      return "compose combine nested loop conditional coding robot path";
    default:
      return "python text bridge syntax translate coding robot path";
  }
}
