/**
 * BBC documentary challenge builder — observation/explanation/narrative model.
 * Generates 4-5 comprehension questions from documentary transcript.
 * Uses enrichChallengeItem from ted-challenge for MCQ padding.
 */

import { enrichChallengeItem } from "./ted-challenge";
import type { ChallengeItem } from "./ted-challenge";
import type { EnglishLevel } from "../student-profile";
import {
  englishLevelForGrade,
  parseEnglishLevel,
} from "../student-profile";
import type { BbcClip } from "./bbc-catalog";
import type { YtTranscript } from "../youtube-transcript";

type BbcChallengeKind =
  | "observation"
  | "explanation"
  | "sequence"
  | "vocabulary"
  | "connection";

export type BbcChallenge = {
  videoId: string;
  title: string;
  items: ChallengeItem[];
  generatedFromTranscript: boolean;
  level?: EnglishLevel;
  grade?: number;
};

export type BbcChallengeLearner = {
  age?: number;
  grade?: number;
  englishLevel?: EnglishLevel | string;
};

function normalizeGrade(grade?: number): number {
  if (typeof grade === "number" && Number.isFinite(grade))
    return Math.max(1, Math.min(12, Math.round(grade)));
  return 4;
}

function resolveLevel(learner?: BbcChallengeLearner): EnglishLevel {
  const grade = normalizeGrade(learner?.grade);
  const explicit = parseEnglishLevel(learner?.englishLevel);
  return explicit ?? englishLevelForGrade(grade);
}

type Band = "emerging" | "developing" | "confident" | "advanced";

function kindPrompts(
  band: Band,
): Record<BbcChallengeKind, string> {
  if (band === "emerging") {
    return {
      observation: "What did you SEE in this clip? Name one animal, place, or event.",
      explanation: "Why do you think this happens? Try to explain in your own words.",
      sequence: "What happened first? What happened next?",
      vocabulary: "What do you think the word means?",
      connection: "Does this remind you of something you've seen or learned before?",
    };
  }
  if (band === "developing") {
    return {
      observation: "Describe one striking visual detail or event from the documentary. What made it memorable?",
      explanation: "Explain the cause or process shown in the clip. Use evidence from the footage.",
      sequence: "Put the main events in order. What caused what?",
      vocabulary: "Define this term as used in the documentary. What context helps you understand it?",
      connection: "How does this documentary connect to something you've studied or experienced?",
    };
  }
  if (band === "confident") {
    return {
      observation: "Analyze a specific scene that supports the documentary's main message. What does the cinematography communicate?",
      explanation: "Explain the scientific mechanism or ecosystem relationship shown. Be precise.",
      sequence: "Trace the causal chain the documentary presents. What is the central relationship?",
      vocabulary: "Define this term and explain why the documentary uses it rather than a simpler synonym.",
      connection: "How does the documentary's perspective on this topic compare with another source?",
    };
  }
  return {
    observation: "Evaluate how the documentary uses visual evidence to build its argument. Is there any visual manipulation?",
    explanation: "Critically assess the explanation the documentary provides. What's missing or oversimplified?",
    sequence: "Map the documentary's narrative structure. Where is exposition vs. climax vs. resolution?",
    vocabulary: "Analyze the rhetorical function of this term. What assumptions does it encode?",
    connection: "Synthesize the documentary's insights with knowledge from another discipline.",
  };
}

function kindRubrics(
  band: Band,
): Record<BbcChallengeKind, string> {
  if (band === "emerging") {
    return {
      observation: "Names at least one specific detail from the footage.",
      explanation: "Makes a reasonable guess at cause and effect.",
      sequence: "Orders events correctly.",
      vocabulary: "Gives a simple definition using context.",
      connection: "Relates to personal experience or prior learning.",
    };
  }
  if (band === "developing") {
    return {
      observation: "Describes a specific visual scene with some precision.",
      explanation: "Explains a cause-effect relationship with support from the clip.",
      sequence: "Correctly orders events and identifies at least one causal link.",
      vocabulary: "Defines clearly using documentary context.",
      connection: "Makes a meaningful link to another topic or experience.",
    };
  }
  if (band === "confident") {
    return {
      observation: "Analyzes how a specific scene advances the documentary's narrative or thesis.",
      explanation: "Explains a mechanism precisely, referencing evidence from the clip.",
      sequence: "Maps temporal and causal structure with accurate detail.",
      vocabulary: "Defines the term and explains why the documentary chose this specific word.",
      connection: "Compares perspective across sources meaningfully.",
    };
  }
  return {
    observation: "Evaluates evidence quality and identifies visual rhetorical strategies.",
    explanation: "Critiques the explanation, noting gaps or assumptions.",
    sequence: "Analyzes narrative structure and pacing with critical awareness.",
    vocabulary: "Analyzes rhetorical function and encoded assumptions.",
    connection: "Synthesizes across disciplines with insight.",
  };
}

