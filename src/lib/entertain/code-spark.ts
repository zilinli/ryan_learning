/**
 * Code Spark — lightweight block / Python programming levels (pure functions).
 * Mechanic: arrange tiles or write a tiny Python DSL → run → watch the bot step.
 * Inspired by Code.org / Scratch (blocks-first), CodeCombat (typed bridge),
 * Brilliant (plain-English concepts + intelligent coach feedback).
 */

export type CodeBand = "early" | "elementary" | "middle" | "advanced";

/**
 * Conversational coding concept — the ONE idea a micro-challenge targets.
 * Mirrors Brilliant's "one concept per interactive lesson" and Code.org's
 * "one block per level" ramp, but keyed to what the student actually asked
 * about (not their age band) so the practice stays on-topic.
 */
export type CodeConcept =
  | "sequence"
  | "loop"
  | "conditional"
  | "compose"
  | "python";

export type CodeOp =
  | { type: "forward" }
  | { type: "left" }
  | { type: "right" }
  | { type: "repeat"; times: 2 | 3 | 4; body: CodeOp[] }
  | { type: "ifClear"; body: CodeOp[] };

export type Facing = 0 | 1 | 2 | 3; // N E S W

export type CodeCell = "." | "#" | "G" | "S";

export type CodeTrack =
  | "foundations"
  | "loops"
  | "branching"
  | "text-bridge";

export type CodeLevel = {
  id: number;
  band: CodeBand;
  difficulty: number;
  /** RPG-style mission title (CodeCombat / Swift Playgrounds vibe). */
  title: string;
  prompt: string;
  /** Brilliant-style plain-English concept for this band (one idea per mission). */
  conceptFocus: string;
  grid: CodeCell[][];
  start: { r: number; c: number; facing: Facing };
  goal: { r: number; c: number };
  /** Soft cap so runaway programs stop. */
  maxSteps: number;
  /** Rough optimal step count for star rating (expanded forwards+turns). */
  parSteps: number;
};

export type CodeSnapshot = {
  r: number;
  c: number;
  facing: Facing;
  status: "ok" | "bump" | "goal" | "fuel";
};

export type CodeRun = {
  snapshots: CodeSnapshot[];
  success: boolean;
  reason: "goal" | "bump" | "fuel" | "stuck";
};

export type CodeResult = {
  correct: boolean;
  outcome: "correct" | "incorrect" | "practice";
  message: string;
  run: CodeRun;
  stars: 0 | 1 | 2 | 3;
};

export type PythonParseOk = { ok: true; program: CodeOp[] };
export type PythonParseErr = { ok: false; error: string; line?: number };
export type PythonParseResult = PythonParseOk | PythonParseErr;

const DR: number[] = [-1, 0, 1, 0];
const DC: number[] = [0, 1, 0, -1];

let nextId = 1;

const MISSIONS: Record<CodeBand, string[]> = {
  early: [
    "Star Beacon",
    "Glow Trail",
    "Tiny Scout",
    "Crystal Path",
  ],
  elementary: [
    "Loop Bridge",
    "Echo Canyon",
    "Repeat Relay",
    "Pattern Gate",
  ],
  middle: [
    "Forked Ruins",
    "Clear-Sight Pass",
    "Branch Temple",
    "If-Wall Keep",
  ],
  advanced: [
    "Bridge Quest",
    "Syntax Spire",
    "Indent Dungeon",
    "CodeCombat Arena",
  ],
};

export function bandFromProfile(opts: {
  grade?: number;
  age?: number;
}): CodeBand {
  const grade = Number.isFinite(opts.grade) ? Number(opts.grade) : 4;
  const age = Number.isFinite(opts.age) ? Number(opts.age) : 9;
  if (grade <= 2 || age <= 7) return "early";
  if (grade >= 8 || age >= 14) return "advanced";
  if (grade >= 6 || age >= 12) return "middle";
  return "elementary";
}

export function trackFromBand(band: CodeBand): CodeTrack {
  if (band === "early") return "foundations";
  if (band === "elementary") return "loops";
  if (band === "middle") return "branching";
  return "text-bridge";
}

/** Map free text (the student's own words) to the concept it's really about. */
export function conceptFromText(text: string): CodeConcept {
  const t = String(text || "").toLowerCase();
  if (/(for|while)\b|loop|repeat|循环|重复|迭代|loop/i.test(t)) return "loop";
  if (/\bif\b|conditional|branch|condition|条件|判断|分支|如果/i.test(t)) {
    return "conditional";
  }
  return "sequence";
}

