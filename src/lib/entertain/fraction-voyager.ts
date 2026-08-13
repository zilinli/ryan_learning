/**
 * Fraction Voyager — game logic (pure functions).
 * Number-line based fraction missions: place / compare / partition.
 * ZPD-adaptive difficulty from BKT pKnown, misconception detection.
 */

export type VoyagerMissionKind = "place" | "compare" | "partition";

export type VoyagerMission = {
  id: number;
  kind: VoyagerMissionKind;
  difficulty: number;
  /** Human-readable prompt shown in the mission card. */
  prompt: string;
  /** Target fraction [numerator, denominator]. */
  target: [number, number];
  /** Number line length: 1 or 2 (2 allows improper >1 fractions). */
  lineMax: number;
  /** Ticks on the number line (place missions). */
  ticks: number;
  /** Compare missions: two fraction bars, one is bigger. */
  compareLeft?: [number, number];
  compareRight?: [number, number];
  /** True if the left bar is bigger (compare). */
  leftIsBigger?: boolean;
  /** Partition missions: current bar [num, den] and target equivalent. */
  bar?: [number, number];
  /** How many equal pieces the bar should be split into (partition). */
  pieceCount?: number;
  /** How many pieces to fill to match the target (partition). */
  fillCount?: number;
  /** Which skill this mission trains (for BKT seed). */
  skill: "fractions-concepts" | "equivalent-fractions" | "fraction-word-problems";
};

export type VoyagerAnswer = {
  kind: VoyagerMissionKind;
  /** place: selected tick index (0..ticks). */
  placeTick?: number;
  /** compare: "left" | "right". */
  comparePick?: "left" | "right";
  /** partition: filled piece count. */
  fillCount?: number;
};

export type VoyagerResult = {
  correct: boolean;
  /** Detected misconception id (one of the frac-* labels). */
  misconceptionId?: string;
  /** Message for the UI (visual consequence text). */
  message: string;
};

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function simplify([n, d]: [number, number]): [number, number] {
  const g = gcd(n, d);
  return [n / g, d / g];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Tick index closest to a fraction value on a number line. */
export function tickForFraction(
  num: number,
  den: number,
  ticks: number,
  lineMax = 1,
): number {
  const value = num / den;
  const position = value / lineMax; // 0..1 across the whole line
  return Math.max(0, Math.min(ticks, Math.round(position * ticks)));
}

/**
 * Map pKnown → difficulty 1–5 (ZPD: p≈0.7 optimal).
 * 1 = unit fractions on 0–1; 5 = improper fractions on 0–2 with partitions.
 */
export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.3) return 1;
  if (pKnown < 0.5) return 2;
  if (pKnown < 0.7) return 3;
  if (pKnown < 0.85) return 4;
  return 5;
}

/** Denominator pools by difficulty (concrete → abstract). */
function denomPool(difficulty: number): number[] {
  switch (difficulty) {
    case 1: return [2, 3, 4];
    case 2: return [2, 3, 4, 6];
    case 3: return [3, 4, 6, 8];
    case 4: return [4, 6, 8, 10];
    default: return [4, 6, 8, 10, 12];
  }
}

/** Generate a mission of the given kind at the given difficulty. */
export function generateMission(
  kind: VoyagerMissionKind,
  difficulty: number,
  id = Date.now() + Math.floor(Math.random() * 10000),
): VoyagerMission {
  const d = Math.max(1, Math.min(5, difficulty));

  if (kind === "compare") {
    const den = pick(denomPool(d));
    const n1 = randInt(1, den - 1);
    const n2 = randInt(1, den - 1);
    const left: [number, number] = [n1, den];
    const right: [number, number] = [n2, den];
    const leftIsBigger = n1 > n2;
    const bigger = leftIsBigger ? left : right;
    const smaller = leftIsBigger ? right : left;
    return {
      id,
      kind,
      difficulty: d,
      prompt: leftIsBigger
        ? `Which fuel tank holds more? ${n1}/${den} or ${n2}/${den}?`
        : `Which fuel tank holds more? ${n1}/${den} or ${n2}/${den}?`,
      target: bigger,
      lineMax: 1,
      ticks: den * 2,
      compareLeft: left,
      compareRight: right,
      leftIsBigger,
      skill: "fractions-concepts",
    };
  }

  if (kind === "partition") {
    // Show a bar representing target; student slices to an equivalent fraction.
    const den = pick(denomPool(d));
    const num = randInt(1, den - 1);
    // Choose an equivalent denominator via scaling.
    const scale = pick(d >= 4 ? [2, 3] : [2]);
    const newDen = den * scale;
    const newNum = num * scale;
    const target: [number, number] = [num, den];
    const bar: [number, number] = [num, den];
    return {
      id,
      kind,
      difficulty: d,
      prompt: `The forge needs ${num}/${den} of a bar. Slice the bar into ${newDen} equal pieces and fill the right amount.`,
      target,
      lineMax: 1,
      ticks: newDen,
      bar,
      pieceCount: newDen,
      fillCount: newNum,
      skill: "equivalent-fractions",
    };
  }

  // place: locate a fraction on the number line.
  const den = pick(denomPool(d));
  const lineMax = d >= 4 && Math.random() < 0.5 ? 2 : 1;
  const num =
    lineMax > 1
      ? randInt(1, den * 2 - 1)
      : randInt(1, den - 1);
  const ticks = lineMax > 1 ? den * 2 : den;
  return {
    id,
    kind,
    difficulty: d,
    prompt: lineMax > 1
      ? `Fly to ${num}/${den} on the fuel gauge.`
      : `Fly to ${num}/${den} on the fuel gauge.`,
    target: [num, den],
    lineMax,
    ticks,
    skill: "fractions-concepts",
  };
}

