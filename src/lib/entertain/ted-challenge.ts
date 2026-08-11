/**
 * TED listening challenge builders — difficulty adapts to **grade number**
 * (G1–G12) + English level + soft age nudge. G4 is only the default when grade is unknown.
 */

import type { EnglishLevel, GradeBand } from "../student-profile";
import {
  englishLevelForGrade,
  parseEnglishLevel,
} from "../student-profile";
import { nsKey, RYAN_ACCOUNT } from "../tenant-storage";
import type { TedTalk } from "./ted-catalog";

export type ChallengeKind = "literal" | "structure" | "critique" | "retell";

/** Reading-comp style: one answer vs select-all-that-apply. */
export type ChoiceMode = "single" | "multi";

export type ChallengeItem = {
  id: string;
  kind: ChallengeKind;
  prompt: string;
  rubricHint: string;
  /** ~4 options (reading-comprehension style). */
  choices: string[];
  choiceMode: ChoiceMode;
  /** 0-based indices of correct option(s) for soft check. */
  correctChoices: number[];
};

export type ChoiceScore = "exact" | "partial" | "miss" | "empty";

const CHOICE_LETTERS = ["A", "B", "C", "D"] as const;

export function choiceLetter(index: number): string {
  return CHOICE_LETTERS[index] ?? String(index + 1);
}

/** Normalize / pad hybrid MCQ fields so every item is UI-safe. */
export function enrichChallengeItem(
  raw: {
    id?: string;
    kind?: ChallengeKind | string;
    prompt?: string;
    rubricHint?: string;
    choices?: string[];
    choiceMode?: ChoiceMode | string;
    correctChoices?: number[];
  },
  index: number,
): ChallengeItem {
  const kinds: ChallengeKind[] = [
    "literal",
    "structure",
    "critique",
    "retell",
  ];
  const kind = kinds.includes(raw.kind as ChallengeKind)
    ? (raw.kind as ChallengeKind)
    : "critique";
  const choices = (Array.isArray(raw.choices) ? raw.choices : [])
    .map((c) => String(c).trim())
    .filter(Boolean)
    .slice(0, 4);
  const padded = [...choices];
  const fillers = [
    "The speaker's main idea or claim",
    "A detail that is not the focus",
    "Something the talk never covers",
    "A joke with no connection to the talk",
  ];
  while (padded.length < 4) {
    padded.push(fillers[padded.length]!);
  }
  const modeRaw = String(raw.choiceMode || "").toLowerCase();
  const choiceMode: ChoiceMode = modeRaw === "multi" ? "multi" : "single";
  let correct = (Array.isArray(raw.correctChoices) ? raw.correctChoices : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < padded.length);
  correct = [...new Set(correct)].sort((a, b) => a - b);
  if (correct.length === 0) {
    correct = choiceMode === "multi" ? [0, 1] : [0];
  }
  if (choiceMode === "single" && correct.length > 1) {
    correct = [correct[0]!];
  }
  return {
    id: String(raw.id || `q${index + 1}`),
    kind,
    prompt: String(raw.prompt || "").trim() || `Question ${index + 1}`,
    rubricHint: String(
      raw.rubricHint || "Be precise and evidence-aware.",
    ).trim(),
    choices: padded,
    choiceMode,
    correctChoices: correct,
  };
}

export function scoreChoiceSelection(
  item: ChallengeItem,
  selected: number[],
): ChoiceScore {
  const picked = [
    ...new Set(
      selected.filter(
        (i) => Number.isInteger(i) && i >= 0 && i < item.choices.length,
      ),
    ),
  ].sort((a, b) => a - b);
  if (picked.length === 0) return "empty";
  const correct = [...item.correctChoices].sort((a, b) => a - b);
  const corrSet = new Set(correct);
  const hit = picked.filter((i) => corrSet.has(i)).length;
  const extra = picked.filter((i) => !corrSet.has(i)).length;
  if (hit === correct.length && extra === 0 && picked.length === correct.length) {
    return "exact";
  }
  if (item.choiceMode === "multi" && hit > 0) return "partial";
  return "miss";
}

