/**
 * Energy Chain — discrete energy-conversion build → predict → simulate.
 */

export type EnergyTile =
  | "height"
  | "spring"
  | "motion"
  | "heat"
  | "sound"
  | "light"
  | "battery"
  | "bell";

export type EnergyChainMission = {
  id: number;
  difficulty: number;
  goal: "bell" | "light";
  prompt: string;
  pool: EnergyTile[];
};

export type EnergyChainResult = {
  correct: boolean;
  outcome: "correct" | "incorrect";
  misconceptionId?: string;
  message: string;
  leaked: boolean;
  path: EnergyTile[];
};

/** Legal one-step conversions (simplified G4 model). */
export const ENERGY_EDGES: Array<[EnergyTile, EnergyTile]> = [
  ["height", "motion"],
  ["spring", "motion"],
  ["battery", "light"],
  ["battery", "motion"],
  ["motion", "heat"],
  ["motion", "sound"],
  ["motion", "bell"],
  ["motion", "light"],
  ["heat", "sound"],
];

const EDGE_SET = new Set(ENERGY_EDGES.map(([a, b]) => `${a}->${b}`));

export function canConvert(from: EnergyTile, to: EnergyTile): boolean {
  return EDGE_SET.has(`${from}->${to}`);
}

export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.4) return 1;
  if (pKnown < 0.6) return 2;
  if (pKnown < 0.8) return 3;
  return 4;
}

let nextId = 1;

export function generateEnergyMission(difficulty: number): EnergyChainMission {
  const goal: "bell" | "light" = difficulty >= 3 && Math.random() < 0.4 ? "light" : "bell";
  const pool: EnergyTile[] =
    difficulty <= 1
      ? ["height", "motion", "bell", "heat"]
      : difficulty === 2
        ? ["height", "spring", "motion", "bell", "heat", "sound"]
        : ["height", "spring", "battery", "motion", "bell", "light", "heat", "sound"];
  return {
    id: nextId++,
    difficulty,
    goal,
    prompt:
      goal === "bell"
        ? "Snap a chain that rings the bell. Energy must convert step by step."
        : "Snap a chain that lights the lamp.",
    pool,
  };
}

export function validateEnergyChain(
  mission: EnergyChainMission,
  path: EnergyTile[],
  prediction: "works" | "fails",
): EnergyChainResult {
  if (path.length < 2) {
    return {
      correct: false,
      outcome: "incorrect",
      message: "Need at least two tiles in the chain.",
      leaked: true,
      path,
    };
  }

  let leaked = false;
  for (let i = 0; i < path.length - 1; i++) {
    if (!canConvert(path[i]!, path[i + 1]!)) {
      leaked = true;
      break;
    }
  }
  const endsRight = path[path.length - 1] === mission.goal;
  const startsOk =
    path[0] === "height" || path[0] === "spring" || path[0] === "battery";
  const works = !leaked && endsRight && startsOk;
  const predictedRight = (prediction === "works") === works;

  if (works && predictedRight) {
    return {
      correct: true,
      outcome: "correct",
      message: "Energy moved along the chain — it did not disappear.",
      leaked: false,
      path,
    };
  }

  if (!works && prediction === "fails" && leaked) {
    return {
      correct: true,
      outcome: "correct",
      misconceptionId: undefined,
      message: "Right call — that jump leaks energy. Fix the conversion.",
      leaked: true,
      path,
    };
  }

  return {
    correct: false,
    outcome: "incorrect",
    misconceptionId: leaked || !endsRight ? "phys-energy-used-up" : undefined,
    message: leaked
      ? "Energy cannot jump that way — it converts, it does not vanish."
      : predictedRight
        ? "Chain shape is off. Check the start and the goal tile."
        : "Predict again after you fix the tiles.",
    leaked,
    path,
  };
}

export function energySkillSeed(mission: EnergyChainMission): string {
  return `energy transfer kinetic potential convert energy chain ${mission.goal}`;
}
