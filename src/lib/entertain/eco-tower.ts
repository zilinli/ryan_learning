/**
 * Eco Tower — game logic.
 * Tower construction, arrow validation, ecosystem simulation, disaster events.
 */

import { organismsByBiome, pickBiome, type OrganismCard, type TrophicLevel } from "./eco-cards";

const LEVEL_ORDER: TrophicLevel[] = [
  "producer",
  "primary_consumer",
  "secondary_consumer",
  "tertiary_consumer",
  "apex_predator",
];

export type EcoTowerState = {
  biome: string;
  /** Organism ids placed, indexed by trophic position (0=bottom/producer) */
  tower: Array<string | null>;
  /** Arrow pairs: [eaterId, eatenId] for energy flow direction */
  arrows: Array<[string, string]>;
  phase: "building" | "simulating" | "balanced" | "collapsed";
  disaster?: string;
};

export type DisasterEvent = {
  id: string;
  label: string;
  question: string;
  options: string[];
  correctIndex: number;
};

const DISASTERS: DisasterEvent[] = [
  {
    id: "sun-blocked",
    label: "The sun is blocked by dust!",
    question: "Which level is affected FIRST?",
    options: ["Producers (plants)", "Apex predators", "Primary consumers", "Tertiary consumers"],
    correctIndex: 0,
  },
  {
    id: "invasive-species",
    label: "An invasive species arrives!",
    question: "Where would a new predator fit in your tower?",
    options: ["At the bottom", "Above its prey", "Below its prey", "At the very top only"],
    correctIndex: 1,
  },
  {
    id: "drought",
    label: "A drought hits for 3 months!",
    question: "Who dies first?",
    options: ["Producers (plants)", "Primary consumers", "Secondary consumers", "Apex predators"],
    correctIndex: 0,
  },
];

export function initEcoTower(): EcoTowerState {
  const biome = pickBiome();
  return {
    biome,
    tower: [null, null, null, null, null],
    arrows: [],
    phase: "building",
  };
}

export function getAvailableOrganisms(biome: string): OrganismCard[] {
  return organismsByBiome(biome);
}

/**
 * Place an organism at a trophic level slot.
 * Returns the organism or null if invalid.
 */
export function placeOrganism(
  state: EcoTowerState,
  slotIndex: number,
  organismId: string,
): EcoTowerState | null {
  const orgs = organismsByBiome(state.biome);
  const org = orgs.find((o) => o.id === organismId);
  if (!org) return null;
  if (slotIndex < 0 || slotIndex >= 5) return null;
  // Check if organism is already placed
  if (state.tower.includes(organismId)) return null;

  const newTower = [...state.tower];
  newTower[slotIndex] = organismId;
  return { ...state, tower: newTower };
}

/**
 * Remove an organism from a slot.
 */
export function removeOrganism(state: EcoTowerState, organismId: string): EcoTowerState {
  return {
    ...state,
    tower: state.tower.map((id) => (id === organismId ? null : id)),
    arrows: state.arrows.filter(([a, b]) => a !== organismId && b !== organismId),
  };
}

/**
 * Toggle an arrow between two organisms (drawn FROM eater TO eaten).
 */
export function toggleArrow(
  state: EcoTowerState,
  fromId: string,
  toId: string,
): EcoTowerState {
  const existing = state.arrows.find(
    ([a, b]) => a === fromId && b === toId,
  );
  if (existing) {
    return { ...state, arrows: state.arrows.filter(([a, b]) => !(a === fromId && b === toId)) };
  }
  return { ...state, arrows: [...state.arrows, [fromId, toId]] };
}

/**
 * Validate the tower:
 * - All 5 slots filled?
 * - Arrows point in correct energy flow direction (from eater to eaten)?
 * - Correct trophic levels?
 */
export function validateTower(state: EcoTowerState): {
  valid: boolean;
  errors: string[];
  arrowErrors: string[];
} {
  const errors: string[] = [];
  const arrowErrors: string[] = [];
  const orgs = organismsByBiome(state.biome);
  const orgMap = new Map(orgs.map((o) => [o.id, o]));

  // Check if all slots filled
  if (state.tower.some((id) => id === null)) {
    errors.push("Not all tower slots are filled.");
  }

  // Check arrows direction (eater → eaten, energy flows from eaten to eater)
  for (const [eaterId, eatenId] of state.arrows) {
    const eater = orgMap.get(eaterId);
    const eaten = orgMap.get(eatenId);
    if (!eater || !eaten) continue;
    if (!eater.eats.includes(eatenId)) {
      // Check if arrow is reversed
      if (eaten.eats.includes(eaterId)) {
        arrowErrors.push("reversed");
      } else {
        arrowErrors.push("invalid");
      }
    }
  }

  // Check expected arrow count (each non-producer should have at least one food source)
  for (const [i, orgId] of state.tower.entries()) {
    if (!orgId) continue;
    const org = orgMap.get(orgId);
    if (!org) continue;
    if (org.trophicLevel !== "producer") {
      const hasArrow = state.arrows.some(([_, eaten]) => eaten === orgId);
      if (!hasArrow && state.tower.length > 1) {
        errors.push(`${org.name} has no food source arrow.`);
      }
    }
  }

  const valid = errors.length === 0 && arrowErrors.length === 0;
  return { valid, errors, arrowErrors };
}

/**
 * Run ecosystem simulation — returns whether the tower is balanced.
 */
export function runSimulation(state: EcoTowerState): { balanced: boolean; message: string } {
  const { valid, arrowErrors } = validateTower(state);
  if (!valid) {
    return { balanced: false, message: "Tower is incomplete. Fill all slots and connect the arrows." };
  }
  if (arrowErrors.includes("reversed")) {
    return { balanced: false, message: "Energy flows the wrong way! Arrows should point from eater to what it eats." };
  }
  return { balanced: true, message: "Your ecosystem is balanced! Energy flows correctly through every level." };
}

export function pickDisaster(): DisasterEvent {
  return DISASTERS[Math.floor(Math.random() * DISASTERS.length)];
}

export function checkDisasterAnswer(disaster: DisasterEvent, answerIndex: number): boolean {
  return answerIndex === disaster.correctIndex;
}