export function formatHybridAnswerNotes(
  item: ChallengeItem,
  selected: number[],
  essay: string,
): string {
  const letters = selected
    .filter((i) => i >= 0 && i < item.choices.length)
    .sort((a, b) => a - b)
    .map((i) => choiceLetter(i));
  const choiceLine =
    letters.length > 0
      ? `Choices: ${letters.join(", ")}`
      : "Choices: (none)";
  return `${choiceLine}\nEssay: ${essay.trim() || "(skipped)"}`;
}

export type TedChallenge = {
  talkSlug: string;
  title: string;
  items: ChallengeItem[];
  generatedFromTranscript: boolean;
  /** Resolved difficulty band used to build prompts. */
  level?: EnglishLevel;
  /** Grade number used for prompt cues (defaults to 4 only when unknown). */
  grade?: number;
};

/** Learner signals from the active account (client → API). */
export type TedChallengeLearner = {
  age?: number;
  grade?: number;
  gradeBand?: GradeBand;
  englishLevel?: EnglishLevel | string;
};

const LEVEL_ORDER: EnglishLevel[] = [
  "emerging",
  "developing",
  "confident",
  "advanced",
];

function clampLevelIndex(i: number): number {
  return Math.max(0, Math.min(LEVEL_ORDER.length - 1, i));
}

export function normalizeLearnerGrade(grade?: number): number {
  if (typeof grade === "number" && Number.isFinite(grade)) {
    return Math.max(1, Math.min(12, Math.round(grade)));
  }
  return 4; // default only when grade is missing
}

/** Typical age for a US/international grade (rough mid-year). */
export function typicalAgeForGrade(grade: number): number {
  return Math.max(5, Math.min(18, normalizeLearnerGrade(grade) + 5));
}

/** UI / API caption: "G10 · advanced" */
export function formatTedDifficultyLabel(
  learner?: TedChallengeLearner | null,
): string {
  const grade = normalizeLearnerGrade(learner?.grade);
  const level = resolveTedChallengeLevel(learner);
  return `G${grade} · ${level}`;
}

/**
 * Resolve challenge difficulty from **grade number** + English judgment + age.
 * Explicit englishLevel wins as the base; otherwise englishLevelForGrade(grade).
 * Age can nudge ±1 step vs typical grade age.
 */
export function resolveTedChallengeLevel(
  learner?: TedChallengeLearner | null,
): EnglishLevel {
  const grade = normalizeLearnerGrade(learner?.grade);
  const explicit = parseEnglishLevel(learner?.englishLevel);
  let level: EnglishLevel = explicit ?? englishLevelForGrade(grade);

  const age =
    typeof learner?.age === "number" && Number.isFinite(learner.age)
      ? learner.age
      : typicalAgeForGrade(grade);
  const typical = typicalAgeForGrade(grade);
  const delta = age - typical;
  let idx = LEVEL_ORDER.indexOf(level);
  if (delta <= -2) idx -= 1;
  else if (delta >= 3) idx += 1;
  return LEVEL_ORDER[clampLevelIndex(idx)]!;
}

/** Soft-check minimum word counts by band (client feedback). */
export function softFeedbackThresholds(level: EnglishLevel): {
  short: number;
  retell: number;
} {
  if (level === "emerging") return { short: 4, retell: 15 };
  if (level === "developing") return { short: 6, retell: 25 };
  if (level === "confident") return { short: 8, retell: 35 };
  return { short: 10, retell: 45 };
}

/** Soft MCQ-only feedback (independent of essay). */
export function buildChoiceSoftFeedback(
  item: ChallengeItem,
  selected: number[],
): string {
  const score = scoreChoiceSelection(item, selected);
  if (score === "exact") {
    return "Your selection lines up with the talk's focus — nice.";
  }
  if (score === "partial") {
    return "You caught some of the right ideas — check whether you over- or under-selected.";
  }
  if (score === "empty") {
    return "No option selected — that's OK if your view isn't listed; make sure your essay carries your own view.";
  }
  return "Your selection may miss the talk's main focus — re-listen for the claim, then try again.";
}