/** Band that best hosts a micro-challenge for a given concept. */
export function bandForConcept(concept: CodeConcept): CodeBand {
  if (concept === "loop") return "elementary";
  if (concept === "conditional") return "middle";
  if (concept === "compose") return "middle";
  if (concept === "python") return "advanced";
  return "early";
}

export function trackLabel(track: CodeTrack): string {
  // Brilliant path metaphor: Thinking in Code → … → Algorithmic Thinking → Python
  if (track === "foundations") return "Thinking in Code";
  if (track === "loops") return "Loops & Patterns";
  if (track === "branching") return "Algorithmic Thinking";
  return "Python Bridge";
}

export function conceptFocusForBand(band: CodeBand): string {
  if (band === "early") return "Sequence — the order of steps matters";
  if (band === "elementary") return "Loops — repeat without rewriting";
  if (band === "middle") return "Conditionals — decide before you move";
  return "Translate — same idea in typed Python";
}

export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.3) return 1;
  if (pKnown < 0.5) return 2;
  if (pKnown < 0.7) return 3;
  if (pKnown < 0.85) return 4;
  return 5;
}

export function availableOps(band: CodeBand): Array<CodeOp["type"]> {
  if (band === "early") return ["forward", "left", "right"];
  if (band === "elementary") return ["forward", "left", "right", "repeat"];
  // middle + advanced: full set
  return ["forward", "left", "right", "repeat", "ifClear"];
}

/** Blocks-first hard rule — age/band never auto-opens Python. */
export function defaultEditorMode(_band?: CodeBand): "blocks" | "python" {
  return "blocks";
}

export function blankGrid(n: number): CodeCell[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => "." as CodeCell));
}

function inBounds(grid: CodeCell[][], r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < grid.length && c < (grid[0]?.length ?? 0);
}

function isBlocked(grid: CodeCell[][], r: number, c: number): boolean {
  if (!inBounds(grid, r, c)) return true;
  return grid[r]![c] === "#";
}

/**
 * Expand with live ifClear checks — mutates a working copy of state while
 * expanding so nested ifClear sees the position after prior moves.
 */
function planSteps(
  ops: CodeOp[],
  grid: CodeCell[][],
  start: { r: number; c: number; facing: Facing },
): CodeOp[] {
  const state = { ...start };
  const out: CodeOp[] = [];

  const walk = (list: CodeOp[]) => {
    for (const op of list) {
      if (op.type === "repeat") {
        for (let i = 0; i < op.times; i++) walk(op.body);
        continue;
      }
      if (op.type === "ifClear") {
        const nr = state.r + DR[state.facing]!;
        const nc = state.c + DC[state.facing]!;
        if (!isBlocked(grid, nr, nc)) walk(op.body);
        continue;
      }
      out.push(op);
      if (op.type === "left") {
        state.facing = ((state.facing + 3) % 4) as Facing;
      } else if (op.type === "right") {
        state.facing = ((state.facing + 1) % 4) as Facing;
      } else if (op.type === "forward") {
        const nr = state.r + DR[state.facing]!;
        const nc = state.c + DC[state.facing]!;
        if (!isBlocked(grid, nr, nc)) {
          state.r = nr;
          state.c = nc;
        }
      }
    }
  };

  walk(ops);
  return out;
}

export function runProgram(level: CodeLevel, program: CodeOp[]): CodeRun {
  const steps = planSteps(program, level.grid, level.start);
  let r = level.start.r;
  let c = level.start.c;
  let facing = level.start.facing;
  const snapshots: CodeSnapshot[] = [{ r, c, facing, status: "ok" }];

  for (let i = 0; i < steps.length; i++) {
    if (snapshots.length > level.maxSteps) {
      snapshots.push({ r, c, facing, status: "fuel" });
      return { snapshots, success: false, reason: "fuel" };
    }
    const op = steps[i]!;
    if (op.type === "left") {
      facing = ((facing + 3) % 4) as Facing;
      snapshots.push({ r, c, facing, status: "ok" });
      continue;
    }
    if (op.type === "right") {
      facing = ((facing + 1) % 4) as Facing;
      snapshots.push({ r, c, facing, status: "ok" });
      continue;
    }
    const nr = r + DR[facing]!;
    const nc = c + DC[facing]!;
    if (isBlocked(level.grid, nr, nc)) {
      snapshots.push({ r, c, facing, status: "bump" });
      return { snapshots, success: false, reason: "bump" };
    }
    r = nr;
    c = nc;
    if (r === level.goal.r && c === level.goal.c) {
      snapshots.push({ r, c, facing, status: "goal" });
      return { snapshots, success: true, reason: "goal" };
    }
    snapshots.push({ r, c, facing, status: "ok" });
  }

  if (r === level.goal.r && c === level.goal.c) {
    return { snapshots, success: true, reason: "goal" };
  }
  return { snapshots, success: false, reason: "stuck" };
}

