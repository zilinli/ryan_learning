/**
 * Sky Patrol — Nintendo-inspired vertical shoot-em-up (pure TS).
 * Kid-friendly planes; original art names — not 1942/Xevious IP.
 */

export type SkyStatus = "playing" | "over";

export interface SkyBullet {
  id: number;
  x: number;
  y: number;
}

export interface SkyEnemy {
  id: number;
  x: number;
  y: number;
  kind: "scout" | "bomber";
}

export interface SkyPatrolState {
  width: number;
  height: number;
  playerX: number;
  playerY: number;
  bullets: SkyBullet[];
  enemies: SkyEnemy[];
  score: number;
  status: SkyStatus;
  tickMs: number;
  fireCooldown: number;
  spawnCooldown: number;
  nextId: number;
}

const FIRE_COOLDOWN = 4;
const BULLET_SPEED = 1.2;
const ENEMY_SPEED = 0.35;

export function initSkyPatrol(width = 9, height = 12): SkyPatrolState {
  return {
    width,
    height,
    playerX: Math.floor(width / 2),
    playerY: height - 2,
    bullets: [],
    enemies: [],
    score: 0,
    status: "playing",
    tickMs: 80,
    fireCooldown: 0,
    spawnCooldown: 6,
    nextId: 1,
  };
}

export function moveSky(
  state: SkyPatrolState,
  dir: "L" | "R",
): SkyPatrolState {
  if (state.status !== "playing") return state;
  const delta = dir === "L" ? -1 : 1;
  const playerX = Math.max(0, Math.min(state.width - 1, state.playerX + delta));
  return { ...state, playerX };
}

export function fireSky(state: SkyPatrolState): SkyPatrolState {
  if (state.status !== "playing") return state;
  if (state.fireCooldown > 0) return state;
  const bullet: SkyBullet = {
    id: state.nextId,
    x: state.playerX,
    y: state.playerY - 1,
  };
  return {
    ...state,
    bullets: [...state.bullets, bullet],
    fireCooldown: FIRE_COOLDOWN,
    nextId: state.nextId + 1,
  };
}

function aabb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  pad = 0.65,
): boolean {
  return Math.abs(ax - bx) <= pad && Math.abs(ay - by) <= pad;
}

function spawnEnemy(
  state: SkyPatrolState,
  rng: () => number,
): { enemies: SkyEnemy[]; nextId: number; spawnCooldown: number } {
  let { enemies, nextId, spawnCooldown } = state;
  spawnCooldown -= 1;
  if (spawnCooldown > 0) return { enemies, nextId, spawnCooldown };
  const interval = Math.max(3, 10 - Math.floor(state.score / 80));
  spawnCooldown = interval;
  const x = Math.floor(rng() * state.width);
  const kind: SkyEnemy["kind"] = rng() < 0.25 ? "bomber" : "scout";
  enemies = [...enemies, { id: nextId, x, y: 0, kind }];
  return { enemies, nextId: nextId + 1, spawnCooldown };
}

export function tickSky(
  state: SkyPatrolState,
  rng: () => number = Math.random,
): SkyPatrolState {
  if (state.status !== "playing") return state;

  let fireCooldown = Math.max(0, state.fireCooldown - 1);
  let bullets = state.bullets
    .map((b) => ({ ...b, y: b.y - BULLET_SPEED }))
    .filter((b) => b.y >= -1);

  let enemies = state.enemies.map((e) => ({
    ...e,
    y: e.y + ENEMY_SPEED * (e.kind === "bomber" ? 0.7 : 1),
  }));

  let score = state.score;
  const survivingEnemies: SkyEnemy[] = [];
  const hitBulletIds = new Set<number>();

  for (const e of enemies) {
    if (e.y > state.height) continue;
    let hit = false;
    for (const b of bullets) {
      if (hitBulletIds.has(b.id)) continue;
      if (aabb(b.x, b.y, e.x, e.y)) {
        hitBulletIds.add(b.id);
        hit = true;
        score += e.kind === "bomber" ? 30 : 10;
        break;
      }
    }
    if (!hit) survivingEnemies.push(e);
  }
  enemies = survivingEnemies;
  bullets = bullets.filter((b) => !hitBulletIds.has(b.id));

  for (const e of enemies) {
    if (aabb(e.x, e.y, state.playerX, state.playerY, 0.55)) {
      return {
        ...state,
        bullets,
        enemies,
        score,
        fireCooldown,
        status: "over",
      };
    }
  }

  const spawned = spawnEnemy(
    { ...state, enemies, score, fireCooldown, bullets },
    rng,
  );

  return {
    ...state,
    bullets,
    enemies: spawned.enemies,
    score,
    fireCooldown,
    spawnCooldown: spawned.spawnCooldown,
    nextId: spawned.nextId,
    tickMs: Math.max(45, 80 - Math.floor(score / 100) * 3),
  };
}

export function withSkyEnemies(
  state: SkyPatrolState,
  list: Omit<SkyEnemy, "id">[],
): SkyPatrolState {
  let nextId = state.nextId;
  const enemies = list.map((e) => ({ ...e, id: nextId++ }));
  return { ...state, enemies, nextId };
}
