/**
 * Tetris-like engine (pure TS). Naming: "Blocks" in UI — Tetris™ is trademarked.
 * Refs: oTetris / classic SRS-lite shapes.
 */

export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Dir = "L" | "R" | "D";

export interface Piece {
  type: number; // 1..7
  shape: number[][];
  row: number;
  col: number;
}

export interface TetrisState {
  width: number;
  height: number;
  grid: Cell[][];
  active: Piece | null;
  nextType: number;
  score: number;
  lines: number;
  level: number;
  status: "playing" | "over";
  tickMs: number;
}

const SHAPES: number[][][] = [
  // I
  [[1, 1, 1, 1]],
  // O
  [
    [2, 2],
    [2, 2],
  ],
  // T
  [
    [0, 3, 0],
    [3, 3, 3],
  ],
  // S
  [
    [0, 4, 4],
    [4, 4, 0],
  ],
  // Z
  [
    [5, 5, 0],
    [0, 5, 5],
  ],
  // J
  [
    [6, 0, 0],
    [6, 6, 6],
  ],
  // L
  [
    [0, 0, 7],
    [7, 7, 7],
  ],
];

function cloneGrid(g: Cell[][]): Cell[][] {
  return g.map((r) => [...r]);
}

function randType(): number {
  return 1 + Math.floor(Math.random() * 7);
}

function spawn(type: number, width: number): Piece {
  const shape = SHAPES[type - 1].map((r) => [...r]);
  return {
    type,
    shape,
    row: 0,
    col: Math.floor((width - shape[0].length) / 2),
  };
}

function collides(grid: Cell[][], piece: Piece): boolean {
  const h = grid.length;
  const w = grid[0].length;
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const nr = piece.row + r;
      const nc = piece.col + c;
      if (nc < 0 || nc >= w || nr >= h) return true;
      if (nr >= 0 && grid[nr][nc]) return true;
    }
  }
  return false;
}

function lock(grid: Cell[][], piece: Piece): Cell[][] {
  const next = cloneGrid(grid);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const nr = piece.row + r;
      const nc = piece.col + c;
      if (nr >= 0) next[nr][nc] = piece.type as Cell;
    }
  }
  return next;
}

function clearLines(grid: Cell[][]): { grid: Cell[][]; cleared: number } {
  const w = grid[0].length;
  const kept = grid.filter((row) => row.some((c) => c === 0));
  const cleared = grid.length - kept.length;
  while (kept.length < grid.length) {
    kept.unshift(Array(w).fill(0) as Cell[]);
  }
  return { grid: kept, cleared };
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const out: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[c][rows - 1 - r] = shape[r][c];
    }
  }
  return out;
}

export function initTetris(width = 10, height = 20): TetrisState {
  const grid = Array.from({ length: height }, () => Array(width).fill(0) as Cell[]);
  const type = randType();
  const nextType = randType();
  const active = spawn(type, width);
  return {
    width,
    height,
    grid,
    active,
    nextType,
    score: 0,
    lines: 0,
    level: 1,
    status: "playing",
    tickMs: 700,
  };
}

function afterLock(state: TetrisState, locked: Cell[][]): TetrisState {
  const { grid, cleared } = clearLines(locked);
  const lines = state.lines + cleared;
  const level = 1 + Math.floor(lines / 10);
  const score =
    state.score +
    (cleared === 1 ? 100 : cleared === 2 ? 300 : cleared === 3 ? 500 : cleared === 4 ? 800 : 0) *
      level;
  const active = spawn(state.nextType, state.width);
  if (collides(grid, active)) {
    return {
      ...state,
      grid,
      active: null,
      score,
      lines,
      level,
      status: "over",
      tickMs: Math.max(120, 700 - (level - 1) * 50),
    };
  }
  return {
    ...state,
    grid,
    active,
    nextType: randType(),
    score,
    lines,
    level,
    tickMs: Math.max(120, 700 - (level - 1) * 50),
  };
}

export function movePiece(state: TetrisState, dir: Dir): TetrisState {
  if (state.status !== "playing" || !state.active) return state;
  const delta = dir === "L" ? [0, -1] : dir === "R" ? [0, 1] : [1, 0];
  const next: Piece = {
    ...state.active,
    row: state.active.row + delta[0],
    col: state.active.col + delta[1],
  };
  if (!collides(state.grid, next)) {
    return { ...state, active: next };
  }
  if (dir === "D") {
    return afterLock(state, lock(state.grid, state.active));
  }
  return state;
}

export function rotatePiece(state: TetrisState): TetrisState {
  if (state.status !== "playing" || !state.active) return state;
  const rotated: Piece = {
    ...state.active,
    shape: rotateCW(state.active.shape),
  };
  // Simple wall kicks
  for (const kick of [0, -1, 1, -2, 2]) {
    const trial = { ...rotated, col: rotated.col + kick };
    if (!collides(state.grid, trial)) {
      return { ...state, active: trial };
    }
  }
  return state;
}

export function hardDrop(state: TetrisState): TetrisState {
  if (state.status !== "playing" || !state.active) return state;
  let s = state;
  while (s.status === "playing" && s.active) {
    const next = movePiece(s, "D");
    if (next.grid !== s.grid || next.status === "over" || !next.active) return next;
    if (next.active.row === s.active.row) return next; // could not move
    s = next;
  }
  return s;
}

export function tick(state: TetrisState): TetrisState {
  return movePiece(state, "D");
}

/** Merge active piece into a display grid. */
export function displayGrid(state: TetrisState): Cell[][] {
  const g = cloneGrid(state.grid);
  const p = state.active;
  if (!p) return g;
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue;
      const nr = p.row + r;
      const nc = p.col + c;
      if (nr >= 0 && nr < state.height && nc >= 0 && nc < state.width) {
        g[nr][nc] = p.type as Cell;
      }
    }
  }
  return g;
}
