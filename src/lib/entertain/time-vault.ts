/**
 * Time Vault — historical archive cases (pure functions).
 * AI-generated cases with a static fallback bank. Each case has a passage,
 * events to place on a timeline, and evidence sentences that prove each date.
 */

export type TimeVaultEvent = {
  id: string;
  label: string;
  /** Negative = BCE. */
  year: number;
  /** Small emoji icon shown on the timeline card. */
  emoji: string;
};

export type TimeVaultCase = {
  id: string;
  title: string;
  /** Theme used for the artifact collection (e.g. "Ancient Egypt"). */
  civilization: string;
  /** Narrative hook shown on the dossier cover. */
  intro: string;
  /** Reading passage; sentences are split in the UI and numbered. */
  passage: string;
  events: TimeVaultEvent[];
  /** Event ids in correct chronological order (earliest → latest). */
  correctOrder: string[];
  /** eventId → sentence index (0-based) that proves its date. */
  evidenceMap: Record<string, number>;
  /** Difficulty tier 1–5. */
  difficulty: number;
};

export type TimeVaultCaseSpec = {
  /** Target passage length in words (from reading-evidence pKnown). */
  passageLength: number;
  /** Number of events (from ancient-civ pKnown). */
  eventCount: number;
  /** High mastery → cross-civilization comparison cases. */
  crossCivilization: boolean;
  /** Low reading mastery → evidence sentences get a hint marker. */
  explicitEvidence: boolean;
};

/** Map BKT pKnown → case spec (ZPD: p≈0.7 optimal). */
export function difficultyFromPKnown(pKnown: number): number {
  if (pKnown < 0.3) return 1;
  if (pKnown < 0.5) return 2;
  if (pKnown < 0.7) return 3;
  if (pKnown < 0.85) return 4;
  return 5;
}

export function caseSpecForDifficulty(difficulty: number): TimeVaultCaseSpec {
  switch (difficulty) {
    case 1:
      return { passageLength: 80, eventCount: 3, crossCivilization: false, explicitEvidence: true };
    case 2:
      return { passageLength: 120, eventCount: 4, crossCivilization: false, explicitEvidence: true };
    case 3:
      return { passageLength: 160, eventCount: 4, crossCivilization: false, explicitEvidence: false };
    case 4:
      return { passageLength: 200, eventCount: 5, crossCivilization: true, explicitEvidence: false };
    default:
      return { passageLength: 240, eventCount: 5, crossCivilization: true, explicitEvidence: false };
  }
}

/** Convert BCE/CE to sortable years. */
export function yearToNumber(year: number): number {
  return year; // negative = BCE already
}

// ---------------------------------------------------------------------------
// Static fallback bank (rich enough to be playable without AI)
// ---------------------------------------------------------------------------

const EMOJI_FALLBACK = ["📜", "🏛️", "⚖️", "🔺", "🌿", "🗺️"];

