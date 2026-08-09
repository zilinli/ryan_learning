/**
 * Minimal Xiangqi rules for two-player play (no engine).
 * Board: 9 cols × 10 rows; red at bottom (rows 7–9), black at top (0–2).
 * Piece codes: uppercase = red, lowercase = black
 * K/k general, A/a advisor, B/b elephant, N/n horse, R/r chariot,
 * C/c cannon, P/p soldier
 */

export type XPiece =
  | "K"
  | "A"
  | "B"
  | "N"
  | "R"
  | "C"
  | "P"
  | "k"
  | "a"
  | "b"
  | "n"
  | "r"
  | "c"
  | "p"
  | ".";

export type XiangqiState = {
  board: XPiece[]; // 90
  redToMove: boolean;
  selected: number | null;
  winner: "red" | "black" | null;
};

const W = 9;
const H = 10;

function i(x: number, y: number) {
  return y * W + x;
}

function xy(p: number) {
  return { x: p % W, y: Math.floor(p / W) };
}

function isRed(p: XPiece) {
  return p !== "." && p === p.toUpperCase();
}

function isBlack(p: XPiece) {
  return p !== "." && p === p.toLowerCase();
}

export function initialXiangqi(): XiangqiState {
  const empty = Array(90).fill(".") as XPiece[];
  const place = (x: number, y: number, p: XPiece) => {
    empty[i(x, y)] = p;
  };
  // black
  place(0, 0, "r");
  place(1, 0, "n");
  place(2, 0, "b");
  place(3, 0, "a");
  place(4, 0, "k");
  place(5, 0, "a");
  place(6, 0, "b");
  place(7, 0, "n");
  place(8, 0, "r");
  place(1, 2, "c");
  place(7, 2, "c");
  for (const x of [0, 2, 4, 6, 8]) place(x, 3, "p");
  // red
  for (const x of [0, 2, 4, 6, 8]) place(x, 6, "P");
  place(1, 7, "C");
  place(7, 7, "C");
  place(0, 9, "R");
  place(1, 9, "N");
  place(2, 9, "B");
  place(3, 9, "A");
  place(4, 9, "K");
  place(5, 9, "A");
  place(6, 9, "B");
  place(7, 9, "N");
  place(8, 9, "R");
  return { board: empty, redToMove: true, selected: null, winner: null };
}

function inPalace(x: number, y: number, red: boolean) {
  if (x < 3 || x > 5) return false;
  return red ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
}

function clearPath(
  board: XPiece[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let count = 0;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  let x = x0 + dx;
  let y = y0 + dy;
  while (x !== x1 || y !== y1) {
    if (board[i(x, y)] !== ".") count += 1;
    x += dx;
    y += dy;
  }
  return count;
}

export function xiangqiLegalMoves(state: XiangqiState, from: number): number[] {
  const piece = state.board[from]!;
  if (piece === ".") return [];
  const red = isRed(piece);
  if (state.redToMove !== red) return [];
  const { x, y } = xy(from);
  const out: number[] = [];
  const tryAdd = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    const t = state.board[i(tx, ty)]!;
    if (t !== "." && isRed(t) === red) return;
    out.push(i(tx, ty));
  };

  const kind = piece.toUpperCase();
  if (kind === "R") {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      let tx = x + dx;
      let ty = y + dy;
      while (tx >= 0 && ty >= 0 && tx < W && ty < H) {
        const t = state.board[i(tx, ty)]!;
        if (t === ".") out.push(i(tx, ty));
        else {
          if (isRed(t) !== red) out.push(i(tx, ty));
          break;
        }
        tx += dx;
        ty += dy;
      }
    }
  } else if (kind === "C") {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      let tx = x + dx;
      let ty = y + dy;
      let jumped = false;
      while (tx >= 0 && ty >= 0 && tx < W && ty < H) {
        const t = state.board[i(tx, ty)]!;
        if (!jumped) {
          if (t === ".") out.push(i(tx, ty));
          else jumped = true;
        } else {
          if (t !== ".") {
            if (isRed(t) !== red) out.push(i(tx, ty));
            break;
          }
        }
        tx += dx;
        ty += dy;
      }
    }
  } else if (kind === "N") {
    const hops: Array<[number, number, number, number]> = [
      [1, 2, 0, 1],
      [-1, 2, 0, 1],
      [1, -2, 0, -1],
      [-1, -2, 0, -1],
      [2, 1, 1, 0],
      [2, -1, 1, 0],
      [-2, 1, -1, 0],
      [-2, -1, -1, 0],
    ];
    for (const [dx, dy, bx, by] of hops) {
      const block = state.board[i(x + bx, y + by)];
      if (block !== ".") continue;
      tryAdd(x + dx, y + dy);
    }
  } else if (kind === "B") {
    const hops: Array<[number, number]> = [
      [2, 2],
      [2, -2],
      [-2, 2],
      [-2, -2],
    ];
    for (const [dx, dy] of hops) {
      const mx = x + dx / 2;
      const my = y + dy / 2;
      if (state.board[i(mx, my)] !== ".") continue;
      const ty = y + dy;
      if (red && ty < 5) continue;
      if (!red && ty > 4) continue;
      tryAdd(x + dx, ty);
    }
  } else if (kind === "A") {
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inPalace(tx, ty, red)) continue;
      tryAdd(tx, ty);
    }
  } else if (kind === "K") {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inPalace(tx, ty, red)) continue;
      tryAdd(tx, ty);
    }
    // flying general
    const dir = red ? -1 : 1;
    let ty = y + dir;
    while (ty >= 0 && ty < H) {
      const t = state.board[i(x, ty)]!;
      if (t !== ".") {
        if (t.toUpperCase() === "K" && isRed(t) !== red) out.push(i(x, ty));
        break;
      }
      ty += dir;
    }
  } else if (kind === "P") {
    const forward = red ? -1 : 1;
    tryAdd(x, y + forward);
    const crossed = red ? y <= 4 : y >= 5;
    if (crossed) {
      tryAdd(x + 1, y);
      tryAdd(x - 1, y);
    }
  }
  return out;
}

export function playXiangqi(
  state: XiangqiState,
  from: number,
  to: number,
): XiangqiState {
  const legal = xiangqiLegalMoves(state, from);
  if (!legal.includes(to)) return state;
  const board = [...state.board] as XPiece[];
  const moving = board[from]!;
  const captured = board[to]!;
  board[to] = moving;
  board[from] = ".";
  let winner: XiangqiState["winner"] = null;
  if (captured === "k") winner = "red";
  if (captured === "K") winner = "black";
  return {
    board,
    redToMove: !state.redToMove,
    selected: null,
    winner,
  };
}

export const XIANGQI_LABEL: Record<string, string> = {
  K: "帅",
  A: "仕",
  B: "相",
  N: "马",
  R: "车",
  C: "炮",
  P: "兵",
  k: "将",
  a: "士",
  b: "象",
  n: "马",
  r: "车",
  c: "炮",
  p: "卒",
};
