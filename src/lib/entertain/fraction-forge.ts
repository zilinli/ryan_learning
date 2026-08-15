/**
 * Fraction Forge — game logic (pure functions).
 * ZPD-adaptive recipe generation, fraction validation, misconception detection.
 */

export type FractionOp = "add" | "subtract" | "multiply_int" | "share";

export type FractionRecipe = {
  id: number;
  name: string;
  op: FractionOp;
  /** Visual fraction display: [numerator, denominator] pairs */
  parts: Array<[number, number]>;
  /** Expected answer as [numerator, denominator] (simplified) */
  answer: [number, number];
  question: string;
  /** Difficulty 1-5 */
  difficulty: number;
};

export type ForgeState = {
  level: number;
  score: number;
  streak: number;
  currentRecipe: FractionRecipe | null;
  history: Array<{ recipe: FractionRecipe; success: boolean }>;
  phase: "idle" | "crafting" | "forged" | "defect";
};

/** Greatest common divisor */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** Simplify [num, den] */
function simplify([n, d]: [number, number]): [number, number] {
  const g = gcd(n, d);
  return [n / g, d / g];
}

/** Least common multiple */
function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a recipe at the given difficulty level */
export function generateRecipe(difficulty: number): FractionRecipe {
  const d = Math.max(1, Math.min(5, difficulty));
  const id = Date.now() + Math.floor(Math.random() * 10000);

  if (d === 1) {
    // Same denominator, simple addition
    const den = pick([2, 3, 4]);
    const n1 = randInt(1, den - 1);
    const n2 = randInt(1, den - n1);
    const sum = n1 + n2;
    const simplified = simplify([sum, den]);
    return {
      id,
      name: pick(["Iron Blade", "Wood Shield", "Stone Helm", "Copper Ring"]),
      op: "add",
      parts: [[n1, den], [n2, den]],
      answer: simplified,
      question: `${n1}/${den} + ${n2}/${den} = ?`,
      difficulty: d,
    };
  }

  if (d === 2) {
    // Same denominator, larger range, or subtraction
    const den = pick([4, 6, 8, 10]);
    const n1 = randInt(2, den - 1);
    const n2 = randInt(1, n1 - 1);
    const diff = n1 - n2;
    const simplified = simplify([diff, den]);
    return {
      id,
      name: pick(["Iron Shield", "Crystal Amulet", "Leather Boots"]),
      op: "subtract",
      parts: [[n1, den], [n2, den]],
      answer: simplified,
      question: `${n1}/${den} - ${n2}/${den} = ?`,
      difficulty: d,
    };
  }

  if (d === 3) {
    // Different denominators, small
    const d1 = pick([2, 3, 4]);
    const d2 = pick([3, 4, 5, 6]);
    const n1 = randInt(1, d1 - 1);
    const n2 = randInt(1, d2 - 1);
    const common = lcm(d1, d2);
    const sumNum = n1 * (common / d1) + n2 * (common / d2);
    const simplified = simplify([sumNum, common]);
    return {
      id,
      name: pick(["Flame Sword", "Frost Bow", "Storm Staff"]),
      op: "add",
      parts: [[n1, d1], [n2, d2]],
      answer: simplified,
      question: `${n1}/${d1} + ${n2}/${d2} = ?`,
      difficulty: d,
    };
  }

  if (d === 4) {
    // Multiply integer × fraction
    const den = pick([2, 3, 4, 5, 6]);
    const n = randInt(1, den - 1);
    const mul = randInt(2, 5);
    const product = n * mul;
    const simplified = simplify([product, den]);
    return {
      id,
      name: pick(["Dragon Scale Mail", "Phoenix Talon", "Titan Gauntlet"]),
      op: "multiply_int",
      parts: [[mul, 1], [n, den]],
      answer: simplified,
      question: `${mul} batches × ${n}/${den} kg = ?`,
      difficulty: d,
    };
  }

  // d === 5: Mix of subtraction with different denominators
  const d1 = pick([3, 4, 6, 8]);
  const d2 = pick([3, 5, 6, 8, 9]);
  const n1Num = randInt(2, d1 - 1);
  const common = lcm(d1, d2);
  const n2Raw = randInt(1, Math.floor((n1Num * (common / d1)) / (common / d2)) - 1);
  const n2 = Math.max(1, n2Raw);
  const diffNum = n1Num * (common / d1) - n2 * (common / d2);
  const simplified = simplify([diffNum, common]);
  return {
    id,
    name: pick(["Obsidian Blade", "Aether Staff", "Void Armor"]),
    op: "subtract",
    parts: [[n1Num, d1], [n2, d2]],
    answer: simplified,
    question: `${n1Num}/${d1} - ${n2}/${d2} = ?`,
    difficulty: d,
  };
}

