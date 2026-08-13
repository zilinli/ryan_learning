/**
 * Eco Genesis — living ecosystem simulation (pure functions).
 * Discrete population dynamics: producers grow logistically, consumers grow
 * on prey surplus and decline on prey shortage. The food web is defined by the
 * student's own arrows, so wrong arrows cause visible population collapse.
 */

export type GenesisTrophic =
  | "producer"
  | "primary"
  | "secondary"
  | "tertiary"
  | "apex";

export type GenesisSpecies = {
  id: string;
  name: string;
  emoji: string;
  trophic: GenesisTrophic;
  biome: string;
  /** Population at the start of a level. */
  population: number;
  /** Producer logistic growth rate per step. */
  birthRate: number;
  /** Natural death fraction per step (0..1). */
  deathRate: number;
  /** Logistic carrying capacity (producers). */
  carryingCapacity: number;
  /** Food units each prey individual provides. */
  conversion: number;
  /** Food units each individual needs per step. */
  maintenance: number;
  /** Short description shown on the card. */
  blurb: string;
};

export type GenesisArrow = [string, string]; // [eaterId, preyId]

export type GenesisEvent = {
  id: string;
  label: string;
  blurb: string;
  apply: (state: GenesisSpecies[]) => GenesisSpecies[];
};

export type GenesisSnapshot = {
  step: number;
  populations: Record<string, number>;
  extinct: string[];
};

export type GenesisRun = {
  snapshots: GenesisSnapshot[];
  survived: boolean;
  extinct: string[];
  /** Species that survived but collapsed to near-zero. */
  atRisk: string[];
};

export type GenesisPrediction =
  | "survive"
  | "collapse"
  | "mixed";

export const GENESIS_STEPS = 6;

// ---------------------------------------------------------------------------
// Species catalog by biome
// ---------------------------------------------------------------------------

function makeSpecies(
  base: Omit<GenesisSpecies, "population">,
  population: number,
): GenesisSpecies {
  return { ...base, population };
}