/** Soft essay-only feedback (independent of MCQ selection). */
export function buildEssaySoftFeedback(
  item: ChallengeItem,
  essay: string,
  level: EnglishLevel = "developing",
): string {
  const n = essay.trim().split(/\s+/).filter(Boolean).length;
  const th = softFeedbackThresholds(level);
  if (n < th.short) {
    return "Short answers can be sharp — but this write-up needs more evidence or a clearer claim. Try one more sentence.";
  }
  if (
    item.kind === "critique" &&
    level !== "emerging" &&
    !/because|however|although|but|yet|why/i.test(essay)
  ) {
    return "Nice start on the essay. Push the critique: name the tension (because / however) so the objection lands.";
  }
  if (item.kind === "retell" && n < th.retell) {
    return "Retell should carry the arc. Add one beat from the middle or end of the talk.";
  }
  return `Solid draft for a ${item.kind} prompt. Rubric nudge: ${item.rubricHint}`;
}

/** Combined soft feedback (legacy / notes). Prefer split checks in UI. */
export function buildHybridSoftFeedback(
  item: ChallengeItem,
  selected: number[],
  essay: string,
  level: EnglishLevel = "developing",
): string {
  return `${buildChoiceSoftFeedback(item, selected)} ${buildEssaySoftFeedback(item, essay, level)}`;
}

/** Append STT text into a Challenge answer without wiping typed draft. */
export function appendVoiceTranscript(
  prev: string,
  transcript: string,
): string {
  const chunk = transcript.trim();
  if (!chunk) return prev;
  const base = prev.trimEnd();
  return base ? `${base} ${chunk}` : chunk;
}

/** English TTS script for a challenge prompt (MCQ choices). */
export function challengePromptSpeechText(item: ChallengeItem): string {
  const prompt = item.prompt.trim();
  const choices = item.choices?.map((c) => c.trim()).filter(Boolean) ?? [];
  if (!choices.length) return prompt;
  const listed = choices
    .map((c, i) => `${i + 1}. ${c}`)
    .join(". ");
  return `${prompt} Choices: ${listed}.`;
}

/** Account-scoped Auto Listen for Challenge prompts (default ON). */
const TED_PROMPT_LISTEN_MODULE = "tedPromptListen";
const TED_PROMPT_SPEAK_LEGACY = "tedChallengeSpeak";

export function loadTedPromptListenEnabled(
  accountId: string = RYAN_ACCOUNT,
): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = localStorage.getItem(
      nsKey(accountId, TED_PROMPT_LISTEN_MODULE),
    );
    if (saved != null) return saved !== "0" && saved !== "false";
    // Migrate one-shot from earlier Speak-named key
    const legacy = localStorage.getItem(
      nsKey(accountId, TED_PROMPT_SPEAK_LEGACY),
    );
    if (legacy != null) {
      const on = legacy !== "0" && legacy !== "false";
      localStorage.setItem(
        nsKey(accountId, TED_PROMPT_LISTEN_MODULE),
        on ? "1" : "0",
      );
      return on;
    }
    return true;
  } catch {
    return true;
  }
}

export function saveTedPromptListenEnabled(
  enabled: boolean,
  accountId: string = RYAN_ACCOUNT,
): void {
  try {
    localStorage.setItem(
      nsKey(accountId, TED_PROMPT_LISTEN_MODULE),
      enabled ? "1" : "0",
    );
  } catch {
    // ignore
  }
}

/** @deprecated Use loadTedPromptListenEnabled — Speak naming was incorrect. */
export function loadTedChallengeSpeakEnabled(
  accountId: string = RYAN_ACCOUNT,
): boolean {
  return loadTedPromptListenEnabled(accountId);
}

/** @deprecated Use saveTedPromptListenEnabled — Speak naming was incorrect. */
export function saveTedChallengeSpeakEnabled(
  enabled: boolean,
  accountId: string = RYAN_ACCOUNT,
): void {
  saveTedPromptListenEnabled(enabled, accountId);
}

/** Trim prompt string for TTS (empty → skip). Prefer challengePromptSpeechText for items. */
export function tedPromptListenText(prompt: string): string {
  return prompt.trim();
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40)
    .slice(0, 40);
}

/**
 * Developing-band prompts keyed by grade grain (G4 baseline).
 * G5 stays developing but asks for slightly longer / evidence-aware answers.
 */