/** 1–3 stars from expanded step count vs par (only when goal reached). */
export function rateStars(level: CodeLevel, run: CodeRun): 0 | 1 | 2 | 3 {
  if (!run.success) return 0;
  // snapshots include start pose; moves ≈ length - 1
  const used = Math.max(0, run.snapshots.length - 1);
  const par = Math.max(1, level.parSteps);
  if (used <= par) return 3;
  if (used <= par + 3) return 2;
  return 1;
}

/**
 * Brilliant-style coach: plain-English concept feedback, not raw syntax errors.
 */
export function coachFeedback(
  level: CodeLevel,
  run: CodeRun,
  _program?: CodeOp[],
): string {
  const concept = level.conceptFocus;
  const stars = rateStars(level, run);
  if (run.success) {
    if (stars === 3) {
      return `Goal! Clean path — you nailed “${concept}.” 3 stars!`;
    }
    if (stars === 2) {
      return `Goal! Solid thinking on “${concept}.” 2 stars — can you tighten the path?`;
    }
    return `Goal! You got there. 1 star — rethink “${concept}” with fewer steps.`;
  }
  if (run.reason === "bump") {
    const ops = availableOps(level.band);
    if (ops.includes("ifClear")) {
      return `Wall ahead — programmers peek first. Use If clear / if clear():, or turn. (${concept})`;
    }
    return `Bump — a wall stopped you. Plan the sequence: turn, then step. (${concept})`;
  }
  if (run.reason === "fuel") {
    return `Out of steps — a loop may be runaway. Shorten or fix Repeat / for-range. (${concept})`;
  }
  return `Stopped short of the star. Add the missing moves — think the path in plain words first. (${concept})`;
}

export function validateProgram(level: CodeLevel, program: CodeOp[]): CodeResult {
  const run = runProgram(level, program);
  const stars = rateStars(level, run);
  const message = coachFeedback(level, run, program);
  if (run.success) {
    return {
      correct: true,
      outcome: "correct",
      message,
      run,
      stars,
    };
  }
  if (run.reason === "fuel") {
    return {
      correct: false,
      outcome: "practice",
      message,
      run,
      stars: 0,
    };
  }
  return {
    correct: false,
    outcome: "incorrect",
    message,
    run,
    stars: 0,
  };
}

export function placeWalls(
  grid: CodeCell[][],
  walls: Array<[number, number]>,
): void {
  for (const [r, c] of walls) {
    if (inBounds(grid, r, c) && grid[r]![c] === ".") grid[r]![c] = "#";
  }
}

function pickTitle(band: CodeBand, difficulty: number): string {
  const list = MISSIONS[band];
  return list[(difficulty - 1) % list.length]!;
}

/**
 * Deterministic-ish levels per band × difficulty. Entertainment-first paths
 * that teach sequence / loop / conditional — plus Python for advanced.
 */
export function generateLevel(band: CodeBand, difficulty: number): CodeLevel {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  const size =
    band === "early" ? 4 : band === "elementary" ? 5 : 6;
  const grid = blankGrid(size);
  const maxSteps = 40 + d * 8;
  const title = pickTitle(band, d);

  if (band === "early") {
    const start = { r: size - 1, c: 1, facing: 0 as Facing };
    const goal = { r: 0, c: 1 };
    if (d >= 2) placeWalls(grid, [[2, 0], [2, 2]]);
    if (d >= 4) placeWalls(grid, [[1, 2], [1, 3]]);
    grid[start.r]![start.c] = "S";
    grid[goal.r]![goal.c] = "G";
    const parSteps = start.r - goal.r;
    return {
      id: nextId++,
      band,
      difficulty: d,
      title,
      prompt:
        "Think first: which steps, in what order, reach the star? Then tap blocks and Run.",
      conceptFocus: conceptFocusForBand(band),
      grid,
      start,
      goal,
      maxSteps,
      parSteps,
    };
  }

  if (band === "elementary") {
    const start = { r: size - 1, c: 0, facing: 0 as Facing };
    const goal = { r: 0, c: size - 1 };
    placeWalls(grid, [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [1, 3],
    ]);
    if (d >= 3) placeWalls(grid, [[3, 3], [2, 3]]);
    if (d >= 5) placeWalls(grid, [[4, 2]]);
    grid[start.r]![start.c] = "S";
    grid[goal.r]![goal.c] = "G";
    return {
      id: nextId++,
      band,
      difficulty: d,
      title,
      prompt:
        "Spot the repeating pattern — use Repeat (or for i in range) so you don’t rewrite every step.",
      conceptFocus: conceptFocusForBand(band),
      grid,
      start,
      goal,
      maxSteps,
      parSteps: 10,
    };
  }

  // middle + advanced — same map; advanced nudges typed Python
  const start = { r: size - 1, c: 2, facing: 0 as Facing };
  const goal = { r: 0, c: 2 };
  placeWalls(grid, [
    [3, 1],
    [3, 3],
    [2, 2],
    [1, 1],
    [1, 3],
  ]);
  if (d >= 3) placeWalls(grid, [[4, 0], [4, 4]]);
  if (d >= 5) placeWalls(grid, [[0, 0], [0, 4], [5, 1], [5, 3]]);
  grid[start.r]![start.c] = "S";
  grid[goal.r]![goal.c] = "G";
  return {
    id: nextId++,
    band,
    difficulty: d,
    title,
    prompt:
      band === "advanced"
        ? "Solve with blocks first — open Python Bridge when you want the same idea in typed words."
        : "Wall ahead? Decide before you step: If clear, or turn around it.",
    conceptFocus: conceptFocusForBand(band),
    grid,
    start,
    goal,
    maxSteps,
    parSteps: 12,
  };
}