export const GENESIS_SPECIES: GenesisSpecies[] = [
  // Grassland
  makeSpecies({
    id: "g-grass", name: "Grass", emoji: "🌱", trophic: "producer", biome: "grassland",
    birthRate: 0.5, deathRate: 0.02, carryingCapacity: 220, conversion: 0.5, maintenance: 0,
    blurb: "Turns sunlight into food for the whole web.",
  }, 100),
  makeSpecies({
    id: "g-grasshopper", name: "Grasshopper", emoji: "🦗", trophic: "primary", biome: "grassland",
    birthRate: 0, deathRate: 0.05, carryingCapacity: 120, conversion: 0.5, maintenance: 1.0,
    blurb: "Eats grass. A favourite snack.",
  }, 40),
  makeSpecies({
    id: "g-frog", name: "Frog", emoji: "🐸", trophic: "secondary", biome: "grassland",
    birthRate: 0, deathRate: 0.05, carryingCapacity: 60, conversion: 0.5, maintenance: 1.0,
    blurb: "Snaps up grasshoppers.",
  }, 15),
  makeSpecies({
    id: "g-snake", name: "Snake", emoji: "🐍", trophic: "tertiary", biome: "grassland",
    birthRate: 0, deathRate: 0.05, carryingCapacity: 30, conversion: 0.5, maintenance: 0.95,
    blurb: "Slithers after frogs.",
  }, 6),
  makeSpecies({
    id: "g-hawk", name: "Hawk", emoji: "🦅", trophic: "apex", biome: "grassland",
    birthRate: 0, deathRate: 0.04, carryingCapacity: 15, conversion: 0.55, maintenance: 0.9,
    blurb: "Top of the food chain here.",
  }, 3),

  // Forest
  makeSpecies({
    id: "f-oak", name: "Oak Tree", emoji: "🌳", trophic: "producer", biome: "forest",
    birthRate: 0.45, deathRate: 0.02, carryingCapacity: 200, conversion: 0.5, maintenance: 0,
    blurb: "Feeds the forest with leaves and acorns.",
  }, 100),
  makeSpecies({
    id: "f-caterpillar", name: "Caterpillar", emoji: "🐛", trophic: "primary", biome: "forest",
    birthRate: 0, deathRate: 0.06, carryingCapacity: 110, conversion: 0.5, maintenance: 1.0,
    blurb: "Chews oak leaves all day.",
  }, 40),
  makeSpecies({
    id: "f-owl", name: "Owl", emoji: "🦉", trophic: "secondary", biome: "forest",
    birthRate: 0, deathRate: 0.05, carryingCapacity: 55, conversion: 0.5, maintenance: 0.95,
    blurb: "Hunts caterpillars at night.",
  }, 12),
  makeSpecies({
    id: "f-fox", name: "Fox", emoji: "🦊", trophic: "tertiary", biome: "forest",
    birthRate: 0, deathRate: 0.05, carryingCapacity: 25, conversion: 0.55, maintenance: 0.9,
    blurb: "Nips after owls and small prey.",
  }, 5),

  // Ocean
  makeSpecies({
    id: "o-phyto", name: "Phytoplankton", emoji: "🟢", trophic: "producer", biome: "ocean",
    birthRate: 0.6, deathRate: 0.02, carryingCapacity: 260, conversion: 0.5, maintenance: 0,
    blurb: "Tiny plant life drifting in sunlit water.",
  }, 120),
  makeSpecies({
    id: "o-krill", name: "Krill", emoji: "🦐", trophic: "primary", biome: "ocean",
    birthRate: 0, deathRate: 0.06, carryingCapacity: 130, conversion: 0.5, maintenance: 1.0,
    blurb: "Filters phytoplankton from the sea.",
  }, 50),
  makeSpecies({
    id: "o-fish", name: "Small Fish", emoji: "🐟", trophic: "secondary", biome: "ocean",
    birthRate: 0, deathRate: 0.05, carryingCapacity: 60, conversion: 0.5, maintenance: 0.95,
    blurb: "Schools together, feeding on krill.",
  }, 18),
  makeSpecies({
    id: "o-seal", name: "Seal", emoji: "🦭", trophic: "tertiary", biome: "ocean",
    birthRate: 0, deathRate: 0.05, carryingCapacity: 28, conversion: 0.55, maintenance: 0.9,
    blurb: "Dives deep for fish.",
  }, 6),
  makeSpecies({
    id: "o-orca", name: "Orca", emoji: "🐋", trophic: "apex", biome: "ocean",
    birthRate: 0, deathRate: 0.04, carryingCapacity: 12, conversion: 0.6, maintenance: 0.85,
    blurb: "Ruler of the waves.",
  }, 3),

  // Desert
  makeSpecies({
    id: "d-cactus", name: "Cactus", emoji: "🌵", trophic: "producer", biome: "desert",
    birthRate: 0.35, deathRate: 0.03, carryingCapacity: 140, conversion: 0.5, maintenance: 0,
    blurb: "Stores water in a harsh land.",
  }, 80),
  makeSpecies({
    id: "d-ant", name: "Ant", emoji: "🐜", trophic: "primary", biome: "desert",
    birthRate: 0, deathRate: 0.07, carryingCapacity: 100, conversion: 0.5, maintenance: 1.0,
    blurb: "Harvests cactus nectar.",
  }, 40),
  makeSpecies({
    id: "d-lizard", name: "Lizard", emoji: "🦎", trophic: "secondary", biome: "desert",
    birthRate: 0, deathRate: 0.06, carryingCapacity: 50, conversion: 0.5, maintenance: 0.95,
    blurb: "Snaps up ants in the sand.",
  }, 14),
  makeSpecies({
    id: "d-vulture", name: "Vulture", emoji: "🦅", trophic: "apex", biome: "desert",
    birthRate: 0, deathRate: 0.04, carryingCapacity: 14, conversion: 0.6, maintenance: 0.85,
    blurb: "Cleans up leftovers on the wing.",
  }, 3),
];

