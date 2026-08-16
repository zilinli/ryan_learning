/**
 * Spell Words (id: word-echo) — peek one word, hear it, then spell it.
 * Pure functions only (no React).
 */

export type WordEchoSkill = "letter-sounds" | "reading-evidence";

export type HintMode = "blanks" | "length" | "none";

export type WordEchoRound = {
  id: number;
  difficulty: number;
  targets: string[];
  /** Per-word peek duration before spell (not a whole-list study timer). */
  peekMs: number;
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

/** Short meaning cues — identify the lemma without printing its letters. */
export const WORD_GLOSS: Readonly<Record<string, string>> = {
  apple: "a crunchy red fruit",
  brave: "not afraid",
  cloud: "white fluff in the sky",
  dance: "move to a beat",
  eagle: "a large hunting bird",
  flame: "bright fire tongue",
  grape: "small fruit in a bunch",
  happy: "feeling joyful",
  island: "land with water all around",
  jungle: "thick wild forest",
  kitten: "a baby cat",
  lemon: "sour yellow fruit",
  music: "songs and melodies",
  night: "time after sunset",
  ocean: "huge salty sea",
  pencil: "tool for writing",
  quiet: "almost no sound",
  river: "fresh water that flows",
  sunny: "bright with sunshine",
  tiger: "big striped cat",
  under: "below something",
  violet: "purple flower color",
  water: "clear drink we need",
  yellow: "color of a ripe banana",
  zebra: "horse with black stripes",
  bridge: "path over a river",
  candle: "wax stick that burns",
  dragon: "storybook fire lizard",
  forest: "many trees together",
  garden: "place to grow plants",
  hammer: "tool for hitting nails",
  invite: "ask someone to come",
  jacket: "coat for cool weather",
  ladder: "steps you climb",
  magnet: "metal that sticks to iron",
  number: "how many — like 1, 2, 3",
  orange: "round citrus fruit",
  planet: "world that orbits a star",
  rocket: "craft that flies to space",
  silver: "shiny gray metal",
  tunnel: "passage under ground",
  umbrella: "keeps rain off you",
  valley: "low land between hills",
  window: "glass in a wall",
  yogurt: "creamy cultured milk",
  anchor: "heavy hook for a boat",
  balloon: "air-filled rubber ball",
  camera: "device that takes photos",
  desert: "very dry sandy land",
  engine: "machine that makes power",
  feather: "soft covering on a bird",
  glider: "plane with no engine",
  harbor: "safe place for ships",
  insect: "tiny six-legged bug",
  jewel: "precious shiny stone",
  kettle: "pot for boiling tea",
  lantern: "portable light",
  marble: "small glass play ball",
  needle: "thin sewing point",
  orchid: "fancy tropical flower",
  pirate: "sea robber in stories",
  quiver: "case for arrows",
  ribbon: "pretty strip of cloth",
  saddle: "seat on a horse",
  turtle: "shell-backed reptile",
  velvet: "soft fuzzy fabric",
  whisper: "speak very softly",
  compass: "tool that finds north",
  dolphin: "smart sea mammal",
  echo: "sound that comes back",
  falcon: "fast hunting bird",
  glacier: "huge slow river of ice",
  horizon: "where sky meets earth",
  iguana: "green climbing lizard",
  jasper: "reddish stone",
  koala: "fuzzy tree marsupial",
  lizard: "scaly four-legged reptile",
  meadow: "open grassy field",
  nectar: "sweet juice in flowers",
  otter: "playful river mammal",
  pebble: "small smooth stone",
  quartz: "hard clear mineral",
  raven: "large black bird",
  sparrow: "small common bird",
  thunder: "loud boom after lightning",
  urchin: "spiky sea creature",
  voyage: "long trip by ship",
  willow: "tree with drooping branches",
  crystal: "clear pointed mineral",
  dawn: "first light of morning",
  ember: "glowing bit of fire",
  frost: "icy white on cold mornings",
  glow: "soft steady light",
  hive: "home for bees",
  ivory: "creamy white material",
  jade: "green gemstone",
  kite: "toy that flies on a string",
  lotus: "water flower on a pad",
  moss: "soft green plant on rocks",
  nest: "home birds build",
};

export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.3) return 1;
  if (pKnown < 0.5) return 2;
  if (pKnown < 0.7) return 3;
  if (pKnown < 0.85) return 4;
  return 5;
}

export function specForDifficulty(difficulty: number): {
  targetCount: number;
  peekMs: number;
  hintMode: HintMode;
} {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  if (d === 1) return { targetCount: 1, peekMs: 3500, hintMode: "blanks" };
  if (d === 2) return { targetCount: 2, peekMs: 3000, hintMode: "blanks" };
  if (d === 3) return { targetCount: 2, peekMs: 2500, hintMode: "length" };
  if (d === 4) return { targetCount: 3, peekMs: 2000, hintMode: "length" };
  return { targetCount: 3, peekMs: 1500, hintMode: "none" };
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
    peekMs: spec.peekMs,
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

/** Meaning cue for the current target (never equal to the spelling). */
export function wordGloss(word: string): string {
  const key = normalizeSpelling(word);
  const gloss = WORD_GLOSS[key];
  if (gloss && normalizeSpelling(gloss) !== key) return gloss;
  return "Listen, then type what you heard.";
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
      message: "Spelling matches. Nice work.",
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
  return `sight word vocabulary spelling reading phonics letter sound dictation hear spell ${round.skill} ${round.targets.join(" ")}`;
}
