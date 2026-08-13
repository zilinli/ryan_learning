import { describe, expect, it } from "vitest";
import {
  speciesByBiome,
  stepEcosystem,
  runGenesis,
  predictSurvival,
  validateGenesisArrows,
  pickGenesisEvent,
  applyGenesisEvent,
  addInvaderTo,
  predictionCategory,
  GENESIS_SPECIES,
  GENESIS_EVENTS,
  GENESIS_STEPS,
  type GenesisArrow,
  type GenesisSpecies,
} from "./eco-genesis";

function byId(id: string, species: GenesisSpecies[]): GenesisSpecies {
  const s = species.find((x) => x.id === id);
  if (!s) throw new Error(`species ${id} not found`);
  return s;
}

/** Grassland food chain arrows: grass→hopper→frog→snake→hawk. */
function grasslandChain(): { species: GenesisSpecies[]; arrows: GenesisArrow[] } {
  const species = speciesByBiome("grassland");
  const arrows: GenesisArrow[] = [
    ["g-grasshopper", "g-grass"],
    ["g-frog", "g-grasshopper"],
    ["g-snake", "g-frog"],
    ["g-hawk", "g-snake"],
  ];
  return { species, arrows };
}

describe("eco-genesis", () => {
  it("has 5 grassland species with valid dynamics params", () => {
    const g = speciesByBiome("grassland");
    expect(g).toHaveLength(5);
    for (const s of g) {
      expect(s.population).toBeGreaterThan(0);
      expect(s.deathRate).toBeGreaterThanOrEqual(0);
      expect(s.deathRate).toBeLessThanOrEqual(1);
      expect(s.carryingCapacity).toBeGreaterThan(0);
    }
  });

  it("producer grows logistically toward carrying capacity", () => {
    const grass = byId("g-grass", speciesByBiome("grassland"));
    let pop = grass.population;
    for (let i = 0; i < 60; i++) {
      const next = stepEcosystem([{ ...grass, population: pop }], []);
      pop = next[0].population;
    }
    // Logistic growth should approach carrying capacity.
    expect(pop).toBeGreaterThan(grass.population);
    expect(pop).toBeLessThanOrEqual(Math.round(grass.carryingCapacity * 1.6));
  });

  it("a correct grassland chain survives GENESIS_STEPS", () => {
    const { species, arrows } = grasslandChain();
    const run = runGenesis(species, arrows);
    expect(run.survived).toBe(true);
    expect(run.extinct).toHaveLength(0);
    expect(run.snapshots).toHaveLength(GENESIS_STEPS);
  });

  it("predictSurvival matches runGenesis on the correct chain", () => {
    const { species, arrows } = grasslandChain();
    expect(predictSurvival(species, arrows)).toBe(runGenesis(species, arrows).survived);
    expect(predictSurvival(species, arrows)).toBe(true);
  });

  it("a chain with NO producer collapses", () => {
    const { species, arrows } = grasslandChain();
    const noProducer = species.filter((s) => s.trophic !== "producer");
    const run = runGenesis(noProducer, arrows);
    // First consumer has no producer → starves.
    expect(run.survived).toBe(false);
    expect(run.extinct.length).toBeGreaterThan(0);
  });

  it("a consumer with NO arrow starves even when producer exists", () => {
    const { species } = grasslandChain();
    // Only grass is present; grasshopper has no arrow to it.
    const arrows: GenesisArrow[] = [];
    const run = runGenesis(species, arrows);
    expect(run.survived).toBe(false);
    expect(run.extinct).toContain("g-grasshopper");
  });

  it("validateGenesisArrows flags consumers without prey", () => {
    const { species } = grasslandChain();
    const check = validateGenesisArrows(species, []);
    expect(check.valid).toBe(false);
    expect(check.issues).toContain("g-grasshopper");
    const full = validateGenesisArrows(species, [
      ["g-grasshopper", "g-grass"],
      ["g-frog", "g-grasshopper"],
      ["g-snake", "g-frog"],
      ["g-hawk", "g-snake"],
    ]);
    expect(full.valid).toBe(true);
  });

  it("validateGenesisArrows flags arrows to nonexistent species", () => {
    const { species } = grasslandChain();
    const check = validateGenesisArrows(species, [
      ["g-grasshopper", "ghost"],
    ]);
    expect(check.valid).toBe(false);
    expect(check.issues).toContain("g-grasshopper");
  });

  it("disaster events apply deterministic scaling", () => {
    const { species } = grasslandChain();
    const drought = GENESIS_EVENTS.find((e) => e.id === "drought")!;
    const after = applyGenesisEvent(species, drought);
    const grassBefore = byId("g-grass", species).population;
    const grassAfter = byId("g-grass", after).population;
    expect(grassAfter).toBe(Math.round(grassBefore * 0.4));
  });

  it("invader species is added to the biome", () => {
    const withInvader = addInvaderTo("grassland");
    expect(withInvader.length).toBe(6);
    expect(withInvader.some((s) => s.id === "grassland-invader")).toBe(true);
  });

  it("pickGenesisEvent returns one of the known events", () => {
    const ev = pickGenesisEvent();
    expect(["drought", "heatwave", "bumper-crop"]).toContain(ev.id);
  });

  it("predictionCategory splits trivially-safe and doomed webs", () => {
    const producers = GENESIS_SPECIES.filter((s) => s.trophic === "producer");
    expect(predictionCategory(producers)).toBe("survive");
  });
});