export const FALLBACK_CASES: TimeVaultCase[] = [
  {
    id: "nile-villages",
    title: "The Nile's Secret",
    civilization: "Ancient Egypt",
    intro: "An archaeologist found four artifacts by the Nile but the dates have scrambled.",
    passage:
      "The ancient Egyptians built the Great Pyramid of Giza around 2560 BCE. " +
      "Before the pyramids, early Egyptians lived in small villages along the Nile " +
      "around 5000 BCE. The writing system called hieroglyphics was developed " +
      "around 3200 BCE. Later, the Rosetta Stone was created in 196 BCE to " +
      "carry the same message in three different scripts.",
    events: [
      { id: "a", label: "Rosetta Stone created", year: -196, emoji: "🪨" },
      { id: "b", label: "Great Pyramid built", year: -2560, emoji: "🔺" },
      { id: "c", label: "Hieroglyphics developed", year: -3200, emoji: "📜" },
      { id: "d", label: "Early Nile villages", year: -5000, emoji: "🏡" },
    ],
    correctOrder: ["d", "c", "b", "a"],
    evidenceMap: { d: 1, c: 2, b: 0, a: 3 },
    difficulty: 2,
  },
  {
    id: "egypt-kingdoms",
    title: "Kingdoms of Egypt",
    civilization: "Ancient Egypt",
    intro: "Three royal seals from different eras need to be put back in order.",
    passage:
      "Ancient Egypt's history is divided into three main periods. " +
      "The Old Kingdom began around 2700 BCE and is known for pyramid building. " +
      "After a time of chaos, the Middle Kingdom started around 2050 BCE and " +
      "brought stability and art. The New Kingdom began around 1550 BCE and " +
      "was Egypt's golden age of empire and powerful pharaohs like Ramesses II.",
    events: [
      { id: "a", label: "New Kingdom begins", year: -1550, emoji: "👑" },
      { id: "b", label: "Old Kingdom begins", year: -2700, emoji: "🔺" },
      { id: "c", label: "Middle Kingdom begins", year: -2050, emoji: "🎨" },
    ],
    correctOrder: ["b", "c", "a"],
    evidenceMap: { b: 1, c: 2, a: 3 },
    difficulty: 1,
  },
  {
    id: "mesopotamia-firsts",
    title: "Mesopotamia's Firsts",
    civilization: "Mesopotamia",
    intro: "The land between the rivers keeps secrets. Put its firsts in order.",
    passage:
      "Mesopotamia, the land between two rivers, was home to many firsts. " +
      "The first cities appeared around 4000 BCE in Sumer. Writing, called " +
      "cuneiform, was invented around 3400 BCE. The Code of Hammurabi, one of " +
      "the first written law codes, was carved around 1750 BCE. The Hanging " +
      "Gardens of Babylon were built much later, around 600 BCE.",
    events: [
      { id: "a", label: "Hanging Gardens built", year: -600, emoji: "🌿" },
      { id: "b", label: "First cities in Sumer", year: -4000, emoji: "🏛️" },
      { id: "c", label: "Cuneiform writing invented", year: -3400, emoji: "✍️" },
      { id: "d", label: "Code of Hammurabi carved", year: -1750, emoji: "⚖️" },
    ],
    correctOrder: ["b", "c", "d", "a"],
    evidenceMap: { b: 1, c: 2, d: 3, a: 4 },
    difficulty: 2,
  },
  {
    id: "bronze-age",
    title: "The Bronze Age",
    civilization: "World History",
    intro: "Metals changed the world in stages. Sort the ages.",
    passage:
      "Before humans used iron, they made tools and weapons from bronze. " +
      "The Bronze Age began around 3300 BCE in the Middle East. By 2500 BCE, " +
      "bronze had spread to Europe. The Iron Age began around 1200 BCE when " +
      "people discovered how to smelt iron, which was stronger and cheaper. " +
      "The Bronze Age ended at different times in different places.",
    events: [
      { id: "a", label: "Bronze reaches Europe", year: -2500, emoji: "🏺" },
      { id: "b", label: "Bronze Age begins", year: -3300, emoji: "⚒️" },
      { id: "c", label: "Iron Age begins", year: -1200, emoji: "🗡️" },
    ],
    correctOrder: ["b", "a", "c"],
    evidenceMap: { b: 1, a: 2, c: 3 },
    difficulty: 1,
  },
  {
    id: "writing-evolution",
    title: "The Story of Writing",
    civilization: "Writing Systems",
    intro: "Writing changed the world in several steps — trace the journey.",
    passage:
      "Writing changed the world in several steps. The Sumerians developed " +
      "cuneiform around 3400 BCE. Egyptians created hieroglyphics around " +
      "3200 BCE. The Phoenicians simplified things with an alphabet around " +
      "1050 BCE. The Greeks added vowels to their alphabet around 800 BCE, " +
      "giving us the foundation of the modern alphabet.",
    events: [
      { id: "a", label: "Cuneiform developed", year: -3400, emoji: "✍️" },
      { id: "b", label: "Greek alphabet with vowels", year: -800, emoji: "🔤" },
      { id: "c", label: "Hieroglyphics created", year: -3200, emoji: "📜" },
      { id: "d", label: "Phoenician alphabet", year: -1050, emoji: "🔠" },
    ],
    correctOrder: ["a", "c", "d", "b"],
    evidenceMap: { a: 1, c: 2, d: 3, b: 4 },
    difficulty: 2,
  },
  {
    id: "river-civilizations",
    title: "River Civilizations",
    civilization: "World History",
    intro: "Great rivers gave birth to the first civilizations. Rebuild the map.",
    passage:
      "The world's first civilizations all grew along great rivers. Egypt grew " +
      "along the Nile starting around 3100 BCE. Mesopotamia developed between the " +
      "Tigris and Euphrates rivers around 3500 BCE. The Indus Valley civilization " +
      "emerged around 2600 BCE along the Indus River. In China, the Yellow River " +
      "gave birth to Chinese civilization around 2000 BCE.",
    events: [
      { id: "a", label: "Egypt along the Nile", year: -3100, emoji: "🏛️" },
      { id: "b", label: "Mesopotamia emerges", year: -3500, emoji: "🌊" },
      { id: "c", label: "Indus Valley civilization", year: -2600, emoji: "🏺" },
      { id: "d", label: "Chinese civilization begins", year: -2000, emoji: "🏯" },
    ],
    correctOrder: ["b", "a", "c", "d"],
    evidenceMap: { b: 2, a: 1, c: 3, d: 4 },
    difficulty: 3,
  },
  {
    id: "pharaohs-timeline",
    title: "Famous Pharaohs",
    civilization: "Ancient Egypt",
    intro: "Four pharaohs ruled at different times. Place their reigns on the timeline.",
    passage:
      "Egypt's most famous pharaohs ruled in different periods. Khufu, who " +
      "built the Great Pyramid, ruled around 2550 BCE. Hatshepsut, one of the " +
      "few female pharaohs, expanded trade routes around 1470 BCE. Tutankhamun, " +
      "the boy king, ruled briefly around 1330 BCE. Ramesses II, known as " +
      "Ramesses the Great, reigned for 66 years starting around 1279 BCE.",
    events: [
      { id: "a", label: "Tutankhamun rules", year: -1330, emoji: "👑" },
      { id: "b", label: "Khufu rules", year: -2550, emoji: "🔺" },
      { id: "c", label: "Hatshepsut rules", year: -1470, emoji: "🗿" },
      { id: "d", label: "Ramesses II begins reign", year: -1279, emoji: "⚔️" },
    ],
    correctOrder: ["b", "c", "a", "d"],
    evidenceMap: { b: 1, c: 2, a: 3, d: 4 },
    difficulty: 3,
  },
  {
    id: "ancient-wonders",
    title: "Seven Ancient Wonders",
    civilization: "World History",
    intro: "Only one ancient wonder still stands. Sort the builders.",
    passage:
      "Of the Seven Wonders of the Ancient World, the Great Pyramid of Giza " +
      "is the only one still standing. It was built around 2560 BCE and was " +
      "the tallest man-made structure for over 3,800 years. The Hanging Gardens " +
      "of Babylon were built around 600 BCE. The Colossus of Rhodes, a giant " +
      "statue, was completed around 280 BCE but destroyed by an earthquake.",
    events: [
      { id: "a", label: "Colossus of Rhodes completed", year: -280, emoji: "🗽" },
      { id: "b", label: "Great Pyramid built", year: -2560, emoji: "🔺" },
      { id: "c", label: "Hanging Gardens built", year: -600, emoji: "🌿" },
    ],
    correctOrder: ["b", "c", "a"],
    evidenceMap: { b: 1, c: 2, a: 3 },
    difficulty: 1,
  },
];

