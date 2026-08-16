/**
 * Word Echo — memorize random words, then recall among distractors.
 * Pure functions only (no React).
 */

export type WordEchoSkill = "letter-sounds" | "reading-evidence";

export type WordEchoRound = {
  id: number;
  difficulty: number;
  targets: string[];
  pool: string[];
  studyMs: number;
  requireOrder: boolean;
  skill: WordEchoSkill;
};

export type WordEchoResult = {
  correct: boolean;
  outcome: "correct" | "incorrect";
  missing: string[];
  extra: string[];
  message: string;
};

/** G4-friendly English bank — school, nature, home, action. */
export const WORD_BANK: readonly string[] = [
  "apple",
  "brave",
  "cloud",
  "dance",
  "eagle",
  "flame",
  "grape",
  "happy",
  "island",
  "jungle",
  "kitten",
  "lemon",
  "music",
  "night",
  "ocean",
  "pencil",
  "quiet",
  "river",
  "sunny",
  "tiger",
  "under",
  "violet",
  "water",
  "yellow",
  "zebra",
  "bridge",
  "candle",
  "dragon",
  "forest",
  "garden",
  "hammer",
  "invite",
  "jacket",
  "ladder",
  "magnet",
  "number",
  "orange",
  "planet",
  "rocket",
  "silver",
  "tunnel",
  "umbrella",
  "valley",
  "window",
  "yogurt",
  "anchor",
  "balloon",
  "camera",
  "desert",
  "engine",
  "feather",
  "glider",
  "harbor",
  "insect",
  "jewel",
  "kettle",
  "lantern",
  "marble",
  "needle",
  "orchid",
  "pirate",
  "quiver",
  "ribbon",
  "saddle",
  "turtle",
  "velvet",
  "whisper",
  "compass",
  "dolphin",
  "echo",
  "falcon",
  "glacier",
  "horizon",
  "iguana",
  "jasper",
  "koala",
  "lizard",
  "meadow",
  "nectar",
  "otter",
  "pebble",
  "quartz",
  "raven",
  "sparrow",
  "thunder",
  "urchin",
  "voyage",
  "willow",
  "crystal",
  "dawn",
  "ember",
  "frost",
  "glow",
  "hive",
  "ivory",
  "jade",
  "kite",
  "lotus",
  "moss",
  "nest",
] as const;

export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.3) return 1;
  if (pKnown < 0.5) return 2;
  if (pKnown < 0.7) return 3;
  if (pKnown < 0.85) return 4;
  return 5;
}

export function specForDifficulty(difficulty: number): {
  targetCount: number;
  distractorCount: number;
  studyMs: number;
  requireOrder: boolean;
} {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  return {
    targetCount: 2 + d, // 3..7
    distractorCount: 2 + d,
    studyMs: 5500 - d * 500, // 5000..3000
    requireOrder: d >= 4,
  };
}

let nextId = 1;

type Rng = () => number;

function defaultRng(): number {
  return Math.random();
}

export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function pickUnique(
  count: number,
  exclude: Set<string>,
  rng: Rng,
): string[] {
  const available = WORD_BANK.filter((w) => !exclude.has(w));
  if (available.length < count) {
    throw new Error(`Word bank too small for ${count} unique picks`);
  }
  const shuffled = shuffle(available, rng);
  return shuffled.slice(0, count);
}

export function pickRound(
  difficulty: number,
  rng: Rng = defaultRng,
): WordEchoRound {
  const spec = specForDifficulty(difficulty);
  const targets = pickUnique(spec.targetCount, new Set(), rng);
  const exclude = new Set(targets);
  const distractors = pickUnique(spec.distractorCount, exclude, rng);
  const pool = shuffle([...targets, ...distractors], rng);
  const skill: WordEchoSkill =
    difficulty >= 4 ? "reading-evidence" : "letter-sounds";
  return {
    id: nextId++,
    difficulty: Math.max(1, Math.min(5, Math.round(difficulty))),
    targets,
    pool,
    studyMs: spec.studyMs,
    requireOrder: spec.requireOrder,
    skill,
  };
}

export function validateEcho(
  round: WordEchoRound,
  selected: string[],
): WordEchoResult {
  const targetSet = new Set(round.targets);
  const selectedSet = new Set(selected);
  const missing = round.targets.filter((w) => !selectedSet.has(w));
  const extra = selected.filter((w) => !targetSet.has(w));

  if (round.requireOrder) {
    const sameLength = selected.length === round.targets.length;
    const orderOk =
      sameLength &&
      round.targets.every((w, i) => selected[i] === w) &&
      extra.length === 0;
    if (orderOk) {
      return {
        correct: true,
        outcome: "correct",
        missing: [],
        extra: [],
        message: "Exact order. The echo matches.",
      };
    }
    return {
      correct: false,
      outcome: "incorrect",
      missing,
      extra,
      message:
        missing.length || extra.length
          ? "Fix the set, then put words in the study order."
          : "Right words — tap them in the order you studied.",
    };
  }

  if (missing.length === 0 && extra.length === 0 && selected.length === round.targets.length) {
    return {
      correct: true,
      outcome: "correct",
      missing: [],
      extra: [],
      message: "All echoes found.",
    };
  }

  return {
    correct: false,
    outcome: "incorrect",
    missing,
    extra,
    message:
      missing.length && extra.length
        ? "Some words are missing and some do not belong."
        : missing.length
          ? "A few echoes are still missing."
          : "Drop the words that were not on the study list.",
  };
}

export function wordEchoSkillSeed(round: WordEchoRound): string {
  return `sight word vocabulary spelling reading phonics letter sound memory recall ${round.skill} ${round.targets.join(" ")}`;
}
