/** Teaching Go on 9×9 — liberties, capture, simple ko. */

export type GoColor = 1 | 2; // 1 black 2 white
export type GoState = {
  size: number;
  board: number[]; // 0 empty
  toPlay: GoColor;
  ko: number | null;
  captured: [number, number];
  last: number | null;
  passes: number;
  over: boolean;
};

export function initialGo(size = 9): GoState {
  return {
    size,
    board: Array(size * size).fill(0),
    toPlay: 1,
    ko: null,
    captured: [0, 0],
    last: null,
    passes: 0,
    over: false,
  };
}

function neighbors(size: number, i: number): number[] {
  const x = i % size;
  const y = Math.floor(i / size);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  if (y > 0) out.push(i - size);
  if (y < size - 1) out.push(i + size);
  return out;
}

function groupAndLibs(
  board: number[],
  size: number,
  start: number,
): { stones: number[]; libs: Set<number> } {
  const color = board[start]!;
  const stones: number[] = [];
  const libs = new Set<number>();
  const seen = new Set<number>();
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    seen.add(i);
    if (board[i] !== color) continue;
    stones.push(i);
    for (const n of neighbors(size, i)) {
      if (board[n] === 0) libs.add(n);
      else if (board[n] === color && !seen.has(n)) stack.push(n);
    }
  }
  return { stones, libs };
}

export function playGo(state: GoState, at: number): GoState | null {
  if (state.over || at < 0 || at >= state.board.length) return null;
  if (state.board[at] !== 0) return null;
  if (state.ko === at) return null;
  const size = state.size;
  const board = [...state.board];
  const me = state.toPlay;
  const opp: GoColor = me === 1 ? 2 : 1;
  board[at] = me;

  let captured = 0;
  let koCandidate: number | null = null;
  for (const n of neighbors(size, at)) {
    if (board[n] !== opp) continue;
    const g = groupAndLibs(board, size, n);
    if (g.libs.size === 0) {
      for (const s of g.stones) {
        board[s] = 0;
        captured += 1;
      }
      if (g.stones.length === 1) koCandidate = g.stones[0]!;
    }
  }

  const self = groupAndLibs(board, size, at);
  if (self.libs.size === 0) return null; // suicide

  const cap = [...state.captured] as [number, number];
  if (me === 1) cap[0] += captured;
  else cap[1] += captured;

  return {
    ...state,
    board,
    toPlay: opp,
    ko: captured === 1 && self.stones.length === 1 ? koCandidate : null,
    captured: cap,
    last: at,
    passes: 0,
  };
}

export function passGo(state: GoState): GoState {
  const passes = state.passes + 1;
  return {
    ...state,
    toPlay: state.toPlay === 1 ? 2 : 1,
    ko: null,
    last: null,
    passes,
    over: passes >= 2,
  };
}
