/**
 * BASIS-aligned writing coach model for Writing Studio.
 * Four dimensions (topic / detail / vocab / grammar) with local heuristics
 * + optional LLM enrichment. UI mirrors Grammarly score + Hemingway color cues.
 */

export type BasisDimensionId = "topic" | "detail" | "vocab" | "grammar";

/** Student writing genre — separate from Stage music mood. */
export type WritingType =
  | "narrative"
  | "persuasive"
  | "descriptive"
  | "expository"
  | "poetry"
  | "lyrics"
  | "free";

export const WRITING_TYPES: Array<{ id: WritingType; label: string }> = [
  { id: "narrative", label: "Narrative" },
  { id: "persuasive", label: "Persuasive" },
  { id: "descriptive", label: "Descriptive" },
  { id: "expository", label: "Expository" },
  { id: "poetry", label: "Poetry" },
  { id: "lyrics", label: "Lyrics" },
  { id: "free", label: "Free write" },
];

export function writingTypeUsesMood(type: WritingType): boolean {
  return type === "lyrics" || type === "poetry";
}

export function structureCtaLabel(
  writingType: WritingType,
  stageKind: "music" | "image" | "video",
): string {
  if (stageKind === "image") return "Structure for image";
  if (stageKind === "video") return "Structure for video";
  if (writingType === "lyrics") return "Turn into lyrics";
  if (writingType === "poetry") return "Shape as poem";
  if (writingType === "free") return "Structure for stage";
  return "Structure essay";
}

export type BasisLevel = "weak" | "ok" | "strong";

export type BasisDimensionScore = {
  id: BasisDimensionId;
  /** Full student-facing label */
  label: string;
  /** Short chip label */
  shortLabel: string;
  /** 1–5 (1 = needs work, 5 = strong) */
  score: number;
  level: BasisLevel;
  tip: string;
  /** Optional snippet from the draft that motivated the tip */
  evidence?: string;
};

export type BasisCoachReport = {
  overall: number;
  headline: string;
  focusIds: BasisDimensionId[];
  dimensions: BasisDimensionScore[];
  craftTip: string;
  questions: string[];
  stats: {
    words: number;
    sentences: number;
    uniqueWords: number;
    uniqueRatio: number;
  };
  /** Plain-text fallback for learning memory / older clients */
  summary: string;
};

export const BASIS_DIMENSION_META: Record<
  BasisDimensionId,
  { label: string; shortLabel: string; help: string }
> = {
  topic: {
    label: "Topic sentence clarity",
    shortLabel: "Topic",
    help: "Can a reader tell what this piece is mainly about in one clear line?",
  },
  detail: {
    label: "Detail support",
    shortLabel: "Detail",
    help: "Concrete sensory evidence — not only general feelings.",
  },
  vocab: {
    label: "Vocabulary diversity",
    shortLabel: "Vocab",
    help: "Precise, varied word choice instead of repeating fillers.",
  },
  grammar: {
    label: "Grammatical accuracy",
    shortLabel: "Grammar",
    help: "Complete sentences, punctuation, and readable structure.",
  },
};

const ORDER: BasisDimensionId[] = ["topic", "detail", "vocab", "grammar"];

function clampScore(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

export function scoreToLevel(score: number): BasisLevel {
  if (score <= 2) return "weak";
  if (score >= 4) return "strong";
  return "ok";
}

export function draftStats(draft: string): BasisCoachReport["stats"] {
  const words = draft.trim().split(/\s+/).filter(Boolean).length;
  const sentences = draft
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
  const unique = new Set(
    draft
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 3),
  );
  const uniqueWords = unique.size;
  const uniqueRatio = words > 0 ? uniqueWords / Math.max(words, 1) : 0;
  return {
    words,
    sentences: Math.max(sentences, words > 0 ? 1 : 0),
    uniqueWords,
    uniqueRatio: Math.round(uniqueRatio * 100) / 100,
  };
}