export function pickFallbackCase(): TimeVaultCase {
  return FALLBACK_CASES[Math.floor(Math.random() * FALLBACK_CASES.length)];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type TimeVaultAnswer = {
  /** Event ids placed on the timeline in order (earliest → latest). */
  order: string[];
  /** eventId → sentence index chosen as evidence. */
  evidence: Record<string, number>;
};

export type TimeVaultResult = {
  correct: boolean;
  orderCorrect: boolean;
  evidenceCorrect: boolean;
  /** Misplaced event ids (wrong position). */
  misplaced: string[];
  /** Event ids missing or wrong evidence. */
  badEvidence: string[];
  message: string;
};

export function validateTimeVault(case_: TimeVaultCase, answer: TimeVaultAnswer): TimeVaultResult {
  const orderCorrect =
    answer.order.length === case_.correctOrder.length &&
    answer.order.every((id, i) => id === case_.correctOrder[i]);

  const misplaced = answer.order.filter(
    (id, i) => id !== case_.correctOrder[i],
  );

  const badEvidence: string[] = [];
  for (const [id, sentence] of Object.entries(answer.evidence)) {
    if (case_.evidenceMap[id] !== sentence) badEvidence.push(id);
  }
  for (const id of case_.correctOrder) {
    if (!(id in answer.evidence)) badEvidence.push(id);
  }

  const evidenceCorrect = badEvidence.length === 0;
  const correct = orderCorrect && evidenceCorrect;

  return {
    correct,
    orderCorrect,
    evidenceCorrect,
    misplaced,
    badEvidence,
    message: correct
      ? "Case closed — every date matches its evidence!"
      : "Not quite. Misplaced cards bounce back — adjust and re-check.",
  };
}

/** Split passage into numbered sentences for the evidence panel. */
export function splitPassageSentences(passage: string): string[] {
  return passage
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** BKT skill seed for a completed case. */
export function vaultSkillSeed(case_: TimeVaultCase): string {
  return `ancient civilization history timeline ${case_.civilization} ${case_.events.map((e) => e.label).join(" ")} reading evidence cite quote paragraph main idea`;
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

export type TimeVaultLearner = {
  grade?: number;
  englishLevel?: string;
};

function normalizeGrade(grade?: number): number {
  if (typeof grade === "number" && Number.isFinite(grade)) {
    return Math.max(1, Math.min(12, Math.round(grade)));
  }
  return 4;
}

export function timeVaultSystemPrompt(
  spec: TimeVaultCaseSpec,
  learner?: TimeVaultLearner,
): string {
  const grade = normalizeGrade(learner?.grade);
  const eventCount = spec.eventCount;
  return [
    "You write timeline-mystery cases for an international-school student in grade",
    String(grade),
    ". The student reads a passage, places historical events on a timeline, and links each event to the sentence that proves its date.",
    "",
    `Create a case with EXACTLY ${eventCount} events. The passage must be about ${spec.passageLength} words.`,
    spec.crossCivilization
      ? "Include two civilizations so the student must compare (e.g. Egypt and Mesopotamia)."
      : "Use one civilization or theme.",
    "The events must be historically accurate and each must have a year that is EXPLICITLY stated in the passage.",
    "Do not invent dates. Keep the language clear for a young reader.",
    "",
    "Return ONLY a JSON object (no markdown fences):",
    `{ "title": "...", "civilization": "...", "intro": "one-sentence narrative hook", "passage": "...", "events": [{"id":"a","label":"...","year":-2560}, ...], "correctOrder": ["a","b",...], "evidenceMap": {"a": 0, "b": 2} }`,
    "",
    "Rules:",
    "- correctOrder lists event ids earliest to latest (negative years are BCE).",
    "- evidenceMap maps each event id to the 0-based sentence index in the passage that states its year.",
    "- events must use ids a, b, c, ... in order.",
    "- passage must be 1-3 sentences, plain English, no markdown.",
  ].join("\n");
}

export function parseTimeVaultJson(raw: string, fallback: TimeVaultCase): TimeVaultCase | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const candidates: string[] = [text];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/im.exec(text);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const brace = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (brace >= 0 && last > brace) {
    candidates.unshift(text.slice(brace, last + 1));
  }
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as {
        title?: string;
        civilization?: string;
        intro?: string;
        passage?: string;
        events?: Array<{ id?: string; label?: string; year?: number; emoji?: string }>;
        correctOrder?: string[];
        evidenceMap?: Record<string, number>;
      };
      if (!obj.passage || !Array.isArray(obj.events) || obj.events.length < 2) continue;
      if (!Array.isArray(obj.correctOrder) || !obj.evidenceMap) continue;

      const events: TimeVaultEvent[] = obj.events.slice(0, 6).map((e, i) => ({
        id: String(e.id || `e${i}`),
        label: String(e.label || `Event ${i + 1}`),
        year: Number(e.year) || 0,
        emoji: e.emoji || EMOJI_FALLBACK[i % EMOJI_FALLBACK.length],
      }));

      // Correct order must reference valid ids and cover all events.
      const validIds = new Set(events.map((e) => e.id));
      const correctOrder = obj.correctOrder.filter((id) => validIds.has(id));
      const missing = events.filter((e) => !correctOrder.includes(e.id));
      if (missing.length > 0) continue;

      // Evidence map: normalize to valid sentence indices.
      const sentences = splitPassageSentences(obj.passage);
      const evidenceMap: Record<string, number> = {};
      for (const [id, idx] of Object.entries(obj.evidenceMap)) {
        const n = Math.min(Math.max(0, Math.round(Number(idx) || 0)), sentences.length - 1);
        evidenceMap[id] = n;
      }
      if (Object.keys(evidenceMap).length === 0) continue;

      return {
        id: `ai-${Date.now()}`,
        title: String(obj.title || "Mystery Case"),
        civilization: String(obj.civilization || "World History"),
        intro: String(obj.intro || "A scrambled archive needs your detective skills."),
        passage: String(obj.passage),
        events,
        correctOrder,
        evidenceMap,
        difficulty: fallback.difficulty,
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}
