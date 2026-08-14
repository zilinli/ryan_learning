/**
 * Orbit Scout — qualitative gravity (no Kepler). Pure functions.
 */

export type OrbitMissionKind = "drop" | "arc" | "always-down";

export type OrbitMission = {
  id: number;
  kind: OrbitMissionKind;
  difficulty: number;
  prompt: string;
  /** Target height band 0..bands-1 (arc). */
  targetBand?: number;
  bands: number;
  skill: "forces-motion" | "earth-moon-sun" | "physics-6-8";
};

export type OrbitAnswer = {
  push?: 1 | 2 | 3 | 4 | 5;
  predictedBand?: number;
  /** drop: which lands first — "light" | "heavy" | "same" */
  dropGuess?: "light" | "heavy" | "same";
  /** always-down: where gravity points */
  gravityDir?: "down" | "up" | "side";
};

export type OrbitResult = {
  correct: boolean;
  outcome: "correct" | "incorrect" | "practice";
  misconceptionId?: string;
  message: string;
  peakBand?: number;
};

export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.55) return 1;
  if (pKnown < 0.7) return 2;
  if (pKnown < 0.85) return 3;
  return 4;
}

let nextId = 1;

export function generateOrbitMission(
  kind: OrbitMissionKind,
  difficulty: number,
): OrbitMission {
  const bands = 4 + Math.min(2, difficulty);
  if (kind === "drop") {
    return {
      id: nextId++,
      kind,
      difficulty,
      prompt: "Drop a light craft and a heavy craft. Who hits the ground first?",
      bands,
      skill: "forces-motion",
    };
  }
  if (kind === "always-down") {
    return {
      id: nextId++,
      kind,
      difficulty,
      prompt: "Which way does gravity pull near this planet?",
      bands,
      skill: "earth-moon-sun",
    };
  }
  const targetBand = Math.min(bands - 1, 1 + Math.floor(difficulty / 2));
  return {
    id: nextId++,
    kind: "arc",
    difficulty,
    prompt: `Push up. Reach height band ${targetBand + 1} — gravity stays the same strength.`,
    targetBand,
    bands,
    skill: difficulty >= 3 ? "physics-6-8" : "forces-motion",
  };
}

/** Peak band from push strength; g is constant (does not grow while falling). */
export function peakBandFromPush(push: number, bands: number): number {
  return Math.max(0, Math.min(bands - 1, push - 1));
}

export function validateOrbitAnswer(
  mission: OrbitMission,
  answer: OrbitAnswer,
): OrbitResult {
  if (mission.kind === "drop") {
    const guess = answer.dropGuess ?? "heavy";
    if (guess === "same") {
      return {
        correct: true,
        outcome: "correct",
        message: "Same time. Gravity does not make heavy things fall faster here.",
      };
    }
    return {
      correct: false,
      outcome: "incorrect",
      misconceptionId: "phys-heavier-falls-faster",
      message: "They land together. Mass is not a race ticket.",
    };
  }

  if (mission.kind === "always-down") {
    if (answer.gravityDir === "down") {
      return {
        correct: true,
        outcome: "correct",
        message: "Toward the planet — always. The Moon does not push you away.",
      };
    }
    return {
      correct: false,
      outcome: "incorrect",
      misconceptionId: "science-earth-scale",
      message: "Gravity pulls down / toward the planet.",
    };
  }

  const push = answer.push ?? 1;
  const peak = peakBandFromPush(push, mission.bands);
  const target = mission.targetBand ?? 0;
  const hit = peak === target;
  const predicted = answer.predictedBand ?? -1;
  const predictedRight = predicted === target;

  if (hit && predictedRight) {
    return {
      correct: true,
      outcome: "correct",
      message: "Peak matched. Gravity stayed the same strength on the way up and down.",
      peakBand: peak,
    };
  }
  if (hit && !predictedRight) {
    return {
      correct: false,
      outcome: "practice",
      message: "You reached it — predict the band before the next push.",
      peakBand: peak,
      misconceptionId: "phys-gravity-gets-stronger",
    };
  }
  return {
    correct: false,
    outcome: "incorrect",
    misconceptionId: push > target + 2 ? "phys-more-force-always" : "phys-gravity-gets-stronger",
    message: "Change the push. Gravity does not grow stronger as you fall.",
    peakBand: peak,
  };
}

export function orbitSkillSeed(mission: OrbitMission): string {
  return `gravity force motion earth moon sun ${mission.kind} newton`;
}

export function orbitMissionLabel(kind: OrbitMissionKind): string {
  if (kind === "drop") return "Same drop";
  if (kind === "always-down") return "Gravity direction";
  return "Push height";
}
