/**
 * Force Bay — discrete 1D force / motion missions (pure functions).
 * Mechanic is the lesson: force arrows, predict a dock, then run a stepper.
 */

export type BayMissionKind = "push" | "balance" | "collide" | "mass" | "ramp";

export type ForceArrow = {
  dir: -1 | 1;
  strength: 1 | 2 | 3 | 4 | 5;
};

export type BayMission = {
  id: number;
  kind: BayMissionKind;
  difficulty: number;
  prompt: string;
  /** Number of landing docks (zones), left → right. */
  docks: number;
  /** Target dock index 0..docks-1. */
  targetDock: number;
  /** Starting dock of the player craft. */
  startDock: number;
  mass: 1 | 2 | 3;
  friction: number;
  /** For collide: parked craft dock. */
  parkedDock?: number;
  parkedMass?: 1 | 2 | 3;
  skill: "forces-motion" | "physics-6-8" | "energy-transfer";
};

export type BayAnswer = {
  arrows: ForceArrow[];
  predictedDock: number;
  /** collide: which craft the student thinks ends at the target (mover | parked | both). */
  collideGuess?: "mover" | "parked" | "both";
  /** mass: which craft travels farther ("light" | "heavy"). */
  massGuess?: "light" | "heavy";
};

export type BayRun = {
  snapshots: number[][];
  landedDock: number;
  parkedLandedDock?: number;
  moverStopped: boolean;
};

export type BayResult = {
  correct: boolean;
  outcome: "correct" | "incorrect" | "practice";
  misconceptionId?: string;
  message: string;
  run: BayRun;
};

export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.3) return 1;
  if (pKnown < 0.5) return 2;
  if (pKnown < 0.7) return 3;
  if (pKnown < 0.85) return 4;
  return 5;
}