/**
 * Micro-challenges now come from the concept curriculum
 * (`code-spark-curriculum.ts` → `generateMicroLevel`), so the chat card and
 * the full game stay on the same course and the same mastery path.
 */

/** Minimal, coach-facing record of a finished micro-challenge. */
export type CodingResultNote = {
  concept: CodeConcept;
  outcome: CodeResult["outcome"];
  stars: CodeResult["stars"];
  steps: number;
  mode: "blocks" | "python";
  levelTitle: string;
};

/** One-line prompt note injected into the next turn's coach note. */
export function codingResultPromptNote(note: CodingResultNote): string {
  const conceptLabel =
    note.concept === "loop"
      ? "loops"
      : note.concept === "conditional"
        ? "conditionals"
        : note.concept === "compose"
          ? "combining loops + conditionals"
          : note.concept === "python"
            ? "translating blocks to Python"
            : "sequence/order";
  return (
    `The student just ran a Code Spark micro-challenge on ${conceptLabel} ` +
    `("${note.levelTitle}", ${note.mode}): outcome=${note.outcome}, stars=${note.stars}, ` +
    `steps=${note.steps}. Keep coaching THIS idea in plain words — praise the concept ` +
    `if correct, or guide the fix (peek/turn/repeat) if not. Do not open a new topic.`
  );
}

export function codeSparkSkillSeed(level: CodeLevel): string {
  const bandBits =
    level.band === "early"
      ? "sequence order steps cause effect"
      : level.band === "elementary"
        ? "loop repeat pattern algorithm"
        : level.band === "middle"
          ? "conditional if clear branch algorithm debugging"
          : "python bridge for range if clear typed code algorithm debugging";
  return `coding programming blocks robot path ${bandBits} computational thinking`;
}

export function opLabel(op: CodeOp): string {
  if (op.type === "forward") return "Forward";
  if (op.type === "left") return "Turn left";
  if (op.type === "right") return "Turn right";
  if (op.type === "repeat") return `Repeat ×${op.times}`;
  return "If clear";
}

export function countOps(ops: CodeOp[]): number {
  let n = 0;
  for (const op of ops) {
    n += 1;
    if (op.type === "repeat" || op.type === "ifClear") n += countOps(op.body);
  }
  return n;
}

/** Emit Python DSL from ops (learning bridge Blocks → text). */
export function opsToPython(ops: CodeOp[], indent = 0): string {
  const pad = "    ".repeat(indent);
  const lines: string[] = [];
  for (const op of ops) {
    if (op.type === "forward") lines.push(`${pad}move_forward()`);
    else if (op.type === "left") lines.push(`${pad}turn_left()`);
    else if (op.type === "right") lines.push(`${pad}turn_right()`);
    else if (op.type === "repeat") {
      lines.push(`${pad}for i in range(${op.times}):`);
      lines.push(
        op.body.length === 0
          ? `${pad}    pass`
          : opsToPython(op.body, indent + 1),
      );
    } else {
      lines.push(`${pad}if clear():`);
      lines.push(
        op.body.length === 0
          ? `${pad}    pass`
          : opsToPython(op.body, indent + 1),
      );
    }
  }
  return lines.join("\n");
}