function buildDevelopingItems(
  talk: TedTalk,
  grade: number,
  hook: string,
  mid: string,
): ChallengeItem[] {
  const title = talk.title;
  const speaker = talk.speaker;
  const g5 = grade >= 5;

  return [
    enrichChallengeItem(
      {
        id: "q1",
        kind: "literal",
        prompt: g5
          ? `In one clear sentence, what is ${speaker} mainly trying to say in “${title}”? Name the idea, not only the topic.`
          : `In one clear sentence, what is ${speaker} mainly trying to say in “${title}”?`,
        rubricHint: g5
          ? "State the main idea — Grade 5 stretch: be specific."
          : "State the main idea — not every detail. (Grade 4 listening)",
        choiceMode: "single",
        choices: [
          `A clear main idea ${speaker} wants us to remember`,
          "Only funny stories with no takeaway",
          "A random list of unrelated facts",
          "Instructions for a classroom game",
        ],
        correctChoices: [0],
      },
      0,
    ),
    enrichChallengeItem(
      {
        id: "q2",
        kind: "structure",
        prompt: `How does the talk move? Write 3 short bullets: beginning → middle → end.`,
        rubricHint: "Look for an opening hook, examples, and a takeaway.",
        choiceMode: "multi",
        choices: [
          "An opening hook that grabs attention",
          "Examples or evidence in the middle",
          "A takeaway or closing idea",
          "A cooking recipe unrelated to the talk",
        ],
        correctChoices: [0, 1, 2],
      },
      1,
    ),
    enrichChallengeItem(
      {
        id: "q3",
        kind: "critique",
        prompt: g5
          ? `What surprised you or felt unclear? In 2–3 sentences, give one reason and one example from the talk.`
          : `What surprised you or felt unclear? Explain in 2–3 sentences why.`,
        rubricHint: "Honest reaction + a reason (because…).",
        choiceMode: "single",
        choices: [
          "Something surprising or unclear that you can explain with a reason",
          "Nothing — the talk needs no reaction",
          "Only the speaker's clothing",
          "A topic never mentioned",
        ],
        correctChoices: [0],
      },
      2,
    ),
    enrichChallengeItem(
      {
        id: "q4",
        kind: "critique",
        prompt: `Pick a memorable line or idea (hint near: “${hook.slice(0, 100)}…”). Why did it stick?`,
        rubricHint: "Say whether it was a story, a fact, or a feeling that worked.",
        choiceMode: "multi",
        choices: [
          "A story that made the idea stick",
          "A clear fact or example",
          "A strong feeling or image",
          "A line that had nothing to do with the talk",
        ],
        correctChoices: [0, 1, 2],
        // multi: story / fact / feeling all valid; essay judges which
      },
      3,
    ),
    enrichChallengeItem(
      {
        id: "q5",
        kind: "retell",
        prompt: g5
          ? `Explain the talk to a classmate in about 4 sentences. Include one idea from later in the talk (hint: “${mid.slice(0, 80)}…”).`
          : `Explain the talk to a classmate in about 3 sentences. Include one idea from later in the talk (hint: “${mid.slice(0, 80)}…”).`,
        rubricHint: g5
          ? "Grade 5 stretch: retell should carry the arc, not only the opening."
          : "Retell should include more than the opening. (G4 baseline)",
        choiceMode: "multi",
        choices: [
          "The opening idea or hook",
          "A middle example or later idea",
          "A closing takeaway",
          "Only the title with no content",
        ],
        correctChoices: [0, 1, 2],
      },
      4,
    ),
  ];
}

