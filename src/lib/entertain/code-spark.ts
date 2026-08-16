/**
 * Code Spark — lightweight block programming levels (pure functions).
 * Mechanic: arrange tiles → run → watch the bot step. Banded by age/grade
 * (ScratchJr sequence → Scratch/Code.org loops & conditionals).
 */

export type CodeBand = "early" | "elementary" | "middle";

export type CodeOp =
  | { type: "forward" }
  | { type: "left" }
  | { type: "right" }
  | { type: "repeat"; times: 2 | 3 | 4; body: CodeOp[] }
  | { type: "ifClear"; body: CodeOp[] };

export type Facing = 0 | 1 | 2 | 3; // N E S W

export type CodeCell = "." | "#" | "G" | "S";

export type CodeLevel = {
  id: number;
  band: CodeBand;
  difficulty: number;
  prompt: string;
  grid: CodeCell[][];
  start: { r: number; c: number; facing: Facing };
  goal: { r: number; c: number };
  /** Soft cap so runaway programs stop. */
  maxSteps: number;
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
};

const DR: number[] = [-1, 0, 1, 0];
const DC: number[] = [0, 1, 0, -1];

let nextId = 1;

export function bandFromProfile(opts: {
  grade?: number;
  age?: number;
}): CodeBand {
  const grade = Number.isFinite(opts.grade) ? Number(opts.grade) : 4;
  const age = Number.isFinite(opts.age) ? Number(opts.age) : 9;
  if (grade <= 2 || age <= 7) return "early";
  if (grade >= 6 || age >= 12) return "middle";
  return "elementary";
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
  return ["forward", "left", "right", "repeat", "ifClear"];
}

function blankGrid(n: number): CodeCell[][] {
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
      // Speculatively advance so later ifClear sees expected pose
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
    // forward
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

export function validateProgram(level: CodeLevel, program: CodeOp[]): CodeResult {
  const run = runProgram(level, program);
  if (run.success) {
    return {
      correct: true,
      outcome: "correct",
      message: "Goal! The bot followed your program.",
      run,
    };
  }
  if (run.reason === "bump") {
    return {
      correct: false,
      outcome: "incorrect",
      message: "Bump — wall ahead. Turn or use If clear, then try again.",
      run,
    };
  }
  if (run.reason === "fuel") {
    return {
      correct: false,
      outcome: "practice",
      message: "Out of steps — shorten the program or fix a loop.",
      run,
    };
  }
  return {
    correct: false,
    outcome: "incorrect",
    message: "Stopped short of the star. Add moves or fix the path.",
    run,
  };
}

function placeWalls(
  grid: CodeCell[][],
  walls: Array<[number, number]>,
): void {
  for (const [r, c] of walls) {
    if (inBounds(grid, r, c) && grid[r]![c] === ".") grid[r]![c] = "#";
  }
}

/**
 * Deterministic-ish levels per band × difficulty. Entertainment-first paths
 * that teach sequence / loop / conditional without free typing.
 */
export function generateLevel(band: CodeBand, difficulty: number): CodeLevel {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  const size = band === "early" ? 4 : band === "elementary" ? 5 : 6;
  const grid = blankGrid(size);
  const maxSteps = 40 + d * 8;

  if (band === "early") {
    // Straight-ish corridor: S at bottom, G at top, optional side wall.
    const start = { r: size - 1, c: 1, facing: 0 as Facing };
    const goal = { r: 0, c: 1 };
    if (d >= 2) placeWalls(grid, [[2, 0], [2, 2]]);
    if (d >= 4) placeWalls(grid, [[1, 2], [1, 3]]);
    grid[start.r]![start.c] = "S";
    grid[goal.r]![goal.c] = "G";
    return {
      id: nextId++,
      band,
      difficulty: d,
      prompt: "Tap tiles, then Run — guide the bot to the star.",
      grid,
      start,
      goal,
      maxSteps,
    };
  }

  if (band === "elementary") {
    // L-shaped path that rewards a short repeat of forwards.
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
      prompt: "Use Repeat to walk farther with fewer tiles.",
      grid,
      start,
      goal,
      maxSteps,
    };
  }

  // middle — fork with a wall that ifClear should skip
  const start = { r: size - 1, c: 2, facing: 0 as Facing };
  const goal = { r: 0, c: 2 };
  placeWalls(grid, [
    [3, 1],
    [3, 3],
    [2, 2], // wall directly ahead mid-path — need turn or ifClear detour
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
    prompt: "Wall ahead? Try If clear, or turn around it.",
    grid,
    start,
    goal,
    maxSteps,
  };
}

export function codeSparkSkillSeed(level: CodeLevel): string {
  const bandBits =
    level.band === "early"
      ? "sequence order steps cause effect"
      : level.band === "elementary"
        ? "loop repeat pattern algorithm"
        : "conditional if clear branch algorithm debugging";
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
