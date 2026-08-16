import { describe, expect, it } from "vitest";
import {
  fireSky,
  initSkyPatrol,
  moveSky,
  tickSky,
  withSkyEnemies,
} from "./sky-patrol";

describe("sky-patrol", () => {
  it("SP1 init player + empty bullets/enemies", () => {
    const s = initSkyPatrol();
    expect(s.bullets).toHaveLength(0);
    expect(s.enemies).toHaveLength(0);
    expect(s.status).toBe("playing");
    expect(s.playerX).toBe(Math.floor(s.width / 2));
  });

  it("SP2 fire adds bullet with cooldown", () => {
    let s = initSkyPatrol();
    s = fireSky(s);
    expect(s.bullets).toHaveLength(1);
    expect(s.fireCooldown).toBeGreaterThan(0);
    const again = fireSky(s);
    expect(again.bullets).toHaveLength(1);
  });

  it("SP3 bullet–enemy hit removes both + score", () => {
    let s = initSkyPatrol();
    s = { ...s, playerX: 4, playerY: 10 };
    s = withSkyEnemies(s, [{ x: 4, y: 7.0, kind: "scout" }]);
    s = {
      ...s,
      bullets: [{ id: 99, x: 4, y: 8.2 }],
      fireCooldown: 0,
      spawnCooldown: 99,
    };
    s = tickSky(s, () => 0.9);
    expect(s.enemies).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(10);
  });

  it("SP4 enemy–player hit → over", () => {
    let s = initSkyPatrol();
    s = withSkyEnemies(s, [
      { x: s.playerX, y: s.playerY, kind: "scout" },
    ]);
    s = tickSky(s, () => 0.9);
    expect(s.status).toBe("over");
  });

  it("move clamps horizontally", () => {
    let s = initSkyPatrol(5);
    s = { ...s, playerX: 0 };
    s = moveSky(s, "L");
    expect(s.playerX).toBe(0);
  });
});
