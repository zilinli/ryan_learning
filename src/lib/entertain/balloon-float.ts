/**
 * Balloon Float — Balloon Fight–inspired floater (pure TS).
 * Flap to rise, gravity, pop rival balloons. Original — no Nintendo assets.
 */

export type BalloonStatus = "playing" | "over";

export interface RivalBalloon {
  id: number;
  x: number;
  y: number;
  vx: number;
}

export interface BalloonFloatState {
  width: number;
  height: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rivals: RivalBalloon[];
  score: number;
  status: BalloonStatus;
  tickMs: number;
  spawnCooldown: number;
  nextId: number;
}

const GRAVITY = 0.12;
const FLAP_IMPULSE = -1.55;
const MAX_FALL = 2.2;
const FLOOR = 0.92;
const CEILING = 0.06;

export function initBalloonFloat(width = 10, height = 14): BalloonFloatState {
  return {
    width,
    height,
    x: width / 2,
    y: height * 0.55,
    vx: 0,
    vy: 0,
    rivals: [],
    score: 0,
    status: "playing",
    tickMs: 50,
    spawnCooldown: 20,
    nextId: 1,
  };
}

export function flapBalloon(state: BalloonFloatState): BalloonFloatState {
  if (state.status !== "playing") return state;
  return { ...state, vy: Math.min(state.vy, 0) + FLAP_IMPULSE };
}

export function driftBalloon(
  state: BalloonFloatState,
  dir: "L" | "R",
): BalloonFloatState {
  if (state.status !== "playing") return state;
  const boost = dir === "L" ? -0.55 : 0.55;
  return { ...state, vx: Math.max(-1.8, Math.min(1.8, state.vx + boost)) };
}

function wrapX(x: number, width: number): number {
  if (x < 0) return x + width;
  if (x >= width) return x - width;
  return x;
}

function maybeSpawn(
  state: BalloonFloatState,
  rng: () => number,
): { rivals: RivalBalloon[]; nextId: number; spawnCooldown: number } {
  let { rivals, nextId, spawnCooldown } = state;
  spawnCooldown -= 1;
  if (spawnCooldown > 0) return { rivals, nextId, spawnCooldown };
  spawnCooldown = Math.max(12, 28 - Math.floor(state.score / 50));
  const x = rng() * state.width;
  const y = CEILING * state.height + rng() * state.height * 0.35;
  const vx = (rng() < 0.5 ? -1 : 1) * (0.15 + rng() * 0.25);
  rivals = [...rivals, { id: nextId, x, y, vx }];
  return { rivals, nextId: nextId + 1, spawnCooldown };
}

export function tickBalloon(
  state: BalloonFloatState,
  rng: () => number = Math.random,
): BalloonFloatState {
  if (state.status !== "playing") return state;

  let vy = Math.min(MAX_FALL, state.vy + GRAVITY);
  let vx = state.vx * 0.96;
  let x = wrapX(state.x + vx, state.width);
  let y = state.y + vy;

  if (y < CEILING * state.height) {
    y = CEILING * state.height;
    vy = Math.max(0, vy);
  }

  if (y >= FLOOR * state.height) {
    return { ...state, x, y, vx, vy, status: "over" };
  }

  let rivals = state.rivals.map((r) => ({
    ...r,
    x: wrapX(r.x + r.vx, state.width),
    y: r.y + Math.sin(r.id + state.score * 0.01) * 0.05,
  }));

  let score = state.score;
  const kept: RivalBalloon[] = [];
  for (const r of rivals) {
    const dx = Math.abs(r.x - x);
    const dy = r.y - y;
    const near = dx < 0.85 && Math.abs(dy) < 0.9;
    if (near && dy > 0.05) {
      // Player above rival → pop
      score += 15;
      vy = Math.min(vy, -0.8);
      continue;
    }
    if (near && dy <= 0.05) {
      // Side / below bump — bounce away, small penalty feeling via knockback
      vx += r.x < x ? 0.8 : -0.8;
      kept.push(r);
      continue;
    }
    kept.push(r);
  }
  rivals = kept;

  const spawned = maybeSpawn({ ...state, rivals, score, x, y, vx, vy }, rng);

  return {
    ...state,
    x,
    y,
    vx,
    vy,
    rivals: spawned.rivals,
    score,
    nextId: spawned.nextId,
    spawnCooldown: spawned.spawnCooldown,
    tickMs: Math.max(36, 50 - Math.floor(score / 120)),
  };
}

export function withRivals(
  state: BalloonFloatState,
  list: Omit<RivalBalloon, "id">[],
): BalloonFloatState {
  let nextId = state.nextId;
  const rivals = list.map((r) => ({ ...r, id: nextId++ }));
  return { ...state, rivals, nextId };
}