function bandChoices(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20)
    .slice(0, 8)
    .map((s) => s.trim().slice(0, 150));
  if (sentences.length < 4) {
    while (sentences.length < 4)
      sentences.push("A detail related to the documentary.");
  }
  return [sentences[0]!, ...sentences.slice(1, 4)];
}

export function buildFallbackBbcChallenge(
  clip: BbcClip,
  transcript: YtTranscript | null,
  learner?: BbcChallengeLearner,
): BbcChallenge {
  const grade = normalizeGrade(learner?.grade);
  const level = resolveLevel(learner);
  const band = level as Band;
  const text = transcript?.text || clip.blurb;

  const kinds: BbcChallengeKind[] = [
    "observation",
    "explanation",
    "sequence",
    "vocabulary",
    "connection",
  ];
  const prompts = kindPrompts(band);
  const rubrics = kindRubrics(band);

  const longWords = text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 6 && /[aeiou]/.test(w))
    .slice(0, 5);
  const vocabWord = longWords[Math.floor(Math.random() * longWords.length)] || "documentary";

  const items = kinds.map((kind, i) => {
    const isVocab = kind === "vocabulary";
    const prompt = isVocab
      ? prompts[kind].replace(/\b(word|term)\b/i, `"${vocabWord}"`)
      : prompts[kind];
    const rubric = isVocab
      ? rubrics[kind].replace(/\b(word|term)\b/i, `"${vocabWord}"`)
      : rubrics[kind];
    const choices = bandChoices(text);

    return enrichChallengeItem(
      {
        id: `bbc-q${i + 1}`,
        kind: mapBbcKind(kind),
        prompt,
        rubricHint: rubric,
        choices,
        choiceMode: "single",
        correctChoices: [0],
      },
      i,
    );
  });

  return {
    videoId: clip.videoId,
    title: clip.title,
    items,
    generatedFromTranscript: !!transcript,
    level,
    grade,
  };
}

function mapBbcKind(k: BbcChallengeKind): string {
  const map: Record<BbcChallengeKind, string> = {
    observation: "literal",
    explanation: "structure",
    sequence: "literal",
    vocabulary: "literal",
    connection: "retell",
  };
  return map[k] || "literal";
}

// LLM polish prompts
export function bbcChallengeSystemPrompt(
  clip: BbcClip,
  transcript: YtTranscript | null,
  learner?: BbcChallengeLearner,
): string {
  const grade = normalizeGrade(learner?.grade);
  const level = resolveLevel(learner);

  const bandDesc =
    level === "emerging"
      ? "The student is a younger child (G3-G5) building English. Use simple, concrete questions."
      : level === "developing"
        ? "The student is a mid-primary learner (G5-G7). Questions should be clear with moderate vocabulary."
        : level === "confident"
          ? "The student is a strong reader/viewer (G7-G10). Use academic vocabulary."
          : "The student is advanced (G10-G12). Questions should require analysis.";

  return [
    "You create documentary-viewing challenges for international-school students.",
    bandDesc,
    `Grade ${grade}.`,
    "",
    "Create 5 questions from this BBC documentary clip transcript. Each with 4 answer choices, 1 correct listed first. Include a rubric hint.",
    "Kinds: observation, explanation, sequence, vocabulary, connection",
    "",
    "Return ONLY JSON (no fences):",
    `{ "items": [{ "kind": "observation|explanation|sequence|vocabulary|connection", "prompt": "...", "choices": ["A correct", "B", "C", "D"], "rubricHint": "..." }] }`,
    "",
    `Title: ${clip.title}`,
    `Series: ${clip.series}`,
    transcript?.text
      ? `Transcript:\n${transcript.text.slice(0, 6000)}`
      : `Blurb: ${clip.blurb}`,
  ].join("\n");
}

export function parseBbcChallengeJson(
  raw: string,
  clip: BbcClip,
  level: EnglishLevel,
  grade: number,
): BbcChallenge | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const candidates: string[] = [text];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/im.exec(text);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const brace = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (brace >= 0 && last > brace)
    candidates.unshift(text.slice(brace, last + 1));
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as { items?: Array<Record<string, unknown>> };
      if (!Array.isArray(obj.items) || obj.items.length === 0) continue;
      const items = obj.items
        .slice(0, 5)
        .map((rawItem, i) => enrichChallengeItem(rawItem, i));
      return {
        videoId: clip.videoId,
        title: clip.title,
        items,
        generatedFromTranscript: true,
        level,
        grade,
      };
    } catch {
      // try next
    }
  }
  return null;
}
