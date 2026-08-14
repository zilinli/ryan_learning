import { describe, expect, it } from "vitest";
import {
  canConvert,
  energySkillSeed,
  generateEnergyMission,
  validateEnergyChain,
} from "./energy-chain";

describe("energy-chain", () => {
  it("allows height → motion → bell", () => {
    expect(canConvert("height", "motion")).toBe(true);
    expect(canConvert("motion", "bell")).toBe(true);
    expect(canConvert("heat", "height")).toBe(false);
  });

  it("accepts a working bell chain with correct prediction", () => {
    const m = generateEnergyMission(1);
    m.goal = "bell";
    const r = validateEnergyChain(m, ["height", "motion", "bell"], "works");
    expect(r.correct).toBe(true);
    expect(r.leaked).toBe(false);
  });

  it("flags illegal jump as energy used-up misconception", () => {
    const m = generateEnergyMission(2);
    m.goal = "bell";
    const r = validateEnergyChain(m, ["height", "bell"], "works");
    expect(r.correct).toBe(false);
    expect(r.leaked).toBe(true);
    expect(r.misconceptionId).toBe("phys-energy-used-up");
  });

  it("skill seed mentions energy", () => {
    expect(energySkillSeed(generateEnergyMission(1))).toMatch(/energy/i);
  });
});