function buildItemsForLevel(
  talk: TedTalk,
  level: EnglishLevel,
  grade: number,
  hook: string,
  mid: string,
): ChallengeItem[] {
  const title = talk.title;
  const speaker = talk.speaker;

  if (level === "emerging") {
    return [
      enrichChallengeItem(
        {
          id: "q1",
          kind: "literal",
          prompt: `In one short sentence: what is this talk mainly about? (Talk: “${title}” by ${speaker}.)`,
          rubricHint:
            "Name the topic in plain words — one clear idea is enough.",
          choiceMode: "single",
          choices: [
            "A story or idea the speaker wants us to remember",
            "Only jokes with no main idea",
            "A list of random facts",
            "Instructions for a game",
          ],
          correctChoices: [0],
        },
        0,
      ),
      enrichChallengeItem(
        {
          id: "q2",
          kind: "literal",
          prompt: `Name one thing ${speaker} talked about that you understood well.`,
          rubricHint: "Pick one concrete detail from the talk.",
          choiceMode: "single",
          choices: [
            "One concrete detail from the talk",
            "Something never said in the talk",
            "Only the audience clapping",
            "A math formula from another class",
          ],
          correctChoices: [0],
        },
        1,
      ),
      enrichChallengeItem(
        {
          id: "q3",
          kind: "structure",
          prompt: `What came first in the talk, and what came near the end? Write two short lines.`,
          rubricHint: "Beginning vs ending — keep it simple.",
          choiceMode: "multi",
          choices: [
            "Something near the beginning",
            "Something near the end",
            "Only the middle with no start or end",
            "A commercial break",
          ],
          correctChoices: [0, 1],
        },
        2,
      ),
      enrichChallengeItem(
        {
          id: "q4",
          kind: "retell",
          prompt: `Tell a friend what the talk was about in 2 short sentences.`,
          rubricHint: "Use your own words. Short is OK.",
          choiceMode: "single",
          choices: [
            "A short retell in my own words",
            "Copy every word from the talk",
            "Say the talk was boring with no details",
            "Talk about a different video",
          ],
          correctChoices: [0],
        },
        3,
      ),
    ];
  }

  if (level === "developing") {
    return buildDevelopingItems(talk, grade, hook, mid);
  }

  if (level === "confident") {
    const g8 = grade >= 8;
    return [
      enrichChallengeItem(
        {
          id: "q1",
          kind: "literal",
          prompt: g8
            ? `State ${speaker}'s central claim in “${title}” in one precise sentence — Grade ${grade} stretch: name the claim, not only the topic.`
            : `State ${speaker}'s central claim in “${title}” in one precise sentence.`,
          rubricHint: `Name the claim, not only the topic. (Grade ${grade})`,
          choiceMode: "single",
          choices: [
            "A precise central claim (not only a vague topic)",
            "A topic label with no claim",
            "A joke summary only",
            "An unrelated news headline",
          ],
          correctChoices: [0],
        },
        0,
      ),
      enrichChallengeItem(
        {
          id: "q2",
          kind: "structure",
          prompt: `Sketch the talk's arc in 3 bullets: hook → evidence → takeaway.`,
          rubricHint: "Look for story, data, or examples — not just jokes.",
          choiceMode: "multi",
          choices: [
            "Hook that opens the talk",
            "Evidence, story, or examples",
            "A takeaway or closing move",
            "A product ad break",
          ],
          correctChoices: [0, 1, 2],
        },
        1,
      ),
      enrichChallengeItem(
        {
          id: "q3",
          kind: "critique",
          prompt: g8
            ? `What is one fair weakness or gap in the argument? In 3–4 sentences, point to evidence quality or a missing trade-off.`
            : `What is one fair weakness or gap in the argument? Answer it briefly in 2–3 sentences.`,
          rubricHint:
            "Point to evidence quality, overgeneralization, or a missing trade-off.",
          choiceMode: "single",
          choices: [
            "A fair gap: evidence quality, overgeneralization, or missing trade-off",
            "The speaker's accent",
            "The slide colors",
            "A complaint with no link to the argument",
          ],
          correctChoices: [0],
        },
        2,
      ),
      enrichChallengeItem(
        {
          id: "q4",
          kind: "critique",
          prompt: `Pick one memorable line (or paraphrase of: “${hook.slice(0, 120)}…”). How does it persuade — story, evidence, or emotion?`,
          rubricHint: "Separate style from substance.",
          choiceMode: "multi",
          choices: [
            "Story / narrative",
            "Evidence / data",
            "Emotion / feeling",
            "None of these — random noise",
          ],
          correctChoices: [0, 1, 2],
        },
        3,
      ),
      enrichChallengeItem(
        {
          id: "q5",
          kind: "retell",
          prompt: g8
            ? `Retell the talk for a sharp classmate — about 5 sentences. Include one later idea (hint: “${mid.slice(0, 100)}…”) and one implication.`
            : `Retell the talk for a sharp classmate — max 4 sentences. Include one later idea (hint: “${mid.slice(0, 100)}…”).`,
          rubricHint: `Carry the argument, not only the opening. (Grade ${grade})`,
          choiceMode: "multi",
          choices: [
            "The central claim",
            "A later idea or evidence beat",
            "Why it matters / implication",
            "Only the speaker's name",
          ],
          correctChoices: [0, 1],
        },
        4,
      ),
    ];
  }

  // advanced — grade grain within G9–G12
  const g11 = grade >= 11;
  const g10 = grade >= 10;
  return [
    enrichChallengeItem(
      {
        id: "q1",
        kind: "literal",
        prompt: g10
          ? `In one precise sentence, what is ${speaker}'s central claim in “${title}”? Grade ${grade}: include the key mechanism or stakes, not a vague theme.`
          : `In one precise sentence, what is ${speaker}'s central claim in “${title}”?`,
        rubricHint: g10
          ? `Name the claim + stakes. (Grade ${grade} advanced)`
          : "Name the claim, not a vague theme. Quote a key phrase if you can.",
        choiceMode: "single",
        choices: [
          "A precise claim with mechanism or stakes",
          "A vague theme without a claim",
          "A biographical aside only",
          "An unrelated policy slogan",
        ],
        correctChoices: [0],
      },
      0,
    ),
    enrichChallengeItem(
      {
        id: "q2",
        kind: "structure",
        prompt: g11
          ? `Map the talk's rhetoric: hook → evidence moves → takeaway. 3–4 bullets; label each beat (story / data / counterexample).`
          : `How does the talk move from hook → evidence → takeaway? Sketch the arc in 3 short bullets.`,
        rubricHint:
          "Look for story, data, or counterexample beats — not a plot summary of jokes.",
        choiceMode: "multi",
        choices: [
          "Hook / opening frame",
          "Evidence move (story, data, or counterexample)",
          "Takeaway / closing implication",
          "An off-topic Q&A only",
        ],
        correctChoices: [0, 1, 2],
      },
      1,
    ),
    enrichChallengeItem(
      {
        id: "q3",
        kind: "critique",
        prompt: g10
          ? `Steelman the strongest objection to the talk's argument (Grade ${grade}). Then answer it in 3–4 sentences with a trade-off or counter-evidence.`
          : `Steelman the strongest objection someone could raise against the talk's argument. Then answer it in 2–3 sentences.`,
        rubricHint:
          "Strong objections attack evidence quality, overgeneralization, or missing trade-offs.",
        choiceMode: "single",
        choices: [
          "A steelmanned objection on evidence, overgeneralization, or trade-offs",
          "A personal insult of the speaker",
          "A complaint about video length only",
          "Agreeing with everything without critique",
        ],
        correctChoices: [0],
      },
      2,
    ),
    enrichChallengeItem(
      {
        id: "q4",
        kind: "critique",
        prompt: `Pick one memorable line (or paraphrase of: “${hook.slice(0, 120)}…”). Why does it persuade — rhetoric, evidence, or emotion?`,
        rubricHint: g10
          ? `Separate style from substance; Grade ${grade} listeners name the technique.`
          : "Separate style from substance; advanced listeners name the technique.",
        choiceMode: "multi",
        choices: [
          "Rhetoric / framing technique",
          "Evidence / substance",
          "Emotion / pathos",
          "None — decorative filler only",
        ],
        correctChoices: [0, 1, 2],
      },
      3,
    ),
    enrichChallengeItem(
      {
        id: "q5",
        kind: "retell",
        prompt: g11
          ? `Brief a sharp peer who missed it — 5–6 sentences. Carry the argument, one later idea (hint: “${mid.slice(0, 100)}…”), and one real-world implication.`
          : g10
            ? `Explain the talk to a sharp classmate who missed it — about 5 sentences. Include one later idea (hint: “${mid.slice(0, 100)}…”) and why it matters.`
            : `Explain the talk to a sharp classmate who missed it — max 4 sentences. Include one idea from later in the talk (hint near: “${mid.slice(0, 100)}…”).`,
        rubricHint: `Retell should carry the argument, not only the opening. (Grade ${grade})`,
        choiceMode: "multi",
        choices: [
          "The argument / central claim",
          "A later idea from the talk",
          "A real-world implication",
          "Only the opening joke",
        ],
        correctChoices: [0, 1],
      },
      4,
    ),
  ];
}