export function kindsForDifficulty(d: number): BayMissionKind[] {
  if (d <= 1) return ["push"];
  if (d === 2) return ["push", "balance"];
  if (d === 3) return ["push", "balance", "collide"];
  if (d === 4) return ["push", "balance", "collide", "mass"];
  return ["push", "balance", "collide", "mass", "ramp"];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let nextId = 1;

export function generateBayMission(
  kind: BayMissionKind,
  difficulty: number,
): BayMission {
  const docks = difficulty <= 1 ? 3 : difficulty <= 3 ? 4 : 5;
  const startDock = 0;
  const friction = kind === "ramp" ? 0.08 : 0;
  const skill =
    difficulty >= 4 ? "physics-6-8" : kind === "ramp" ? "energy-transfer" : "forces-motion";

  if (kind === "balance") {
    return {
      id: nextId++,
      kind,
      difficulty,
      prompt: "Two arrows pull this barge. Will it stay, or creep to a dock?",
      docks,
      targetDock: startDock,
      startDock,
      mass: 1,
      friction,
      skill: "forces-motion",
    };
  }

  if (kind === "collide") {
    const parkedDock = Math.min(docks - 2, 2);
    return {
      id: nextId++,
      kind,
      difficulty,
      prompt: "A moving barge hits a parked one (same mass). Who ends at the far dock?",
      docks,
      targetDock: Math.min(docks - 1, parkedDock + 1),
      startDock,
      mass: 1,
      friction,
      parkedDock,
      parkedMass: 1,
      skill: "forces-motion",
    };
  }

  if (kind === "mass") {
    return {
      id: nextId++,
      kind,
      difficulty,
      prompt: "Same push. Which craft travels farther — light or heavy?",
      docks,
      targetDock: docks - 1,
      startDock,
      mass: 1,
      friction: 0.12,
      parkedMass: 3,
      skill: difficulty >= 4 ? "physics-6-8" : "forces-motion",
    };
  }

  if (kind === "ramp") {
    return {
      id: nextId++,
      kind,
      difficulty,
      prompt: "A taller start gives more motion energy. Land on the far dock.",
      docks,
      targetDock: docks - 1,
      startDock,
      mass: 1,
      friction,
      skill: "energy-transfer",
    };
  }

  const targetDock = pick([...Array(docks - 1)].map((_, i) => i + 1));
  return {
    id: nextId++,
    kind: "push",
    difficulty,
    prompt: `Give this barge one push so it parks at dock ${targetDock + 1}.`,
    docks,
    targetDock,
    startDock,
    mass: 1,
    friction,
    skill,
  };
}

export function netForce(arrows: ForceArrow[]): number {
  return arrows.reduce((s, a) => s + a.dir * a.strength, 0);
}

function dockFromX(x: number, docks: number): number {
  return Math.max(0, Math.min(docks - 1, Math.round(x)));
}

/**
 * Integer-friendly 1D stepper. Position is in dock units.
 * a = F / mass; v += a * 0.25; x += v; optional friction.
 */
export function runBay(
  mission: BayMission,
  arrows: ForceArrow[],
  steps = 12,
): BayRun {
  const f = netForce(arrows);
  let x = mission.startDock;
  let v = 0;
  const snapshots: number[][] = [];
  let parkedX = mission.parkedDock ?? -1;
  let parkedV = 0;
  let collided = false;

  // Impulse on the first tick, then coast — "a push", not a continuous rocket.
  v += f / Math.max(1, mission.mass);

  for (let i = 0; i < steps; i++) {
    v *= 1 - mission.friction;
    x += v;
    if (x < 0) {
      x = 0;
      v = 0;
    }
    if (x > mission.docks - 1) {
      x = mission.docks - 1;
      v = 0;
    }

    if (
      mission.kind === "collide" &&
      mission.parkedDock != null &&
      !collided &&
      x >= mission.parkedDock - 0.15
    ) {
      // Equal-mass elastic 1D: velocities swap. Mover stops, parked takes v.
      parkedV = v;
      v = 0;
      x = mission.parkedDock;
      collided = true;
    }
    if (mission.kind === "collide" && collided) {
      parkedX += parkedV;
      parkedV *= 1 - mission.friction;
      if (parkedX > mission.docks - 1) {
        parkedX = mission.docks - 1;
        parkedV = 0;
      }
    }
    snapshots.push(
      mission.kind === "collide" ? [x, parkedX] : [x],
    );
    if (Math.abs(v) < 0.02 && Math.abs(parkedV) < 0.02 && i > 3) break;
  }

  return {
    snapshots,
    landedDock: dockFromX(x, mission.docks),
    parkedLandedDock:
      mission.kind === "collide" ? dockFromX(parkedX, mission.docks) : undefined,
    moverStopped: Math.abs(v) < 0.05,
  };
}

function collideWhoMoved(run: BayRun, mission: BayMission): "mover" | "parked" | "both" {
  const moverMoved = run.landedDock !== mission.startDock;
  const parkedMoved =
    mission.parkedDock != null && run.parkedLandedDock !== mission.parkedDock;
  if (moverMoved && parkedMoved) return "both";
  if (parkedMoved) return "parked";
  return "mover";
}

export function validateBayAnswer(mission: BayMission, answer: BayAnswer): BayResult {
  const run = runBay(mission, answer.arrows);
  const f = netForce(answer.arrows);

  if (mission.kind === "balance") {
    const stayed = run.landedDock === mission.startDock;
    const balanced = f === 0 && answer.arrows.length >= 2;
    if (stayed && balanced && answer.predictedDock === mission.startDock) {
      return {
        correct: true,
        outcome: "correct",
        message: "Net force is zero — the barge stays. Forces can still be there.",
        run,
      };
    }
    if (stayed && answer.predictedDock !== mission.startDock) {
      return {
        correct: false,
        outcome: "practice",
        misconceptionId: "phys-balanced-still-force",
        message: "It stayed — but say that *before* you run. Still objects can have forces.",
        run,
      };
    }
    return {
      correct: false,
      outcome: "incorrect",
      misconceptionId: f === 0 ? "phys-balanced-still-force" : undefined,
      message: "Unbalanced arrows make it creep. Match the two strengths to stay put.",
      run,
    };
  }

  if (mission.kind === "collide") {
    const who = collideWhoMoved(run, mission);
    const guess = answer.collideGuess ?? "mover";
    const parkedHitTarget =
      run.parkedLandedDock === mission.targetDock ||
      (run.parkedLandedDock ?? 0) > (mission.parkedDock ?? 0);
    if (guess === "parked" && who === "parked" && parkedHitTarget) {
      return {
        correct: true,
        outcome: "correct",
        message: "Same mass: the mover stops, the parked barge takes the motion.",
        run,
      };
    }
    return {
      correct: false,
      outcome: "incorrect",
      misconceptionId: guess === "mover" || guess === "both" ? "phys-force-to-keep-moving" : undefined,
      message: "Equal mass collision: motion jumps to the parked barge. The mover does not keep going.",
      run,
    };
  }

  if (mission.kind === "mass") {
    const lightRun = runBay({ ...mission, mass: 1, friction: 0.12 }, answer.arrows);
    const heavyRun = runBay({ ...mission, mass: 3, friction: 0.12 }, answer.arrows);
    const lightFarther = lightRun.landedDock >= heavyRun.landedDock;
    const guess = answer.massGuess ?? "heavy";
    if (guess === "light" && lightFarther && f > 0) {
      return {
        correct: true,
        outcome: "correct",
        message: "Same push: the light craft goes farther. Mass is not 'always faster'.",
        run: lightRun,
      };
    }
    return {
      correct: false,
      outcome: "incorrect",
      misconceptionId: guess === "heavy" ? "phys-heavier-faster" : "phys-more-force-always",
      message: "Same chevrons, heavier mass → less speed. Pick the light craft.",
      run: lightRun,
    };
  }

  const landed = run.landedDock;
  const predicted = answer.predictedDock;
  const hit = landed === mission.targetDock;
  const predictedRight = predicted === mission.targetDock;

  if (hit && predictedRight) {
    return {
      correct: true,
      outcome: "correct",
      message: "Docked. Unbalanced force made it move, then it coasted.",
      run,
    };
  }
  if (hit && !predictedRight) {
    return {
      correct: false,
      outcome: "practice",
      message: "Lucky dock — say the dock *before* the next run.",
      run,
    };
  }

  let misconceptionId: string | undefined;
  if (f === 0) misconceptionId = "phys-force-to-keep-moving";
  else if (landed > mission.targetDock && answer.arrows.every((a) => a.strength >= 4)) {
    misconceptionId = "phys-more-force-always";
  }

  return {
    correct: false,
    outcome: "incorrect",
    misconceptionId,
    message:
      f === 0
        ? "No net push — it stays. Give it an unbalanced arrow."
        : "Missed the dock. Change the chevron strength and try again.",
    run,
  };
}

export function baySkillSeed(mission: BayMission): string {
  const extra =
    mission.skill === "physics-6-8"
      ? "newton inertia momentum gravity"
      : mission.skill === "energy-transfer"
        ? "energy transfer kinetic potential convert energy"
        : "force motion push collide balanced net force";
  return `${extra} ${mission.kind} dock`;
}

export function bayMissionLabel(kind: BayMissionKind): string {
  if (kind === "push") return "One push";
  if (kind === "balance") return "Balance";
  if (kind === "collide") return "Collision";
  if (kind === "mass") return "Light vs heavy";
  return "Ramp energy";
}