/**
 * Validate a user answer and detect misconceptions.
 * Returns { correct, misconceptionId? }
 */
export function validateCraft(
  recipe: FractionRecipe,
  userNum: number,
  userDen: number,
): { correct: boolean; misconceptionId?: string } {
  const expected = simplify(recipe.answer);
  const user = simplify([userNum, userDen]);
  const correct = user[0] === expected[0] && user[1] === expected[1];

  if (correct) return { correct: true };

  // Detect specific misconceptions
  if (recipe.op === "add" || recipe.op === "subtract") {
    // frac-add-denom: adding numerators AND denominators
    if (recipe.parts.length === 2) {
      const denomSum = recipe.parts[0][1] + recipe.parts[1][1];
      const numResult = recipe.op === "add"
        ? recipe.parts[0][0] + recipe.parts[1][0]
        : recipe.parts[0][0] - recipe.parts[1][0];
      const bad = simplify([numResult, denomSum]);
      if (user[0] === bad[0] && user[1] === bad[1]) {
        return { correct: false, misconceptionId: "frac-add-denom" };
      }
    }

    // frac-bigger-denom: if denominators differ and user chose the bigger denominator as "bigger"
    if (recipe.parts.length === 2 && recipe.parts[0][1] !== recipe.parts[1][1]) {
      const bigger = Math.max(recipe.parts[0][1], recipe.parts[1][1]);
      const smaller = Math.min(recipe.parts[0][1], recipe.parts[1][1]);
      // Check if user's answer uses the bigger denominator directly (common error)
      const userSimplified = simplify([userNum, userDen]);
      if (userSimplified[1] === bigger && userSimplified[1] !== expected[1]) {
        return { correct: false, misconceptionId: "frac-bigger-denom" };
      }
    }

    // frac-whole-vs-part: answer > 1 where expected but user gave < 1 (or vice versa)
    const userVal = userNum / userDen;
    const expectedVal = expected[0] / expected[1];
    if ((expectedVal >= 1 && userVal < 1) || (expectedVal < 1 && userVal >= 1)) {
      return { correct: false, misconceptionId: "frac-whole-vs-part" };
    }
  }

  if (recipe.op === "multiply_int") {
    // frac-of-set: user may have divided instead of multiplied
    const mul = recipe.parts[0][0];
    const n = recipe.parts[1][0];
    const d = recipe.parts[1][1];
    const divided = simplify([n, d * mul]);
    if (user[0] === divided[0] && user[1] === divided[1]) {
      return { correct: false, misconceptionId: "frac-of-set" };
    }
  }

  return { correct: false };
}

/**
 * Map pKnown to difficulty level for ZPD-adaptive generation.
 * P≈0.7 is optimal ZPD.
 */
export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.3) return 1;
  if (pKnown < 0.5) return 2;
  if (pKnown < 0.7) return 3;
  if (pKnown < 0.85) return 4;
  return 5;
}

/** Get fraction-related skill text seed for BKT integration */
export function fractionSkillSeed(recipe: FractionRecipe): string {
  return `fractions concepts equivalent fractions ${recipe.op === "add" ? "addition" : recipe.op === "subtract" ? "subtraction" : recipe.op === "multiply_int" ? "multiplication" : "division"} ${recipe.parts.map(p => `${p[0]}/${p[1]}`).join(" ")}`;
}
