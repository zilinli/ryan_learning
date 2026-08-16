import { describe, expect, it } from "vitest";
import {
  driftBalloon,
  flapBalloon,
  initBalloonFloat,
  tickBalloon,
  withRivals,
} from "./balloon-float";

describe("balloon-float", () => {
  it("BF1 flap increases upward velocity", () => {
    let s = initBalloonFloat();
    s = { ...s, vy: 1 };
    s = flapBalloon(s);
    expect(s.vy).toBeLessThan(0);
  });

  it("BF2 gravity pulls downward", () => {
    let s = initBalloonFloat();
    s = { ...s, vy: 0, spawnCooldown: 999 };
    const y0 = s.y;
    s = tickBalloon(s, () => 0.5);
    expect(s.vy).toBeGreaterThan(0);
    expect(s.y).toBeGreaterThan(y0);
  });

  it("BF3 pop rival from above → score", () => {
    let s = initBalloonFloat();
    s = {
      ...s,
      x: 5,
      y: 4,
      vy: 0,
      spawnCooldown: 999,
    };
    s = withRivals(s, [{ x: 5, y: 4.5, vx: 0 }]);
    s = tickBalloon(s, () => 0.5);
    expect(s.score).toBeGreaterThanOrEqual(15);
    expect(s.rivals).toHaveLength(0);
  });

  it("BF4 below floor → over", () => {
    let s = initBalloonFloat();
    s = { ...s, y: s.height * 0.95, vy: 2, spawnCooldown: 999 };
    s = tickBalloon(s, () => 0.5);
    expect(s.status).toBe("over");
  });

  it("drift changes vx", () => {
    let s = initBalloonFloat();
    s = driftBalloon(s, "R");
    expect(s.vx).toBeGreaterThan(0);
  });
});
