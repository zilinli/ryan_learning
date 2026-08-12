/**
 * NatGeo reading-comprehension challenge builder.
 *
 * Generates 4-5 comprehension questions from article text,
 * adapted to the learner's grade and English level.
 * Reuses enrichChallengeItem, ChoiceMode, ChallengeItem from ted-challenge.
 */

import { enrichChallengeItem, type ChallengeItem } from "./ted-challenge";
import type { EnglishLevel } from "../student-profile";
import {
  englishLevelForGrade,
  parseEnglishLevel,
} from "../student-profile";
import type { NatGeoArticle } from "./natgeo-catalog";

export type NatGeoChallengeKind =
  | "vocabulary"
  | "main-idea"
  | "detail"
  | "inference"
  | "connection";

export type NatGeoChallenge = {
  articleSlug: string;
  title: string;
  items: ChallengeItem[];
  generatedFromAI: boolean;
  level?: EnglishLevel;
  grade?: number;
};

export type NatGeoChallengeLearner = {
  age?: number;
  grade?: number;
  englishLevel?: EnglishLevel | string;
};

function normalizeGrade(grade?: number): number {
  if (typeof grade === "number" && Number.isFinite(grade)) {
    return Math.max(1, Math.min(12, Math.round(grade)));
  }
  return 4;
}

function resolveLevel(learner?: NatGeoChallengeLearner): EnglishLevel {
  const grade = normalizeGrade(learner?.grade);
  const explicit = parseEnglishLevel(learner?.englishLevel);
  return explicit ?? englishLevelForGrade(grade);
}

// ---------------------------------------------------------------------------
// Prompt text templates by band
// ---------------------------------------------------------------------------

type Band = "emerging" | "developing" | "confident" | "advanced";

function bandPrompts(band: Band): Record<NatGeoChallengeKind, string> {
  if (band === "emerging") {
    return {
      vocabulary: "What does the word mean in the article? Read it again if you need to!",
      "main-idea": "What is the article MOSTLY about? Pick the best answer.",
      detail: "Find one specific fact or number mentioned in the article.",
      inference: "Why do you think this is important? What can you guess from what you read?",
      connection: "Have you ever seen or learned about something similar? Tell me about it.",
    };
  }
  if (band === "developing") {
    return {
      vocabulary: "Explain what this word means based on how it is used in the article.",
      "main-idea": "What is the author's main point? Choose the best summary.",
      detail: "Pick out one important detail the author uses to support the main idea.",
      inference: "What can you infer from the article? What does the author want you to understand without saying it directly?",
      connection: "How does this topic connect to something you already know or have experienced?",
    };
  }
  if (band === "confident") {
    return {
      vocabulary: "Define this term in your own words. How does the context shape its meaning?",
      "main-idea": "Summarize the central claim of the article in one sentence.",
      detail: "Identify a piece of evidence the author provides. How does it strengthen the argument?",
      inference: "What underlying idea or perspective does the author communicate without stating outright?",
      connection: "How does this article relate to a broader issue or another subject you've studied?",
    };
  }
  // advanced
  return {
    vocabulary: "Analyze the author's choice of this word. What connotation does it carry, and why might the author have chosen it over a synonym?",
    "main-idea": "Articulate the thesis of the article. What claim is the author advancing, and what counterarguments might exist?",
    detail: "Select the strongest piece of evidence the author presents and evaluate its validity.",
    inference: "What implicit assumptions or biases can you detect in the article? How do they shape the argument?",
    connection: "Synthesize the article's ideas with your own knowledge. What new question does this article raise for you?",
  };
}

function bandRubric(band: Band): Record<NatGeoChallengeKind, string> {
  if (band === "emerging") {
    return {
      vocabulary: "Uses context clues. Shows understanding the word is new.",
      "main-idea": "Identifies the general topic. Does not need precise wording.",
      detail: "Names a specific fact, number, or example from the article.",
      inference: "Makes a reasonable guess beyond what is directly stated.",
      connection: "Relates the topic to a personal experience or earlier learning.",
    };
  }
  if (band === "developing") {
    return {
      vocabulary: "Explains the word using the surrounding sentences. Shows cause-effect or synonym.",
      "main-idea": "Captures the central message, not a peripheral detail.",
      detail: "Cites a specific fact that directly supports the main point.",
      inference: "Draws a logical conclusion that goes beyond the text without contradicting it.",
      connection: "Links to prior knowledge or real-world examples meaningfully.",
    };
  }
  if (band === "confident") {
    return {
      vocabulary: "Defines the term precisely and explains its function in the article's argument.",
      "main-idea": "States the thesis clearly. Avoids giving a list of facts.",
      detail: "Identifies evidence AND explains how it supports the claim.",
      inference: "Identifies unstated perspectives or author intent with textual support.",
      connection: "Makes a substantive link to another domain or broader issue.",
    };
  }
  // advanced
  return {
    vocabulary: "Analyzes word choice with attention to connotation, register, and rhetorical effect.",
    "main-idea": "States the thesis and identifies a counterargument or limitation.",
    detail: "Evaluates the quality of evidence, noting assumptions or gaps.",
    inference: "Identifies underlying assumptions or biases with clear reasoning.",
    connection: "Synthesizes multiple ideas into a new question or insight.",
  };
}

