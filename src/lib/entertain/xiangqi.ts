/**
 * Xiangqi (Chinese Chess) game logic.
 * Board: 10 rows × 9 columns. Rows 0-4 = black territory, rows 5-9 = red territory.
 * River between rows 4 and 5.
 */

export type XiangqiPiece =
  | "R"   // Red
  | "r"   // Black
  | "N" | "n"  // Knight (Horse)
  | "B" | "b"  // Bishop (Elephant)
  | "A" | "a"  // Advisor
  | "K" | "k"  // King (General)
  | "C" | "c"  // Cannon
  | "P" | "p"; // Pawn (Soldier)

export type XiangqiCell = XiangqiPiece | null;

export type XiangqiBoard = XiangqiCell[][];

export type XiangqiColor = "red" | "black";

export interface XiangqiPosition {
  row: number;
  col: number;
}

export interface XiangqiMove {
  from: XiangqiPosition;
  to: XiangqiPosition;
}

export interface XiangqiState {
  board: XiangqiBoard;
  turn: XiangqiColor;
  moveHistory: XiangqiMove[];
  selectedCell: XiangqiPosition | null;
  status: "playing" | "red_win" | "black_win" | "draw";
}

function isRed(piece: XiangqiPiece): boolean {
  return "RNBAKCP".includes(piece);
}

function pieceColor(piece: XiangqiPiece): XiangqiColor {
  return isRed(piece) ? "red" : "black";
}

export function initialBoard(): XiangqiBoard {
  const board: XiangqiBoard = Array.from({ length: 10 }, () => Array(9).fill(null));

  // Red (bottom, rows 9-5)
  board[9][0] = "R"; board[9][1] = "N"; board[9][2] = "B"; board[9][3] = "A";
  board[9][4] = "K"; board[9][5] = "A"; board[9][6] = "B"; board[9][7] = "N"; board[9][8] = "R";
  board[7][1] = "C"; board[7][7] = "C";
  board[6][0] = "P"; board[6][2] = "P"; board[6][4] = "P"; board[6][6] = "P"; board[6][8] = "P";

  // Black (top, rows 0-4)
  board[0][0] = "r"; board[0][1] = "n"; board[0][2] = "b"; board[0][3] = "a";
  board[0][4] = "k"; board[0][5] = "a"; board[0][6] = "b"; board[0][7] = "n"; board[0][8] = "r";
  board[2][1] = "c"; board[2][7] = "c";
  board[3][0] = "p"; board[3][2] = "p"; board[3][4] = "p"; board[3][6] = "p"; board[3][8] = "p";

  return board;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 10 && c >= 0 && c < 9;
}

function inPalace(r: number, c: number, color: XiangqiColor): boolean {
  if (c < 3 || c > 5) return false;
  if (color === "red") return r >= 7 && r <= 9;
  return r >= 0 && r <= 2;
}

function inOwnHalf(r: number, color: XiangqiColor): boolean {
  if (color === "red") return r >= 5 && r <= 9;
  return r >= 0 && r <= 4;
}

function isBlocked(board: XiangqiBoard, from: XiangqiPosition, to: XiangqiPosition): boolean {
  let count = 0;
  if (from.row === to.row) {
    const minC = Math.min(from.col, to.col);
    const maxC = Math.max(from.col, to.col);
    for (let c = minC + 1; c < maxC; c++) {
      if (board[from.row][c] !== null) count++;
    }
  } else if (from.col === to.col) {
    const minR = Math.min(from.row, to.row);
    const maxR = Math.max(from.row, to.row);
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][from.col] !== null) count++;
    }
  }
  return count;
}

