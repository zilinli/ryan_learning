/**
 * Local Go AI — liberty / capture heuristics (Sabaki-style analyze), no network.
 * Levels: easy | medium | hard | expert | master
 */

import {
  getLegalGoMoves,
  initGo,
  placeStone,
  type GoState,
} from "./go-logic";

export type AiDifficulty = "easy" | "medium" | "hard" | "expert" | "master";

export const AI_DIFFICULTIES: AiDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
];

function replySampleSize(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "easy":
    case "medium":
      return 0;
    case "hard":
      return 24;
    case "expert":
      return 40;
    case "master":
      return 64;
  }
}

function replyPenalty(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "hard":
      return 0.6;
    case "expert":
      return 0.75;
    case "master":
      return 0.9;
    default:
      return 0;
  }
}

const NEI: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Count liberties of the group containing (r,c). */
function groupLibs(board: GoState["board"], r: number, c: number): number {
  const color = board[r][c];
  if (!color) return 0;
  const size = board.length;
  const seen = new Set<string>();
  const libs = new Set<string>();
  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const [dr, dc] of NEI) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      if (board[nr][nc] === null) libs.add(`${nr},${nc}`);
      else if (board[nr][nc] === color) stack.push([nr, nc]);
    }
  }
  return libs.size;
}

function scoreMove(state: GoState, move: string): number {
  if (move === "pass") return -100;
  const [r, c] = move.split(",").map(Number);
  const beforeCap =
    state.turn === "black" ? state.capturedWhite : state.capturedBlack;
  const next = placeStone(state, { row: r, col: c });
  if (next === state) return -1000;

  const afterCap =
    state.turn === "black" ? next.capturedWhite : next.capturedBlack;
  const captured = afterCap - beforeCap;

  // Center preference on 9×9
  const center = (state.size - 1) / 2;
  const dist = Math.abs(r - center) + Math.abs(c - center);
  let score = captured * 120 + (10 - dist) * 3;

  // Prefer moves near existing stones (influence)
  let near = 0;
  for (const [dr, dc] of [
    ...NEI,
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= state.size || nc >= state.size) continue;
    if (state.board[nr][nc] !== null) near++;
  }
  score += near * 5;

  // Atari: put opponent groups to 1 liberty / save own groups
  const opp = state.turn === "black" ? "white" : "black";
  for (const [dr, dc] of NEI) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= state.size || nc >= state.size) continue;
    if (next.board[nr][nc] === opp && groupLibs(next.board, nr, nc) === 1) {
      score += 85;
    }
    if (state.board[nr][nc] === state.turn && groupLibs(state.board, nr, nc) === 1) {
      score += 70; // save own atari by playing here (pre-move adjacency)
    }
  }

  score += Math.random() * 1.5;
  return score;
}

export function chooseGoAiMove(
  state: GoState,
  difficulty: AiDifficulty = "medium",
): string {
  const legal = getLegalGoMoves(state);
  if (legal.length === 0) return "pass";

  if (difficulty === "easy") {
    // Random among top half by score
    const scored = legal.map((m) => ({ m, s: scoreMove(state, m) }));
    scored.sort((a, b) => b.s - a.s);
    const pool = scored.slice(0, Math.max(3, Math.floor(scored.length / 2)));
    return pool[Math.floor(Math.random() * pool.length)].m;
  }

  const sample = replySampleSize(difficulty);
  const penalty = replyPenalty(difficulty);
  let best = legal[0];
  let bestScore = -Infinity;

  for (const m of legal) {
    let s = scoreMove(state, m);
    if (sample > 0 && m !== "pass") {
      const [r, c] = m.split(",").map(Number);
      const next = placeStone(state, { row: r, col: c });
      if (next !== state) {
        const replies = getLegalGoMoves(next).slice(0, sample);
        let worst = 0;
        for (const rm of replies) {
          const rs = scoreMove(next, rm);
          if (rs > worst) worst = rs;
        }
        s -= worst * penalty;

        // Master: one extra opponent-threat peek on top replies
        if (difficulty === "master") {
          let second = 0;
          for (const rm of replies.slice(0, 12)) {
            if (rm === "pass") continue;
            const [rr, rc] = rm.split(",").map(Number);
            const after = placeStone(next, { row: rr, col: rc });
            if (after === next) continue;
            for (const r2 of getLegalGoMoves(after).slice(0, 8)) {
              second = Math.max(second, scoreMove(after, r2));
            }
          }
          s += second * 0.25;
        }
      }
    }
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

export { initGo, placeStone, getLegalGoMoves };
