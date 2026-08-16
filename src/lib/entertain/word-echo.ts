/**
 * Word Echo — memorize random words, then spell them from memory.
 * Pure functions only (no React).
 */

export type WordEchoSkill = "letter-sounds" | "reading-evidence";

export type HintMode = "blanks" | "length" | "none";

export type WordEchoRound = {
  id: number;
  difficulty: number;
  targets: string[];
  studyMs: number;
  hintMode: HintMode;
  skill: WordEchoSkill;
};

export type WordEchoSpellResult = {
  correct: boolean;
  outcome: "correct" | "incorrect";
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
  studyMs: number;
  hintMode: HintMode;
} {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  if (d === 1) return { targetCount: 2, studyMs: 6000, hintMode: "blanks" };
  if (d === 2) return { targetCount: 3, studyMs: 5500, hintMode: "blanks" };
  if (d === 3) return { targetCount: 3, studyMs: 5000, hintMode: "length" };
  if (d === 4) return { targetCount: 4, studyMs: 4500, hintMode: "none" };
  return { targetCount: 5, studyMs: 4000, hintMode: "none" };
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
  const skill: WordEchoSkill =
    difficulty >= 4 ? "reading-evidence" : "letter-sounds";
  return {
    id: nextId++,
    difficulty: Math.max(1, Math.min(5, Math.round(difficulty))),
    targets,
    studyMs: spec.studyMs,
    hintMode: spec.hintMode,
    skill,
  };
}

/** Trim, lowercase, keep a–z only. */
export function normalizeSpelling(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z]/g, "");
}

export function spellingHint(word: string, mode: HintMode): string {
  if (mode === "blanks") {
    return word
      .split("")
      .map(() => "_")
      .join(" ");
  }
  if (mode === "length") {
    return `${word.length} letters`;
  }
  return "";
}

export function validateSpelling(
  expected: string,
  typed: string,
): WordEchoSpellResult {
  const want = normalizeSpelling(expected);
  const got = normalizeSpelling(typed);
  if (!got) {
    return {
      correct: false,
      outcome: "incorrect",
      message: "Type the spelling, then check.",
    };
  }
  if (got === want) {
    return {
      correct: true,
      outcome: "correct",
      message: "Spelling matches. Echo clear.",
    };
  }
  if (got.length !== want.length) {
    return {
      correct: false,
      outcome: "incorrect",
      message:
        got.length < want.length
          ? "Too short — a letter may be missing."
          : "Too long — check for an extra letter.",
    };
  }
  return {
    correct: false,
    outcome: "incorrect",
    message: "Almost — one or more letters are off. Try again.",
  };
}

export function wordEchoSkillSeed(round: WordEchoRound): string {
  return `sight word vocabulary spelling reading phonics letter sound memory recall ${round.skill} ${round.targets.join(" ")}`;
}