function scoreTopic(draft: string, stats: BasisCoachReport["stats"]): BasisDimensionScore {
  const meta = BASIS_DIMENSION_META.topic;
  const lines = draft
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] || "";
  let score = 3;
  let tip =
    "Make your first line a clear topic sentence — what is this piece mainly about?";
  let evidence: string | undefined;

  if (stats.words < 8) {
    score = 1;
    tip = "Write one full topic sentence first: who / what / where in one line.";
  } else if (first.length < 12) {
    score = 2;
    tip =
      "Your opening is thin — expand it into one clear topic sentence a stranger could understand.";
    evidence = first.slice(0, 80) || undefined;
  } else if (!/[.!?]$/.test(first) && first.split(/\s+/).length < 6) {
    score = 3;
    tip =
      "Opening is on track — finish it as a complete topic sentence (end with . ! or ?).";
    evidence = first.slice(0, 80);
  } else if (
    /\b(thing|stuff|life|things|everything|something)\b/i.test(first) &&
    first.split(/\s+/).length < 14
  ) {
    score = 2;
    tip =
      "Topic is vague ('thing / stuff / life'). Name the one scene or feeling this draft is really about.";
    evidence = first.slice(0, 80);
  } else {
    score = 4;
    tip =
      "Opening reads as a topic sentence — keep later lines answering it with evidence.";
    evidence = first.slice(0, 80);
    if (stats.words > 40 && !draft.includes(first.slice(0, 20))) {
      /* keep */
    }
  }

  return {
    id: "topic",
    label: meta.label,
    shortLabel: meta.shortLabel,
    score: clampScore(score),
    level: scoreToLevel(score),
    tip,
    evidence,
  };
}

function scoreDetail(draft: string, stats: BasisCoachReport["stats"]): BasisDimensionScore {
  const meta = BASIS_DIMENSION_META.detail;
  const sensory =
    draft.match(
      /\b(smell|taste|touch|sound|feel|see|saw|hear|heard|warm|cold|bright|dark|loud|quiet|soft|hard|rough|smooth|rain|light|shadow|bus|phone|glass|desk|window|street|laugh|crack|click)\b/gi,
    ) || [];
  const vague =
    draft.match(/\b(thing|things|stuff|nice|good|bad|amazing|sad|happy)\b/gi) ||
    [];
  let score = 3;
  let tip =
    "Add one concrete sensory detail — a sound, texture, or object someone could film.";
  let evidence: string | undefined;

  if (stats.words < 12) {
    score = 2;
    tip = "Plant us in one moment: place + one object you can see or hear.";
  } else if (sensory.length === 0 && vague.length >= 2) {
    score = 1;
    tip =
      "Draft leans on vague words (thing / stuff / nice). Swap one for a detail only you would notice.";
    evidence = vague[0];
  } else if (sensory.length === 0) {
    score = 2;
    tip =
      "No sensory anchors yet — add a cracked phone screen, bus smell, or one specific laugh.";
  } else if (sensory.length === 1) {
    score = 3;
    tip = `Good start with “${sensory[0]}”. Add a second detail so the chorus has something to hold.`;
    evidence = sensory[0];
  } else {
    score = 4 + (sensory.length >= 4 ? 1 : 0);
    tip = "Detail support is working — keep each image sharper than the last.";
    evidence = sensory.slice(0, 2).join(", ");
  }

  return {
    id: "detail",
    label: meta.label,
    shortLabel: meta.shortLabel,
    score: clampScore(score),
    level: scoreToLevel(score),
    tip,
    evidence,
  };
}

function scoreVocab(draft: string, stats: BasisCoachReport["stats"]): BasisDimensionScore {
  const meta = BASIS_DIMENSION_META.vocab;
  const tokens = draft
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3);
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  const repeated = [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1]);
  const ratio = stats.uniqueRatio;
  let score = 3;
  let tip =
    "Ban one filler word for this draft — replace it with a concrete noun or verb.";
  let evidence: string | undefined;

  if (stats.words < 12) {
    score = 2;
    tip = "Need more words before vocabulary can stretch — write 3 more lines first.";
  } else if (repeated.length > 0 && ratio < 0.45) {
    score = 2;
    tip = `“${repeated[0]![0]}” shows up ${repeated[0]![1]}× — swap one for a more precise word.`;
    evidence = repeated[0]![0];
  } else if (ratio < 0.5) {
    score = 2;
    tip =
      "Vocabulary is circling the same words. Replace one common verb with a sharper choice.";
  } else if (ratio < 0.7) {
    score = 3;
    tip =
      "Word choice is clear. Push one line toward a more precise verb or image word.";
  } else {
    score = 4 + (ratio > 0.85 ? 1 : 0);
    tip = "Vocabulary variety looks healthy — keep precision over decoration.";
  }

  return {
    id: "vocab",
    label: meta.label,
    shortLabel: meta.shortLabel,
    score: clampScore(score),
    level: scoreToLevel(score),
    tip,
    evidence,
  };
}