export function speciesByBiome(biome: string): GenesisSpecies[] {
  return GENESIS_SPECIES.filter((s) => s.biome === biome);
}

export const GENESIS_BIOMES = ["grassland", "forest", "ocean", "desert"] as const;

export function pickBiome(): string {
  return GENESIS_BIOMES[Math.floor(Math.random() * GENESIS_BIOMES.length)];
}

// ---------------------------------------------------------------------------
// Simulation engine
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * One step of the discrete dynamics.
 * Producers: logistic growth minus natural death.
 * Consumers: growth = (foodSupply − maintenance) × 0.3, minus natural death.
 * Food supply = Σ (prey population × prey conversion) over this species' arrows.
 */
export function stepEcosystem(
  species: GenesisSpecies[],
  arrows: GenesisArrow[],
): GenesisSpecies[] {
  const popMap = new Map(species.map((s) => [s.id, s.population]));
  const next = new Map<string, number>();

  for (const s of species) {
    const pop = popMap.get(s.id) ?? 0;
    if (pop <= 0) {
      next.set(s.id, 0);
      continue;
    }

    if (s.trophic === "producer") {
      const growth = pop * s.birthRate * (1 - pop / s.carryingCapacity);
      const nextPop = pop + growth - pop * s.deathRate;
      next.set(s.id, clamp(nextPop, 0, s.carryingCapacity * 1.6));
      continue;
    }

    // Consumers: food from prey populations via this species' arrows.
    const preyIds = arrows
      .filter(([eater, prey]) => eater === s.id)
      .map(([, prey]) => prey);
    const foodSupply = preyIds.reduce((sum, preyId) => {
      const prey = species.find((x) => x.id === preyId);
      if (!prey) return sum;
      const preyPop = popMap.get(preyId) ?? 0;
      return sum + preyPop * prey.conversion;
    }, 0);

    const needed = pop * s.maintenance;
    const surplus = foodSupply - needed;
    const growth = surplus * 0.3;
    // No food at all → accelerated starvation (visible rapid collapse).
    const starvation = foodSupply <= 0 ? 0.35 : 0;
    const nextPop = pop + growth - pop * s.deathRate - pop * starvation;
    next.set(s.id, clamp(nextPop, 0, s.carryingCapacity * 1.6));
  }

  return species.map((s) => ({
    ...s,
    population: Math.round(next.get(s.id) ?? 0),
  }));
}

/** Run a full simulation of GENESIS_STEPS steps. */
export function runGenesis(
  species: GenesisSpecies[],
  arrows: GenesisArrow[],
  steps = GENESIS_STEPS,
): GenesisRun {
  let current = species.map((s) => ({ ...s }));
  const snapshots: GenesisSnapshot[] = [];
  for (let step = 1; step <= steps; step++) {
    current = stepEcosystem(current, arrows);
    const populations: Record<string, number> = {};
    for (const s of current) populations[s.id] = s.population;
    snapshots.push({ step, populations, extinct: current.filter((s) => s.population <= 0).map((s) => s.id) });
  }

  const extinct = current.filter((s) => s.population <= 0).map((s) => s.id);
  const initialIds = new Set(species.map((s) => s.id));
  const extinctOfInitial = extinct.filter((id) => initialIds.has(id));
  // A web "survived" when every initial species is still above zero.
  const survived = extinctOfInitial.length === 0;
  const atRisk = current
    .filter((s) => s.population > 0 && s.population <= 2)
    .map((s) => s.id);

  return { snapshots, survived, extinct: extinctOfInitial, atRisk };
}

/** Does the current web predict survival over GENESIS_STEPS steps? */
export function predictSurvival(
  species: GenesisSpecies[],
  arrows: GenesisArrow[],
): boolean {
  return runGenesis(species, arrows, GENESIS_STEPS).survived;
}

/** Classification for the prediction prompt. */
export function predictionCategory(species: GenesisSpecies[]): GenesisPrediction {
  // Only producers → trivially survives (nothing eats them).
  const consumers = species.filter((s) => s.trophic !== "producer");
  if (consumers.length === 0) return "survive";
  const producers = species.filter((s) => s.trophic === "producer");
  if (producers.length === 0) return "collapse";
  return "mixed";
}