function getRawMoves(board: XiangqiBoard, pos: XiangqiPosition): XiangqiPosition[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const color = pieceColor(piece);
  const moves: XiangqiPosition[] = [];
  const { row: r, col: c } = pos;

  const addIf = (nr: number, nc: number) => {
    if (!inBounds(nr, nc)) return;
    const target = board[nr][nc];
    if (target && pieceColor(target) === color) return;
    moves.push({ row: nr, col: nc });
  };

  switch (piece.toUpperCase()) {
    case "R": { // Rook
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (Math.abs(dr) + Math.abs(dc) !== 1) continue;
          for (let i = 1; i <= 10; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (!inBounds(nr, nc)) break;
            const target = board[nr][nc];
            if (target) {
              if (pieceColor(target) !== color) moves.push({ row: nr, col: nc });
              break;
            }
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
    }
    case "N": { // Knight
      const knightMoves: [number, number][] = [
        [-2, -1], [-2, 1], [2, -1], [2, 1],
        [-1, -2], [-1, 2], [1, -2], [1, 2],
      ];
      const legs: [number, number][] = [
        [-1, 0], [-1, 0], [1, 0], [1, 0],
        [0, -1], [0, 1], [0, -1], [0, 1],
      ];
      for (let i = 0; i < knightMoves.length; i++) {
        const [dr, dc] = knightMoves[i];
        const [lr, lc] = legs[i];
        if (board[r + lr]?.[c + lc] !== null && board[r + lr]?.[c + lc] !== undefined) continue;
        addIf(r + dr, c + dc);
      }
      break;
    }
    case "B": { // Elephant
      const elephantMoves: [number, number][] = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
      const eLegs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (let i = 0; i < elephantMoves.length; i++) {
        const [dr, dc] = elephantMoves[i];
        const [lr, lc] = eLegs[i];
        if (board[r + lr]?.[c + lc] !== null) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        if (!inOwnHalf(nr, color)) continue;
        addIf(nr, nc);
      }
      break;
    }
    case "A": { // Advisor
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && inPalace(nr, nc, color)) addIf(nr, nc);
      }
      break;
    }
    case "K": { // King
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && inPalace(nr, nc, color)) addIf(nr, nc);
      }
      // Flying general: capture opposing king if on same column with nothing between
      for (let rr = r - 1; rr >= 0; rr--) {
        const cell = board[rr][c];
        if (cell) {
          if (cell.toUpperCase() === "K" && pieceColor(cell) !== color) {
            moves.push({ row: rr, col: c });
          }
          break;
        }
      }
      for (let rr = r + 1; rr < 10; rr++) {
        const cell = board[rr][c];
        if (cell) {
          if (cell.toUpperCase() === "K" && pieceColor(cell) !== color) {
            moves.push({ row: rr, col: c });
          }
          break;
        }
      }
      break;
    }
    case "C": { // Cannon
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (Math.abs(dr) + Math.abs(dc) !== 1) continue;
          let blocked = false;
          for (let i = 1; i <= 10; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (!inBounds(nr, nc)) break;
            const target = board[nr][nc];
            if (!blocked) {
              if (target) {
                blocked = true;
              } else {
                moves.push({ row: nr, col: nc });
              }
            } else {
              if (target) {
                if (pieceColor(target) !== color) moves.push({ row: nr, col: nc });
                break;
              }
            }
          }
        }
      }
      break;
    }
    case "P": { // Pawn
      const forward = color === "red" ? -1 : 1;
      const nr = r + forward;
      addIf(nr, c);
      if (!inOwnHalf(r, color)) {
        addIf(r, c - 1);
        addIf(r, c + 1);
      }
      break;
    }
  }

  return moves;
}

function moveResultsInCheck(board: XiangqiBoard, move: XiangqiMove, color: XiangqiColor): boolean {
  const newBoard = board.map((row) => [...row]) as XiangqiBoard;
  newBoard[move.to.row][move.to.col] = newBoard[move.from.row][move.from.col];
  newBoard[move.from.row][move.from.col] = null;
  return isInCheck(newBoard, color);
}

