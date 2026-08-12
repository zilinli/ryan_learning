import { describe, expect, it } from "vitest";
import {
  initEcoTower,
  getAvailableOrganisms,
  placeOrganism,
  removeOrganism,
  toggleArrow,
  validateTower,
  runSimulation,
} from "./eco-tower";

describe("eco-tower", () => {
  it("initEcoTower creates empty state", () => {
    const state = initEcoTower();
    expect(state.tower).toHaveLength(5);
    expect(state.tower.every((s) => s === null)).toBe(true);
    expect(state.arrows).toHaveLength(0);
    expect(state.phase).toBe("building");
  });

  it("getAvailableOrganisms returns organisms for a biome", () => {
    const orgs = getAvailableOrganisms("grassland");
    expect(orgs.length).toBeGreaterThanOrEqual(5);
    expect(orgs.some((o) => o.trophicLevel === "producer")).toBe(true);
    expect(orgs.some((o) => o.trophicLevel === "apex_predator")).toBe(true);
  });

  it("placeOrganism works correctly", () => {
    let state = initEcoTower();
    state = { ...state, biome: "grassland" };
    const updated = placeOrganism(state, 0, "grass");
    expect(updated).not.toBeNull();
    expect(updated!.tower[0]).toBe("grass");
  });

  it("placeOrganism prevents duplicate placement", () => {
    let state = initEcoTower();
    state = { ...state, biome: "grassland" };
    state = placeOrganism(state, 0, "grass")!;
    const dup = placeOrganism(state, 1, "grass");
    expect(dup).toBeNull();
  });

  it("removeOrganism clears a slot", () => {
    let state = initEcoTower();
    state = { ...state, biome: "grassland" };
    state = placeOrganism(state, 0, "grass")!;
    state = placeOrganism(state, 2, "snake")!;
    state = removeOrganism(state, "grass");
    expect(state.tower[0]).toBeNull();
    expect(state.tower[2]).toBe("snake");
  });

  it("toggleArrow adds and removes arrows", () => {
    let state = initEcoTower();
    state = toggleArrow(state, "hawk", "snake");
    expect(state.arrows).toHaveLength(1);
    expect(state.arrows[0]).toEqual(["hawk", "snake"]);
    state = toggleArrow(state, "hawk", "snake");
    expect(state.arrows).toHaveLength(0);
  });

  it("validateTower detects invalid state", () => {
    let state = initEcoTower();
    state = { ...state, biome: "grassland" };
    const { valid } = validateTower(state);
    expect(valid).toBe(false);
  });
});