function scoreGrammar(
  draft: string,
  stats: BasisCoachReport["stats"],
  grammarMatchCount = 0,
): BasisDimensionScore {
  const meta = BASIS_DIMENSION_META.grammar;
  const hasEnd = /[.!?]/.test(draft);
  const starts = draft
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split(/\s+/)[0]?.toLowerCase() || "");
  const startVariety = new Set(starts.filter(Boolean)).size;
  let score = 3;
  let tip =
    "End at least one line with . ! or ? so sentences feel complete.";
  let evidence: string | undefined;

  if (stats.words < 8) {
    score = 2;
    tip = "Write a complete sentence with a subject and a verb, then end it.";
  } else if (!hasEnd) {
    score = 2;
    tip =
      "No sentence endings yet — add punctuation so the reader can breathe with you.";
  } else if (starts.length >= 4 && startVariety <= 2) {
    score = 2;
    tip =
      "Too many sentences start the same way. Mix a question, a short fragment, or a new opener.";
    evidence = starts[0] || undefined;
  } else if (starts.length >= 3 && startVariety <= 3) {
    score = 3;
    tip =
      "Grammar is readable — vary one sentence opening to lift the rhythm.";
  } else {
    score = 4;
    tip = "Sentences look complete and varied enough to stage.";
  }

  if (grammarMatchCount >= 8) {
    score = Math.min(score, 2);
    tip =
      "Several grammar / spelling marks need fixing — clear the underlined spots first.";
  } else if (grammarMatchCount >= 4) {
    score = Math.min(score, 3);
    tip =
      "A few mechanics marks are open — tap an underline, read why, then apply or rewrite.";
  } else if (grammarMatchCount >= 1 && score >= 4) {
    score = 3;
    tip =
      "Almost clean — fix the remaining underline, then re-check the rhythm of your openings.";
  }

  return {
    id: "grammar",
    label: meta.label,
    shortLabel: meta.shortLabel,
    score: clampScore(score),
    level: scoreToLevel(score),
    tip,
    evidence,
  };
}

function buildHeadline(dims: BasisDimensionScore[], focus: BasisDimensionId[]): string {
  if (focus.length === 0) return "Solid draft — polish one line and stage it.";
  const labels = focus
    .map((id) => dims.find((d) => d.id === id)?.shortLabel || id)
    .join(" + ");
  return `Needs the most work: ${labels.toLowerCase()}.`;
}

function buildQuestions(focus: BasisDimensionId[]): string[] {
  const q: string[] = [];
  if (focus.includes("topic")) {
    q.push(
      "What's the one scene this draft is actually about — before school, after a fight, alone on the walk home?",
    );
  }
  if (focus.includes("detail")) {
    q.push(
      "If a camera could only film one object from your draft, what would it be?",
    );
  }
  if (focus.includes("vocab")) {
    q.push(
      "If you cut every 'thing' / 'stuff', what word is left that only you would use?",
    );
  }
  if (focus.includes("grammar")) {
    q.push(
      "Which line can end with a question the chorus could answer?",
    );
  }
  if (q.length === 0) {
    q.push("Which one line would you keep if you had to cut everything else?");
  }
  return q.slice(0, 2);
}

/** Local BASIS report — always available offline / as LLM fallback. */
export function buildBasisCoachLocal(
  draft: string,
  opts?: { grammarMatchCount?: number; writingType?: WritingType },
): BasisCoachReport {
  const stats = draftStats(draft);
  const dimensions = [
    scoreTopic(draft, stats),
    scoreDetail(draft, stats),
    scoreVocab(draft, stats),
    scoreGrammar(draft, stats, opts?.grammarMatchCount ?? 0),
  ];
  const sorted = [...dimensions].sort((a, b) => a.score - b.score);
  const focusIds = sorted
    .filter((d) => d.score <= 3)
    .slice(0, 2)
    .map((d) => d.id);
  if (focusIds.length === 0) {
    focusIds.push(sorted[0]!.id);
  }
  const overall =
    Math.round(
      (dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) * 10,
    ) / 10;
  const craftTip =
    dimensions.find((d) => d.id === focusIds[0])?.tip ||
    "Chase one honest sentence, then expand around it.";
  const headline = buildHeadline(dimensions, focusIds);
  const questions = buildQuestions(focusIds);
  const summary = [
    headline,
    "",
    ...dimensions.map(
      (d) => `${d.shortLabel} ${d.score}/5 — ${d.tip}`,
    ),
    "",
    `Craft tip: ${craftTip}`,
    "",
    `Questions: ${questions.join(" ")}`,
  ].join("\n");

  return {
    overall,
    headline,
    focusIds,
    dimensions,
    craftTip,
    questions,
    stats,
    summary,
  };
}