export function isInCheck(board: XiangqiBoard, color: XiangqiColor): boolean {
  let kingPos: XiangqiPosition | null = null;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.toUpperCase() === "K" && pieceColor(piece) === color) {
        kingPos = { row: r, col: c };
        break;
      }
    }
    if (kingPos) break;
  }
  if (!kingPos) return true; // king captured

  const enemyColor = color === "red" ? "black" : "red";
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && pieceColor(piece) === enemyColor) {
        const moves = getRawMoves(board, { row: r, col: c });
        if (moves.some((m) => m.row === kingPos!.row && m.col === kingPos!.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function getLegalMoves(board: XiangqiBoard, pos: XiangqiPosition): XiangqiPosition[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];
  const color = pieceColor(piece);
  const rawMoves = getRawMoves(board, pos);
  return rawMoves.filter(
    (to) => !moveResultsInCheck(board, { from: pos, to }, color),
  );
}

/** All legal moves for a color as "r,c-r,c" strings (for AI). */
export function getAllLegalMoveStrings(board: XiangqiBoard, color: XiangqiColor): string[] {
  const out: string[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (!piece || pieceColor(piece) !== color) continue;
      for (const to of getLegalMoves(board, { row: r, col: c })) {
        out.push(`${r},${c}-${to.row},${to.col}`);
      }
    }
  }
  return out;
}

export function makeMove(state: XiangqiState, to: XiangqiPosition): XiangqiState {
  if (!state.selectedCell) return state;
  const from = state.selectedCell;
  const piece = state.board[from.row][from.col];
  if (!piece || pieceColor(piece) !== state.turn) return state;

  const legalMoves = getLegalMoves(state.board, from);
  if (!legalMoves.some((m) => m.row === to.row && m.col === to.col)) {
    return { ...state, selectedCell: null };
  }

  const newBoard = state.board.map((row) => [...row]) as XiangqiBoard;
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;

  const nextTurn: XiangqiColor = state.turn === "red" ? "black" : "red";
  const move: XiangqiMove = { from, to };
  const newHistory = [...state.moveHistory, move];

  // Check if opponent king is captured / checkmated
  const opponentColor = nextTurn;
  let status: XiangqiState["status"] = "playing";
  if (isInCheck(newBoard, opponentColor)) {
    const hasMoves = hasAnyLegalMove(newBoard, opponentColor);
    if (!hasMoves) {
      status = state.turn === "red" ? "red_win" : "black_win";
    }
  }

  return {
    board: newBoard,
    turn: nextTurn,
    moveHistory: newHistory,
    selectedCell: null,
    status,
  };
}

function hasAnyLegalMove(board: XiangqiBoard, color: XiangqiColor): boolean {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && pieceColor(piece) === color) {
        if (getLegalMoves(board, { row: r, col: c }).length > 0) return true;
      }
    }
  }
  return false;
}

export function initXiangqi(): XiangqiState {
  return {
    board: initialBoard(),
    turn: "red",
    moveHistory: [],
    selectedCell: null,
    status: "playing",
  };
}

export function selectCell(state: XiangqiState, pos: XiangqiPosition): XiangqiState {
  if (state.status !== "playing") return state;

  const piece = state.board[pos.row][pos.col];

  // If a cell is already selected
  if (state.selectedCell) {
    const fromPiece = state.board[state.selectedCell.row][state.selectedCell.col];
    const fromColor = fromPiece ? pieceColor(fromPiece) : null;

    // Clicking on own piece: select it instead
    if (piece && pieceColor(piece) === fromColor) {
      return { ...state, selectedCell: pos };
    }

    // Try to move
    return makeMove(state, pos);
  }

  // Select a piece (only current turn's pieces)
  if (piece && pieceColor(piece) === state.turn) {
    return { ...state, selectedCell: pos };
  }

  return state;
}

/** Piece display characters for the board */
export const PIECE_LABELS: Record<XiangqiPiece, string> = {
  K: "帅", k: "将",
  A: "仕", a: "士",
  B: "相", b: "象",
  N: "馬", n: "馬",
  R: "車", r: "車",
  C: "炮", c: "砲",
  P: "兵", p: "卒",
};

export function pieceChar(piece: XiangqiPiece | null): string {
  if (!piece) return "";
  return PIECE_LABELS[piece];
}

export function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function boardToChinese(state: XiangqiState): string {
  const lines: string[] = [];
  const labels = ["九", "八", "七", "六", "五", "四", "三", "二", "一"];
  for (let r = 0; r < 10; r++) {
    const row: string[] = [];
    for (let c = 0; c < 9; c++) {
      const piece = state.board[r][c];
      row.push(piece ? PIECE_LABELS[piece] : (r === 0 || r === 9) ? `·` : "┼");
    }
    lines.push(row.join(""));
  }
  return lines.join("\n");
}

export function moveToChinese(move: XiangqiMove, board: XiangqiBoard): string {
  const piece = board[move.from.row][move.from.col];
  const label = piece ? PIECE_LABELS[piece] : "?";
  const fromCol = 8 - move.from.col + 1;
  const toCol = 8 - move.to.col + 1;
  const forward = pieceColor(piece!) === "red" ? move.to.row < move.from.row : move.to.row > move.from.row;
  const dir = forward ? "进" : "退";
  return `${label}${fromCol}${dir}${toCol}`;
}
