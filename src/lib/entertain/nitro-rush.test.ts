import { describe, expect, it } from "vitest";
import {
  initNitroRush,
  setNitro,
  steerNitro,
  tickNitro,
  withTraffic,
} from "./nitro-rush";

describe("nitro-rush", () => {
  it("NR1 init: mid lane, playing, nitro full", () => {
    const s = initNitroRush(4);
    expect(s.playerLane).toBe(2);
    expect(s.status).toBe("playing");
    expect(s.nitro).toBe(100);
  });

  it("NR2 steer clamps to lane bounds", () => {
    let s = initNitroRush(4);
    s = { ...s, playerLane: 0 };
    s = steerNitro(s, "L");
    expect(s.playerLane).toBe(0);
    s = { ...s, playerLane: 3 };
    s = steerNitro(s, "R");
    expect(s.playerLane).toBe(3);
  });

  it("NR3 nitro raises speed and drains charge", () => {
    let s = initNitroRush();
    s = setNitro(s, true);
    const before = s.nitro;
    s = tickNitro(s, () => 0.99); // avoid spawn lane 0 clutter
    expect(s.nitro).toBeLessThan(before);
    expect(s.speed).toBeGreaterThan(s.baseSpeed);
  });

  it("NR4 same-lane overlap → over", () => {
    let s = initNitroRush();
    s = withTraffic(s, [{ lane: s.playerLane, y: s.playerY }]);
    s = tickNitro(s, () => 0);
    expect(s.status).toBe("over");
  });

  it("NR5 distance increases score", () => {
    let s = initNitroRush();
    const rng = () => 0.5;
    for (let i = 0; i < 40; i++) s = tickNitro(s, rng);
    expect(s.score).toBeGreaterThan(0);
    expect(s.distance).toBeGreaterThan(0);
  });
});
