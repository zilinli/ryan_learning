/**
 * Local Go AI — liberty / capture heuristics (Sabaki-style analyze), no network.
 */

import {
  getLegalGoMoves,
  initGo,
  placeStone,
  type GoState,
} from "./go-logic";

export type AiDifficulty = "easy" | "medium" | "hard";

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
  let score = captured * 100 + (10 - dist) * 3;

  // Prefer moves near existing stones (influence)
  let near = 0;
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
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
  score += Math.random() * 2; // tiny jitter
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

  // medium / hard: pick best; hard looks one reply capture
  let best = legal[0];
  let bestScore = -Infinity;

  for (const m of legal) {
    let s = scoreMove(state, m);
    if (difficulty === "hard") {
      const [r, c] = m.split(",").map(Number);
      const next = placeStone(state, { row: r, col: c });
      if (next !== state) {
        const replies = getLegalGoMoves(next).slice(0, 24);
        let worst = 0;
        for (const rm of replies) {
          const rs = scoreMove(next, rm);
          if (rs > worst) worst = rs;
        }
        s -= worst * 0.6;
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