/** Local high-quality fallback when LLM / transcript is thin. */
export function buildFallbackChallenge(
  talk: TedTalk,
  transcript: string,
  learner?: TedChallengeLearner | null,
): TedChallenge {
  const level = resolveTedChallengeLevel(learner);
  const grade = normalizeLearnerGrade(learner?.grade);
  const sents = sentences(transcript);
  const hook = sents[0] || talk.blurb;
  const mid = sents[Math.floor(sents.length / 2)] || talk.blurb;
  const items = buildItemsForLevel(talk, level, grade, hook, mid);
  return {
    talkSlug: talk.slug,
    title: talk.title,
    items,
    generatedFromTranscript: transcript.length > 200,
    level,
    grade,
  };
}

export function parseChallengeJson(
  raw: string,
  talk: TedTalk,
  level?: EnglishLevel,
  grade?: number,
): TedChallenge | null {
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return null;
  try {
    const data = JSON.parse(m[0]) as {
      items?: Array<{
        kind?: string;
        prompt?: string;
        rubricHint?: string;
        choices?: string[];
        choiceMode?: string;
        correctChoices?: number[];
      }>;
    };
    if (!Array.isArray(data.items) || data.items.length < 3) return null;
    const items: ChallengeItem[] = data.items
      .slice(0, 5)
      .map((it, i) => enrichChallengeItem(it, i));
    return {
      talkSlug: talk.slug,
      title: talk.title,
      items,
      generatedFromTranscript: true,
      level,
      grade: grade ?? undefined,
    };
  } catch {
    return null;
  }
}

