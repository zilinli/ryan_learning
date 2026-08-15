/** Classic Klotski (华容道) — Cao Cao escapes at bottom centre. */

export type KBlock = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "cao" | "v" | "h" | "s";
};

export type KlotskiState = {
  blocks: KBlock[];
  selected: string | null;
  moves: number;
  history: KBlock[][];
};

/** Standard layout on 4×5 board; exit is y=3..4 at x=1..2 bottom (escape when cao.y===3 && cao.x===1). */
export function initialKlotski(): KlotskiState {
  const blocks: KBlock[] = [
    { id: "cao", x: 1, y: 0, w: 2, h: 2, kind: "cao" },
    { id: "g1", x: 0, y: 0, w: 1, h: 2, kind: "v" },
    { id: "g2", x: 3, y: 0, w: 1, h: 2, kind: "v" },
    { id: "g3", x: 0, y: 2, w: 1, h: 2, kind: "v" },
    { id: "g4", x: 3, y: 2, w: 1, h: 2, kind: "v" },
    { id: "h1", x: 1, y: 2, w: 2, h: 1, kind: "h" },
    { id: "s1", x: 1, y: 3, w: 1, h: 1, kind: "s" },
    { id: "s2", x: 2, y: 3, w: 1, h: 1, kind: "s" },
    { id: "s3", x: 1, y: 4, w: 1, h: 1, kind: "s" },
    { id: "s4", x: 2, y: 4, w: 1, h: 1, kind: "s" },
  ];
  return { blocks, selected: null, moves: 0, history: [] };
}

function occupied(blocks: KBlock[]): boolean[] {
  const cells = Array(20).fill(false) as boolean[];
  for (const b of blocks) {
    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const x = b.x + dx;
        const y = b.y + dy;
        if (x < 0 || y < 0 || x >= 4 || y >= 5) continue;
        cells[y * 4 + x] = true;
      }
    }
  }
  return cells;
}

export function moveKlotski(
  state: KlotskiState,
  id: string,
  dx: number,
  dy: number,
): KlotskiState {
  const block = state.blocks.find((b) => b.id === id);
  if (!block) return state;
  const nx = block.x + dx;
  const ny = block.y + dy;
  if (nx < 0 || ny < 0 || nx + block.w > 4 || ny + block.h > 5) return state;
  const others = state.blocks.filter((b) => b.id !== id);
  const occ = occupied(others);
  for (let oy = 0; oy < block.h; oy++) {
    for (let ox = 0; ox < block.w; ox++) {
      if (occ[(ny + oy) * 4 + (nx + ox)]) return state;
    }
  }
  const blocks = state.blocks.map((b) =>
    b.id === id ? { ...b, x: nx, y: ny } : b,
  );
  return {
    blocks,
    selected: id,
    moves: state.moves + 1,
    history: [...state.history, state.blocks],
  };
}

export function undoKlotski(state: KlotskiState): KlotskiState {
  if (!state.history.length) return state;
  const prev = state.history[state.history.length - 1]!;
  return {
    ...state,
    blocks: prev,
    moves: Math.max(0, state.moves - 1),
    history: state.history.slice(0, -1),
  };
}

export function isKlotskiWon(state: KlotskiState): boolean {
  const cao = state.blocks.find((b) => b.id === "cao");
  return !!cao && cao.x === 1 && cao.y === 3;
}
