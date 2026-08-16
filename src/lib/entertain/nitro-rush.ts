/**
 * Nitro Rush — NFS-inspired endless lane racer (pure TS).
 * Multi-lane scroll, traffic dodge, nitro boost. Original game — no NFS assets.
 */

export type NitroStatus = "playing" | "over";

export interface TrafficCar {
  id: number;
  lane: number;
  /** 0 = top of view, 1 = bottom (past player) */
  y: number;
}

export interface NitroRushState {
  lanes: number;
  playerLane: number;
  /** Player fixed near bottom of playfield */
  playerY: number;
  speed: number;
  baseSpeed: number;
  nitro: number;
  nitroActive: boolean;
  traffic: TrafficCar[];
  score: number;
  distance: number;
  status: NitroStatus;
  tickMs: number;
  nextId: number;
  spawnCooldown: number;
}

const PLAYER_Y = 0.82;
const HIT_RADIUS = 0.07;
const NITRO_MAX = 100;
const NITRO_DRAIN = 4;
const NITRO_REGEN = 0.6;
const NITRO_MULT = 1.85;

export function initNitroRush(lanes = 4): NitroRushState {
  return {
    lanes,
    playerLane: Math.floor(lanes / 2),
    playerY: PLAYER_Y,
    speed: 1,
    baseSpeed: 1,
    nitro: NITRO_MAX,
    nitroActive: false,
    traffic: [],
    score: 0,
    distance: 0,
    status: "playing",
    tickMs: 50,
    nextId: 1,
    spawnCooldown: 0,
  };
}

export function steerNitro(
  state: NitroRushState,
  dir: "L" | "R",
): NitroRushState {
  if (state.status !== "playing") return state;
  const delta = dir === "L" ? -1 : 1;
  const playerLane = Math.max(0, Math.min(state.lanes - 1, state.playerLane + delta));
  return { ...state, playerLane };
}

export function setNitro(
  state: NitroRushState,
  active: boolean,
): NitroRushState {
  if (state.status !== "playing") return state;
  if (active && state.nitro <= 0) return { ...state, nitroActive: false };
  return { ...state, nitroActive: active };
}

function laneFree(traffic: TrafficCar[], lane: number, yMin: number, yMax: number): boolean {
  return !traffic.some((c) => c.lane === lane && c.y >= yMin && c.y <= yMax);
}

function maybeSpawn(
  state: NitroRushState,
  rng: () => number,
): { traffic: TrafficCar[]; nextId: number; spawnCooldown: number } {
  let { traffic, nextId, spawnCooldown } = state;
  spawnCooldown -= 1;
  if (spawnCooldown > 0) {
    return { traffic, nextId, spawnCooldown };
  }
  const density = Math.max(8, 22 - Math.floor(state.score / 200));
  spawnCooldown = density;
  const lane = Math.floor(rng() * state.lanes);
  if (!laneFree(traffic, lane, -0.05, 0.25)) {
    return { traffic, nextId, spawnCooldown };
  }
  traffic = [...traffic, { id: nextId, lane, y: -0.08 }];
  return { traffic, nextId: nextId + 1, spawnCooldown };
}

function crashed(state: NitroRushState, traffic: TrafficCar[]): boolean {
  return traffic.some(
    (c) =>
      c.lane === state.playerLane &&
      Math.abs(c.y - state.playerY) < HIT_RADIUS,
  );
}

/**
 * Advance one frame. Optional `rng` for deterministic tests (default Math.random).
 */
export function tickNitro(
  state: NitroRushState,
  rng: () => number = Math.random,
): NitroRushState {
  if (state.status !== "playing") return state;

  let nitro = state.nitro;
  let nitroActive = state.nitroActive && nitro > 0;
  if (nitroActive) {
    nitro = Math.max(0, nitro - NITRO_DRAIN);
    if (nitro <= 0) nitroActive = false;
  } else {
    nitro = Math.min(NITRO_MAX, nitro + NITRO_REGEN);
  }

  const levelBoost = 1 + Math.floor(state.score / 400) * 0.12;
  const speed = state.baseSpeed * levelBoost * (nitroActive ? NITRO_MULT : 1);
  const dy = 0.018 * speed;

  let traffic = state.traffic
    .map((c) => ({ ...c, y: c.y + dy }))
    .filter((c) => c.y < 1.15);

  const spawned = maybeSpawn({ ...state, traffic, nitro, nitroActive, speed }, rng);
  traffic = spawned.traffic;

  const distance = state.distance + dy * 100;
  const score = Math.floor(distance);

  if (crashed({ ...state, playerY: state.playerY }, traffic)) {
    return {
      ...state,
      traffic,
      nitro,
      nitroActive: false,
      speed,
      distance,
      score,
      status: "over",
      nextId: spawned.nextId,
      spawnCooldown: spawned.spawnCooldown,
    };
  }

  return {
    ...state,
    traffic,
    nitro,
    nitroActive,
    speed,
    distance,
    score,
    nextId: spawned.nextId,
    spawnCooldown: spawned.spawnCooldown,
    tickMs: Math.max(32, 50 - Math.floor(score / 500) * 2),
  };
}

/** Test helper: inject a car into a known lane/y. */
export function withTraffic(
  state: NitroRushState,
  cars: Omit<TrafficCar, "id">[],
): NitroRushState {
  let nextId = state.nextId;
  const traffic = cars.map((c) => ({ ...c, id: nextId++ }));
  return { ...state, traffic, nextId };
}
