/**
 * Snake engine — grid + queue body (classic arcade).
 */

export type Dir = "U" | "D" | "L" | "R";

export interface SnakeState {
  width: number;
  height: number;
  snake: { r: number; c: number }[]; // head at [0]
  dir: Dir;
  pendingDir: Dir;
  food: { r: number; c: number };
  score: number;
  status: "playing" | "over";
  tickMs: number;
}

const OPPOSITE: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
const DELTA: Record<Dir, [number, number]> = {
  U: [-1, 0],
  D: [1, 0],
  L: [0, -1],
  R: [0, 1],
};

function occupied(snake: { r: number; c: number }[]): Set<string> {
  return new Set(snake.map((p) => `${p.r},${p.c}`));
}

function placeFood(
  width: number,
  height: number,
  snake: { r: number; c: number }[],
): { r: number; c: number } {
  const occ = occupied(snake);
  const free: { r: number; c: number }[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!occ.has(`${r},${c}`)) free.push({ r, c });
    }
  }
  if (free.length === 0) return { r: 0, c: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

export function initSnake(width = 16, height = 12): SnakeState {
  const midR = Math.floor(height / 2);
  const midC = Math.floor(width / 2);
  const snake = [
    { r: midR, c: midC },
    { r: midR, c: midC - 1 },
    { r: midR, c: midC - 2 },
  ];
  return {
    width,
    height,
    snake,
    dir: "R",
    pendingDir: "R",
    food: placeFood(width, height, snake),
    score: 0,
    status: "playing",
    tickMs: 140,
  };
}

export function setDirection(state: SnakeState, dir: Dir): SnakeState {
  if (state.status !== "playing") return state;
  if (OPPOSITE[state.dir] === dir) return state;
  return { ...state, pendingDir: dir };
}

export function stepSnake(state: SnakeState): SnakeState {
  if (state.status !== "playing") return state;
  const dir = state.pendingDir;
  const [dr, dc] = DELTA[dir];
  const head = state.snake[0];
  const nr = head.r + dr;
  const nc = head.c + dc;

  if (nr < 0 || nc < 0 || nr >= state.height || nc >= state.width) {
    return { ...state, dir, status: "over" };
  }

  const hitSelf = state.snake.some((p, i) => i < state.snake.length - 1 && p.r === nr && p.c === nc);
  if (hitSelf) {
    return { ...state, dir, status: "over" };
  }

  const ate = nr === state.food.r && nc === state.food.c;
  const body = [{ r: nr, c: nc }, ...state.snake];
  if (!ate) body.pop();

  const score = state.score + (ate ? 10 : 0);
  const food = ate ? placeFood(state.width, state.height, body) : state.food;
  const tickMs = Math.max(60, 140 - Math.floor(score / 50) * 8);

  return {
    ...state,
    snake: body,
    dir,
    pendingDir: dir,
    food,
    score,
    tickMs,
  };
}