export function pythonStarter(band: CodeBand): string {
  if (band === "early") {
    return "# Guide the bot\nmove_forward()\n";
  }
  if (band === "elementary") {
    return "# Try a loop\nfor i in range(3):\n    move_forward()\n";
  }
  if (band === "middle") {
    return (
      "# Peek ahead before stepping\nif clear():\n    move_forward()\nturn_left()\n"
    );
  }
  return (
    "# Python Bridge — same ideas as blocks\n" +
    "for i in range(2):\n" +
    "    move_forward()\n" +
    "turn_left()\n" +
    "if clear():\n" +
    "    move_forward()\n"
  );
}

/**
 * Restricted Python DSL → CodeOp[]. No eval / imports.
 * Supports: move_forward|forward, turn_left|left, turn_right|right,
 * for i in range(2|3|4):, if clear(): — bodies by indentation (4 spaces or 1 tab).
 * `else:` after if clear is accepted but ignored (body skipped when blocked).
 */
export function parsePythonProgram(source: string): PythonParseResult {
  const rawLines = source.replace(/\r\n/g, "\n").split("\n");
  type Frame = { indent: number; ops: CodeOp[]; kind: "root" | "repeat" | "ifClear" };
  const root: CodeOp[] = [];
  const stack: Frame[] = [{ indent: 0, ops: root, kind: "root" }];

  const callRe =
    /^(move_forward|forward|turn_left|left|turn_right|right)\s*\(\s*\)\s*(#.*)?$/;
  const forRe = /^for\s+\w+\s+in\s+range\s*\(\s*([234])\s*\)\s*:\s*(#.*)?$/;
  const ifRe = /^if\s+clear\s*\(\s*\)\s*:\s*(#.*)?$/;
  const elseRe = /^else\s*:\s*(#.*)?$/;
  const passRe = /^pass\s*(#.*)?$/;

  for (let li = 0; li < rawLines.length; li++) {
    const lineNo = li + 1;
    const raw = rawLines[li]!;
    if (/^\s*$/.test(raw) || /^\s*#/.test(raw)) continue;

    const indentMatch = raw.match(/^(\s*)/);
    const ws = indentMatch?.[1] ?? "";
    if (ws.includes(" ") && ws.includes("\t")) {
      return { ok: false, error: "Mix of spaces and tabs", line: lineNo };
    }
    const indent = ws.includes("\t") ? ws.length * 4 : ws.length;
    if (indent % 4 !== 0) {
      return {
        ok: false,
        error: "Indent must be multiples of 4 spaces",
        line: lineNo,
      };
    }
    const code = raw.slice(ws.length).trimEnd();

    while (stack.length > 1 && indent < stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const frame = stack[stack.length - 1]!;
    if (indent > frame.indent) {
      return {
        ok: false,
        error: "Unexpected indent — open a for / if clear first",
        line: lineNo,
      };
    }
    if (indent < frame.indent) {
      return { ok: false, error: "Indent mismatch", line: lineNo };
    }

    // else: optional narrative branch — body is ignored (ifClear already skips when blocked)
    if (elseRe.test(code)) {
      const parent = stack[stack.length - 1]!;
      const last = parent.ops[parent.ops.length - 1];
      if (!last || last.type !== "ifClear") {
        return { ok: false, error: "else: without if clear():", line: lineNo };
      }
      const sink: CodeOp[] = [];
      stack.push({ indent: indent + 4, ops: sink, kind: "repeat" });
      continue;
    }

    if (passRe.test(code)) continue;

    const forM = code.match(forRe);
    if (forM) {
      const times = Number(forM[1]) as 2 | 3 | 4;
      const op: CodeOp = { type: "repeat", times, body: [] };
      frame.ops.push(op);
      stack.push({ indent: indent + 4, ops: op.body, kind: "repeat" });
      continue;
    }

    if (ifRe.test(code)) {
      const op: CodeOp = { type: "ifClear", body: [] };
      frame.ops.push(op);
      stack.push({ indent: indent + 4, ops: op.body, kind: "ifClear" });
      continue;
    }

    const callM = code.match(callRe);
    if (callM) {
      const name = callM[1]!;
      if (name === "move_forward" || name === "forward") {
        frame.ops.push({ type: "forward" });
      } else if (name === "turn_left" || name === "left") {
        frame.ops.push({ type: "left" });
      } else if (name === "turn_right" || name === "right") {
        frame.ops.push({ type: "right" });
      }
      continue;
    }

    return {
      ok: false,
      error: `Unknown statement: ${code.slice(0, 40)}`,
      line: lineNo,
    };
  }

  return { ok: true, program: root };
}
