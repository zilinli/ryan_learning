/**
 * Go (围棋 / Baduk / Weiqi) game logic.
 * Board: 9×9 for simplicity (can be 13×13 or 19×19).
 * Simple ko rule.
 */

export type GoColor = "black" | "white";

export type GoCell = GoColor | null;

export type GoBoard = GoCell[][];

export interface GoPosition {
  row: number;
  col: number;
}

export interface GoState {
  board: GoBoard;
  size: number;
  turn: GoColor;
  moveHistory: GoPosition[];
  passes: number;
  capturedBlack: number;
  capturedWhite: number;
  lastCaptured: GoPosition | null; // for ko detection
  status: "playing" | "black_win" | "white_win" | "scoring";
}

export function initGo(size = 9): GoState {
  return {
    board: Array.from({ length: size }, () => Array(size).fill(null)),
    size,
    turn: "black",
    moveHistory: [],
    passes: 0,
    capturedBlack: 0,
    capturedWhite: 0,
    lastCaptured: null,
    status: "playing",
  };
}

const NEIGHBORS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function inBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

/**
 * Find the group of same-color stones connected to (r, c).
 * Returns set of positions keyed by "row,col".
 */
function findGroup(board: GoBoard, r: number, c: number): Set<string> {
  const color = board[r][c];
  if (!color) return new Set();

  const size = board.length;
  const group = new Set<string>();
  const stack: [number, number][] = [[r, c]];

  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (group.has(key)) continue;
    if (board[cr][cc] !== color) continue;
    group.add(key);

    for (const [dr, dc] of NEIGHBORS) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (inBounds(nr, nc, size) && board[nr][nc] === color) {
        stack.push([nr, nc]);
      }
    }
  }

  return group;
}

/**
 * Count liberties for the group containing (r, c).
 */
function countLiberties(board: GoBoard, group: Set<string>): number {
  const size = board.length;
  const liberties = new Set<string>();

  for (const key of group) {
    const [r, c] = key.split(",").map(Number);
    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc, size) && board[nr][nc] === null) {
        liberties.add(`${nr},${nc}`);
      }
    }
  }

  return liberties.size;
}

/**
 * Remove captured group from the board, returns count of stones removed.
 */
function removeGroup(board: GoBoard, group: Set<string>): number {
  for (const key of group) {
    const [r, c] = key.split(",").map(Number);
    board[r][c] = null;
  }
  return group.size;
}

export function placeStone(state: GoState, pos: GoPosition): GoState {
  if (state.status !== "playing") return state;
  const { row, col } = pos;

  if (state.board[row][col] !== null) return state;

  // Apply move on a copy
  const newBoard = state.board.map((r) => [...r]) as GoBoard;
  newBoard[row][col] = state.turn;

  // Check captures of opponent groups
  let captured = 0;
  let lastCapturedPos: GoPosition | null = null;

  for (const [dr, dc] of NEIGHBORS) {
    const nr = row + dr;
    const nc = col + dc;
    if (!inBounds(nr, nc, state.size)) continue;
    if (newBoard[nr][nc] === null || newBoard[nr][nc] === state.turn) continue;

    const group = findGroup(newBoard, nr, nc);
    if (countLiberties(newBoard, group) === 0) {
      captured += removeGroup(newBoard, group);
      lastCapturedPos = { row: nr, col: nc };
    }
  }

  // Check suicide (own group has no liberties after captures)
  const ownGroup = findGroup(newBoard, row, col);
  if (countLiberties(newBoard, ownGroup) === 0) {
    return state; // illegal: suicide
  }

  // Ko check: if single stone was captured and move would recreate previous position
  if (captured === 1 && state.lastCaptured &&
    state.lastCaptured.row === row && state.lastCaptured.col === col) {
    return state; // ko
  }

  const capturedBlack = state.capturedBlack + (state.turn === "white" ? captured : 0);
  const capturedWhite = state.capturedWhite + (state.turn === "black" ? captured : 0);
  const nextTurn: GoColor = state.turn === "black" ? "white" : "black";

  return {
    ...state,
    board: newBoard,
    turn: nextTurn,
    moveHistory: [...state.moveHistory, pos],
    passes: 0,
    capturedBlack,
    capturedWhite,
    lastCaptured: captured === 1 ? { row, col } : null,
  };
}

export function passTurn(state: GoState): GoState {
  if (state.status !== "playing") return state;
  const newPasses = state.passes + 1;
  if (newPasses >= 2) {
    return { ...state, passes: newPasses, status: "scoring" };
  }
  const nextTurn: GoColor = state.turn === "black" ? "white" : "black";
  return { ...state, turn: nextTurn, passes: newPasses };
}

export function resign(state: GoState): GoState {
  const winner: GoColor = state.turn === "black" ? "white" : "black";
  return {
    ...state,
    status: winner === "black" ? "black_win" : "white_win",
  };
}

export function pointLabel(r: number, c: number, size: number): string {
  const cols = "ABCDEFGHJKLMNOPQRST";
  return `${cols[c] ?? ""}${size - r}`;
}

export function boardString(state: GoState): string {
  const lines: string[] = [];
  for (let r = 0; r < state.size; r++) {
    const row: string[] = [];
    for (let c = 0; c < state.size; c++) {
      const cell = state.board[r][c];
      row.push(cell === "black" ? "●" : cell === "white" ? "○" : "┼");
    }
    lines.push(row.join(""));
  }
  return lines.join("\n");
}