const BAND_PROMPT: Record<
  EnglishLevel,
  { audience: string; rules: string[] }
> = {
  emerging: {
    audience:
      "young or early English listeners (roughly Pre-A1–A1; typically Grade 1–3). Short words, concrete ideas.",
    rules: [
      "Use simple vocabulary; short sentences in prompts.",
      "Prefer literal + simple structure + short retell. Soft opinion OK; NO steelman, rhetoric, or academic jargon.",
      "EVERY item must include exactly 4 easy choices + choiceMode single|multi + correctChoices indices.",
      "Never talk down — friendly and clear, not babyish baby-talk.",
    ],
  },
  developing: {
    audience:
      "upper-elementary English listeners (roughly A2). Grade 4 is the day-1 baseline; Grade 5 may stretch slightly.",
    rules: [
      "Clear everyday academic English; avoid steelman / rhetoric jargon.",
      "Mix literal, structure (beginning→middle→end), gentle critique (surprise/unclear), and short retell.",
      "Calibrate length to the stated Grade N: G4 ≈ 3-sentence retell; G5 ≈ slightly longer + one evidence example.",
      "EVERY item: 4 choices (single or multi) + open essay prompt. Socratic — do not reveal answers in the prompt text.",
    ],
  },
  confident: {
    audience: "middle-school English listeners (roughly B1; typically Grade 6–8).",
    rules: [
      "Precise but accessible. Claim + evidence + mild critique OK.",
      "Avoid the heaviest debate jargon unless needed.",
      "EVERY item: 4 choices (single or multi) + open essay. Socratic — do not reveal answers.",
    ],
  },
  advanced: {
    audience:
      "advanced international-school listeners (roughly B2+, grades 9–12).",
    rules: [
      "Tone: witty, rigorous, never babyish. Steelman / rhetoric OK.",
      "Calibrate to the stated Grade N: G9 = solid advanced; G10–11 = longer critique + implication; G12 = denser rhetoric mapping.",
      "EVERY item: 4 choices (single or multi) + open essay. Socratic — do not reveal answers.",
    ],
  },
};

export function challengeSystemPrompt(
  talk: TedTalk,
  learner?: TedChallengeLearner | null,
): string {
  const level = resolveTedChallengeLevel(learner);
  const grade = normalizeLearnerGrade(learner?.grade);
  const band = BAND_PROMPT[level];
  const age =
    typeof learner?.age === "number" ? `Age ~${learner.age}.` : "";
  return [
    `You design TED listening challenges for: ${band.audience}`,
    `Target difficulty band: ${level}. Grade ${grade} (G${grade} grain). ${age}`.trim(),
    ...band.rules,
    'Return ONLY JSON: {"items":[{"kind":"literal|structure|critique|retell","prompt":"...","rubricHint":"...","choiceMode":"single|multi","choices":["A","B","C","D"],"correctChoices":[0]}]}',
    "Include 4–5 items mixing kinds. EVERY item must have exactly 4 choices + choiceMode + correctChoices (0-based). Students also write an open essay after selecting.",
    `Talk: “${talk.title}” by ${talk.speaker}.`,
  ].join("\n");
}