/** Merge LLM JSON patches onto a local report (scores + tips). */
export function mergeBasisCoachFromLlm(
  base: BasisCoachReport,
  raw: unknown,
): BasisCoachReport {
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const dimsIn = Array.isArray(o.dimensions) ? o.dimensions : null;
  const byId = new Map<BasisDimensionId, BasisDimensionScore>();
  for (const d of base.dimensions) byId.set(d.id, { ...d });

  if (dimsIn) {
    for (const item of dimsIn) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id || "") as BasisDimensionId;
      if (!ORDER.includes(id)) continue;
      const prev = byId.get(id)!;
      const score = clampScore(Number(row.score ?? prev.score));
      const tip = String(row.tip || prev.tip).trim().slice(0, 280);
      const evidence = String(row.evidence || prev.evidence || "").trim().slice(
        0,
        120,
      );
      byId.set(id, {
        ...prev,
        score,
        level: scoreToLevel(score),
        tip: tip || prev.tip,
        evidence: evidence || prev.evidence,
      });
    }
  }

  const dimensions = ORDER.map((id) => byId.get(id)!);
  let focusIds = Array.isArray(o.focusIds)
    ? (o.focusIds as unknown[])
        .map((x) => String(x) as BasisDimensionId)
        .filter((id) => ORDER.includes(id))
        .slice(0, 2)
    : [];
  if (!focusIds.length) {
    focusIds = [...dimensions]
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((d) => d.id);
  }
  const craftTip =
    String(o.craftTip || "").trim().slice(0, 320) ||
    dimensions.find((d) => d.id === focusIds[0])?.tip ||
    base.craftTip;
  const questions = Array.isArray(o.questions)
    ? (o.questions as unknown[])
        .map((q) => String(q).trim())
        .filter(Boolean)
        .slice(0, 3)
    : base.questions;
  const headline =
    String(o.headline || "").trim().slice(0, 160) ||
    buildHeadline(dimensions, focusIds);
  const overall =
    Math.round(
      (dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) * 10,
    ) / 10;
  const summary = [
    headline,
    "",
    ...dimensions.map((d) => `${d.shortLabel} ${d.score}/5 — ${d.tip}`),
    "",
    `Craft tip: ${craftTip}`,
    "",
    `Questions: ${questions.join(" ")}`,
  ].join("\n");

  return {
    overall,
    headline,
    focusIds,
    dimensions,
    craftTip,
    questions: questions.length ? questions : base.questions,
    stats: base.stats,
    summary,
  };
}

export function basisCoachAgentPrompt(
  draft: string,
  genre: string,
  writingType: WritingType = "free",
): string {
  const typeHint =
    writingType === "persuasive"
      ? "Emphasize thesis clarity + evidence (topic + detail)."
      : writingType === "narrative"
        ? "Emphasize scene, character beat, and sensory detail."
        : writingType === "expository"
          ? "Emphasize clear topic sentence + organized explanation."
          : writingType === "descriptive"
            ? "Emphasize sensory precision and focused subject."
            : writingType === "lyrics" || writingType === "poetry"
              ? "Allow freer line breaks; still flag unclear meaning and weak verbs."
              : "Balance all four dimensions.";
  return [
    "You are Spark — a calm writing tutor for an international-school student (BASIS-aligned).",
    "Assess the draft on exactly 4 dimensions, then prep a Socratic opener. Return ONLY JSON:",
    JSON.stringify({
      headline: "Needs the most work: …",
      focusIds: ["detail", "vocab"],
      craftTip: "One tiny craft nudge (not a rewrite).",
      questions: [
        "ONE sharp question the student must answer next?",
        "Optional second question if needed?",
      ],
      dimensions: [
        {
          id: "topic",
          score: 3,
          tip: "…",
          evidence: "short quote from draft",
        },
        { id: "detail", score: 2, tip: "…", evidence: "…" },
        { id: "vocab", score: 2, tip: "…" },
        { id: "grammar", score: 4, tip: "…" },
      ],
    }),
    "Scores are integers 1–5. Pick 1–2 focusIds (weakest).",
    "questions[0] must be ONE clear Think-first question (feelings, detail, or clarity) — the chat will ask it after praise.",
    "Put the best draft quote in evidence on the strongest or focus dimension when you can.",
    "Never rewrite the whole draft. Never be babyish.",
    "Dimensions: topic=Topic sentence clarity; detail=Detail support; vocab=Vocabulary diversity; grammar=Grammatical accuracy.",
    `Writing type: ${writingType}. ${typeHint}`,
    `Mood / genre vibe (for Stage): ${genre}.`,
    "",
    "Draft:",
    draft,
  ].join("\n");
}