/**
 * Validate a mission answer. Returns correctness, misconception, message.
 * AUC-friendly: caller shows the message and lets the student retry.
 */
export function validateVoyagerAnswer(
  mission: VoyagerMission,
  answer: VoyagerAnswer,
): VoyagerResult {
  if (mission.kind === "compare" && answer.kind === "compare") {
    if (answer.comparePick === "left") {
      const correct = mission.leftIsBigger === true;
      return correct
        ? { correct: true, message: "Correct! That tank holds more fuel." }
        : { correct: false, misconceptionId: "frac-bigger-denom", message: "That tank holds LESS — a smaller denominator means bigger pieces." };
    }
    if (answer.comparePick === "right") {
      const correct = mission.leftIsBigger === false;
      return correct
        ? { correct: true, message: "Correct! That tank holds more fuel." }
        : { correct: false, misconceptionId: "frac-bigger-denom", message: "That tank holds LESS — a smaller denominator means bigger pieces." };
    }
    return { correct: false, message: "Pick one fuel tank." };
  }

  if (mission.kind === "partition" && answer.kind === "partition") {
    const target = simplify(mission.target);
    const user = simplify([answer.fillCount ?? 0, mission.pieceCount ?? 1]);
    const correct = user[0] === target[0] && user[1] === target[1];
    if (correct) {
      return { correct: true, message: "Perfect slice! Same amount, new look." };
    }
    // Common: filled the full bar (thinking more pieces = more).
    if ((answer.fillCount ?? 0) === (mission.pieceCount ?? 1)) {
      return {
        correct: false,
        misconceptionId: "frac-whole-vs-part",
        message: "You filled the WHOLE bar — you want a part of it.",
      };
    }
    return {
      correct: false,
      message: "Fill exactly the number of slices that matches the target amount.",
    };
  }

  if (mission.kind === "place" && answer.kind === "place") {
    const expected = tickForFraction(
      mission.target[0],
      mission.target[1],
      mission.ticks,
      mission.lineMax,
    );
    const got = answer.placeTick ?? -1;
    const correct = got === expected;
    if (correct) {
      return { correct: true, message: "Landed right on target!" };
    }
    // Misconceptions:
    const targetVal = (mission.target[0] / mission.target[1]) * mission.lineMax;
    const gotVal = got / mission.ticks;
    if (targetVal < 1 && gotVal >= 1) {
      return {
        correct: false,
        misconceptionId: "frac-whole-vs-part",
        message: "You flew past the whole — that fraction is less than 1.",
      };
    }
    if (got < expected) {
      return {
        correct: false,
        misconceptionId: "frac-bigger-denom",
        message: "Too far back — bigger numerator means farther along the line.",
      };
    }
    return {
      correct: false,
      message: "Too far forward — check the equal parts on the gauge.",
    };
  }

  return { correct: false, message: "Finish the mission first." };
}

/** BKT skill seed from mission. */
export function voyagerSkillSeed(mission: VoyagerMission): string {
  const frac = `${mission.target[0]}/${mission.target[1]}`;
  switch (mission.kind) {
    case "compare":
      return `fractions concepts comparing ${frac} bigger smaller denominator number line`;
    case "partition":
      return `fractions concepts equivalent fractions ${frac} slice partition equal parts number line`;
    default:
      return `fractions concepts number line place locate ${frac} magnitude`;
  }
}

/** One-line mission flavor for the top bar. */
export function voyagerMissionLabel(kind: VoyagerMissionKind): string {
  switch (kind) {
    case "place": return "Navigate";
    case "compare": return "Compare";
    case "partition": return "Partition";
  }
}
