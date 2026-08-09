/**
 * Klotski (华容道) puzzle logic.
 * Standard 4×5 grid with 10 pieces:
 * - 1×2 horizontal, 2×1 vertical, 1×1 small, 2×2 large (Cao Cao)
 * Goal: move the 2×2 block to the bottom-center exit.
 */

export interface KlotskiPiece {
  id: string;
  label: string;
  /** width in columns */
  w: number;
  /** height in rows */
  h: number;
  row: number;
  col: number;
}

export interface KlotskiState {
  pieces: KlotskiPiece[];
  moveCount: number;
  history: KlotskiPiece[][];
  solved: boolean;
}

/** Standard "横刀立马" layout */
const LAYOUT_HENG_DAO_LI_MA: KlotskiPiece[] = [
  { id: "caocao", label: "曹操", w: 2, h: 2, row: 0, col: 1 },
  { id: "guanyu", label: "关羽", w: 2, h: 1, row: 2, col: 1 },
  { id: "zhangfei", label: "张飞", w: 1, h: 2, row: 0, col: 0 },
  { id: "zhaoyun", label: "赵云", w: 1, h: 2, row: 0, col: 3 },
  { id: "machao", label: "马超", w: 1, h: 2, row: 2, col: 0 },
  { id: "huangzhong", label: "黄忠", w: 2, h: 1, row: 2, col: 3 },
  { id: "s1", label: "兵", w: 1, h: 1, row: 3, col: 1 },
  { id: "s2", label: "兵", w: 1, h: 1, row: 3, col: 2 },
  { id: "s3", label: "兵", w: 1, h: 1, row: 4, col: 0 },
  { id: "s4", label: "兵", w: 1, h: 1, row: 4, col: 3 },
];

export const LAYOUTS: { name: string; nameZh: string; pieces: KlotskiPiece[] }[] = [
  { name: "Heng Dao Li Ma", nameZh: "横刀立马", pieces: LAYOUT_HENG_DAO_LI_MA },
  {
    name: "Command Pass", nameZh: "指挥若定",
    pieces: [
      { id: "caocao", label: "曹操", w: 2, h: 2, row: 0, col: 1 },
      { id: "guanyu", label: "关羽", w: 2, h: 1, row: 0, col: 3 },
      { id: "zhangfei", label: "张飞", w: 1, h: 2, row: 2, col: 0 },
      { id: "zhaoyun", label: "赵云", w: 1, h: 2, row: 2, col: 3 },
      { id: "machao", label: "马超", w: 1, h: 2, row: 0, col: 0 },
      { id: "huangzhong", label: "黄忠", w: 2, h: 1, row: 3, col: 1 },
      { id: "s1", label: "兵", w: 1, h: 1, row: 3, col: 3 },
      { id: "s2", label: "兵", w: 1, h: 1, row: 4, col: 0 },
      { id: "s3", label: "兵", w: 1, h: 1, row: 4, col: 2 },
      { id: "s4", label: "兵", w: 1, h: 1, row: 2, col: 1 },
    ],
  },
  {
    name: "Troops Ambush", nameZh: "兵分三路",
    pieces: [
      { id: "caocao", label: "曹操", w: 2, h: 2, row: 0, col: 1 },
      { id: "guanyu", label: "关羽", w: 2, h: 1, row: 2, col: 0 },
      { id: "zhangfei", label: "张飞", w: 1, h: 2, row: 0, col: 0 },
      { id: "zhaoyun", label: "赵云", w: 1, h: 2, row: 2, col: 2 },
      { id: "machao", label: "马超", w: 1, h: 2, row: 2, col: 3 },
      { id: "huangzhong", label: "黄忠", w: 1, h: 2, row: 0, col: 3 },
      { id: "s1", label: "兵", w: 1, h: 1, row: 3, col: 0 },
      { id: "s2", label: "兵", w: 1, h: 1, row: 3, col: 3 },
      { id: "s3", label: "兵", w: 1, h: 1, row: 4, col: 1 },
      { id: "s4", label: "兵", w: 1, h: 1, row: 4, col: 2 },
    ],
  },
];

const BOARD_ROWS = 5;
const BOARD_COLS = 4;
const EXIT_ROW = 3;
const EXIT_COL = 1;

function copyPieces(pieces: KlotskiPiece[]): KlotskiPiece[] {
  return pieces.map((p) => ({ ...p }));
}

function pieceAt(pieces: KlotskiPiece[], row: number, col: number): KlotskiPiece | null {
  return pieces.find(
    (p) => row >= p.row && row < p.row + p.h && col >= p.col && col < p.col + p.w,
  ) ?? null;
}

function buildOccupied(pieces: KlotskiPiece[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(false),
  );
  for (const p of pieces) {
    for (let r = p.row; r < p.row + p.h; r++) {
      for (let c = p.col; c < p.col + p.w; c++) {
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
          grid[r][c] = true;
        }
      }
    }
  }
  return grid;
}

function canMoveTo(
  occupied: boolean[][],
  piece: KlotskiPiece,
  newRow: number,
  newCol: number,
  excludeId: string,
): boolean {
  for (let r = newRow; r < newRow + piece.h; r++) {
    for (let c = newCol; c < newCol + piece.w; c++) {
      if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
      if (occupied[r][c]) {
        const blocker = pieceAt(
          [piece],
          r - newRow + piece.row,
          c - newCol + piece.col,
        );
        const actual = pieceAt(
          [piece],
          r,
          c,
        );
        // Check if occupied by another piece
        const other = pieceAt(
          [piece],
          r,
          c,
        );
        // Actually check properly
        const allPieces = [piece]; // placeholder
      }
    }
  }
  return true;
}

export function initKlotski(layoutIndex = 0): KlotskiState {
  const layout = LAYOUTS[layoutIndex % LAYOUTS.length];
  return {
    pieces: copyPieces(layout.pieces),
    moveCount: 0,
    history: [],
    solved: false,
  };
}

export function movePiece(
  state: KlotskiState,
  pieceId: string,
  dr: number,
  dc: number,
): KlotskiState {
  if (state.solved || (dr === 0 && dc === 0)) return state;

  const idx = state.pieces.findIndex((p) => p.id === pieceId);
  if (idx === -1) return state;

  const piece = state.pieces[idx];
  const newRow = piece.row + dr;
  const newCol = piece.col + dc;

  // Check bounds
  if (newRow < 0 || newRow + piece.h > BOARD_ROWS) return state;
  if (newCol < 0 || newCol + piece.w > BOARD_COLS) return state;

  // Check collision with other pieces
  for (const other of state.pieces) {
    if (other.id === pieceId) continue;
    const rowOverlap = newRow < other.row + other.h && newRow + piece.h > other.row;
    const colOverlap = newCol < other.col + other.w && newCol + piece.w > other.col;
    if (rowOverlap && colOverlap) return state;
  }

  const newPieces = copyPieces(state.pieces);
  newPieces[idx] = { ...newPieces[idx], row: newRow, col: newCol };

  const solved = piece.id === "caocao" && newRow === EXIT_ROW && newCol === EXIT_COL;

  return {
    pieces: newPieces,
    moveCount: state.moveCount + 1,
    history: [...state.history, state.pieces],
    solved,
  };
}

export function undoKlotski(state: KlotskiState): KlotskiState {
  if (state.history.length === 0) return state;
  return {
    pieces: state.history[state.history.length - 1],
    moveCount: state.moveCount + 1,
    history: state.history.slice(0, -1),
    solved: false,
  };
}