/** Classify the actual run result into the same categories. */
export function runResultCategory(run: GenesisRun): GenesisPrediction {
  if (run.survived) return "survive";
  const producers = run.snapshots[0]?.populations ?? {};
  // If producers are gone → hard collapse; otherwise mixed.
  return "mixed";
}

// ---------------------------------------------------------------------------
// Disaster events
// ---------------------------------------------------------------------------

function scaleAll(species: GenesisSpecies[], ids: string[], factor: number): GenesisSpecies[] {
  const set = new Set(ids);
  return species.map((s) =>
    set.has(s.id) ? { ...s, population: Math.max(0, Math.round(s.population * factor)) } : s,
  );
}

function addInvader(species: GenesisSpecies[], biome: string): GenesisSpecies[] {
  const invader: GenesisSpecies = {
    id: `${biome}-invader`,
    name: "Invasive Raccoon",
    emoji: "🦝",
    trophic: "tertiary",
    biome,
    population: 8,
    birthRate: 0,
    deathRate: 0.05,
    carryingCapacity: 40,
    conversion: 0.5,
    maintenance: 0.95,
    blurb: "Arrived by ship. Eats anything it can catch.",
  };
  return [...species, invader];
}

export const GENESIS_EVENTS: GenesisEvent[] = [
  {
    id: "drought",
    label: "Drought",
    blurb: "Three months without rain. Producers take a hard hit.",
    apply: (species) =>
      scaleAll(
        species,
        species.filter((s) => s.trophic === "producer").map((s) => s.id),
        0.4,
      ),
  },
  {
    id: "heatwave",
    label: "Heatwave",
    blurb: "Extreme heat slows everyone. All populations lose a little.",
    apply: (species) => scaleAll(species, species.map((s) => s.id), 0.85),
  },
  {
    id: "bumper-crop",
    label: "Bumper Season",
    blurb: "Perfect weather! Producers grow much faster.",
    apply: (species) =>
      scaleAll(
        species,
        species.filter((s) => s.trophic === "producer").map((s) => s.id),
        1.8,
      ),
  },
];

export function pickGenesisEvent(): GenesisEvent {
  return GENESIS_EVENTS[Math.floor(Math.random() * GENESIS_EVENTS.length)];
}

/** Apply a random disaster to a species set (for the disaster mini-round). */
export function applyGenesisEvent(
  species: GenesisSpecies[],
  event: GenesisEvent,
): GenesisSpecies[] {
  return event.apply(species);
}

export function addInvaderTo(biome: string): GenesisSpecies[] {
  const base = speciesByBiome(biome);
  return addInvader(base, biome);
}

// ---------------------------------------------------------------------------
// Arrow validation (for quick feedback while building)
// ---------------------------------------------------------------------------

export type ArrowCheck = {
  valid: boolean;
  /** Species id that is being eaten — used to show "this eats nothing valid". */
  issues: string[];
};

/**
 * Check that every consumer has at least one valid prey arrow pointing to
 * a species that actually exists in the habitat.
 */
export function validateGenesisArrows(
  species: GenesisSpecies[],
  arrows: GenesisArrow[],
): ArrowCheck {
  const ids = new Set(species.map((s) => s.id));
  const consumers = species.filter((s) => s.trophic !== "producer");
  const issues: string[] = [];
  for (const c of consumers) {
    const prey = arrows.filter(([eater]) => eater === c.id).map(([, p]) => p);
    if (prey.length === 0) {
      issues.push(c.id);
      continue;
    }
    if (prey.some((p) => !ids.has(p))) {
      issues.push(c.id);
    }
  }
  return { valid: issues.length === 0, issues };
}

/** BKT skill seed for a finished ecosystem. */
export function genesisSkillSeed(biome: string): string {
  return `ecosystem habitat ${biome} food chain predator prey producer consumer energy flow population dynamics`;
}