function bandChoices(band: Band, kind: NatGeoChallengeKind, article: NatGeoArticle): string[] {
  const sentences = article.body.split(/[.!?]+\s*/).filter((s) => s.trim().length > 20);
  const hooks = sentences.slice(0, 8).map((s) => s.trim().slice(0, 120));
  if (hooks.length < 4) {
    while (hooks.length < 4) hooks.push("A key point from the article.");
  }
  const correct = hooks[0]!;
  const distractors = hooks.slice(1, 4).filter((d) => d !== correct);
  while (distractors.length < 3) {
    distractors.push(`A made-up statement that does not appear in the article (option ${distractors.length + 1})`);
  }
  return [correct, ...distractors.slice(0, 3)];
}

// ---------------------------------------------------------------------------
// Build challenge
// ---------------------------------------------------------------------------

export function buildFallbackNatGeoChallenge(
  article: NatGeoArticle,
  learner?: NatGeoChallengeLearner,
): NatGeoChallenge {
  const grade = normalizeGrade(learner?.grade);
  const level = resolveLevel(learner);
  const band = level as Band;

  const kinds: NatGeoChallengeKind[] = [
    "vocabulary",
    "main-idea",
    "detail",
    "inference",
    "connection",
  ];
  const prompts = bandPrompts(band);
  const rubrics = bandRubric(band);

  const sentences = article.body.split(/[.!?]+\s*/).filter((s) => s.trim().length > 20);
  const midSentence = sentences[Math.floor(sentences.length / 2)]?.trim() || "";

  const longWords = article.body
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 6 && /[aeiou]/.test(w))
    .slice(0, 5);
  const vocabWord = longWords[Math.floor(Math.random() * longWords.length)] || "important";

  const items = kinds.map((kind, i) => {
    const isVocab = kind === "vocabulary";
    const isMainIdea = kind === "main-idea";
    const specificPrompt = isVocab
      ? prompts[kind].replace(/word|term/i, `"${vocabWord}"`)
      : isMainIdea
        ? prompts[kind]
        : prompts[kind];
    const choices = bandChoices(band, kind, article);
    return enrichChallengeItem(
      {
        id: `ng-q${i + 1}`,
        kind: mapKind(kind),
        prompt: specificPrompt,
        rubricHint: isVocab
          ? rubrics[kind].replace(/word|term/i, `"${vocabWord}"`)
          : rubrics[kind],
        choices,
        choiceMode: kind === "connection" ? "single" : "single",
        correctChoices: [0],
      },
      i,
    );
  });

  return {
    articleSlug: article.slug,
    title: article.title,
    items,
    generatedFromAI: false,
    level,
    grade,
  };
}

function mapKind(kind: NatGeoChallengeKind): string {
  const map: Record<NatGeoChallengeKind, string> = {
    vocabulary: "literal",
    "main-idea": "structure",
    detail: "literal",
    inference: "critique",
    connection: "retell",
  };
  return map[kind] || "literal";
}

// ---------------------------------------------------------------------------
// LLM challenge polish (reuses TED Agent pattern)
// ---------------------------------------------------------------------------

export function natgeoChallengeSystemPrompt(
  article: NatGeoArticle,
  learner?: NatGeoChallengeLearner,
): string {
  const grade = normalizeGrade(learner?.grade);
  const level = resolveLevel(learner);

  const bandDesc =
    level === "emerging"
      ? "The student is a younger child (G2-G4) still building English vocabulary. Keep sentences short. Use concrete examples."
      : level === "developing"
        ? "The student is a mid-primary learner (G4-G6). Questions should be clear and scaffolded, with simple vocabulary."
        : level === "confident"
          ? "The student is a strong upper-primary / lower-secondary reader (G6-G9). Use precise academic language."
          : "The student is an advanced reader (G9-G12). Questions should require analysis and synthesis.";

  return [
    "You create reading-comprehension challenges for an international-school student.",
    bandDesc,
    `The student is in grade ${grade}.`,
    "",
    "Create 5 questions from the following article. Each question must have 4 answer choices with exactly 1 correct answer listed first. Include a rubric hint for each.",
    "Kinds: vocabulary, main-idea, detail, inference, connection",
    "",
    "Return ONLY a JSON object (no markdown fences):",
    `{ "items": [{ "kind": "vocabulary|main-idea|detail|inference|connection", "prompt": "...", "choices": ["correct","d1","d2","d3"], "rubricHint": "..." }] }`,
    "",
    "Article title: " + article.title,
    "Article body:",
    article.body.slice(0, 8000),
  ].join("\n");
}

export function parseNatGeoChallengeJson(
  raw: string,
  article: NatGeoArticle,
  level: EnglishLevel,
  grade: number,
): NatGeoChallenge | null {
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
      const obj = JSON.parse(c) as { items?: Array<Record<string, unknown>> };
      if (!Array.isArray(obj.items) || obj.items.length === 0) continue;
      const items = obj.items.slice(0, 5).map((rawItem, i) =>
        enrichChallengeItem(rawItem, i),
      );
      return { articleSlug: article.slug, title: article.title, items, generatedFromAI: true, level, grade };
    } catch {
      // try next
    }
  }
  return null;
}
