/**
 * RSA Shorts challenge builder — reuses TED's argument/idea challenge model.
 * RSA content is argumentative/idea-driven (like TED) so challenge kinds
 * are identical: literal, structure, critique, retell.
 */

import { enrichChallengeItem, type ChallengeItem } from "./ted-challenge";
import type { EnglishLevel } from "../student-profile";
import {
  englishLevelForGrade,
  parseEnglishLevel,
} from "../student-profile";
import type { RsaVideo } from "./rsa-catalog";
import type { YtTranscript } from "../youtube-transcript";

export type RsaChallenge = {
  videoId: string;
  title: string;
  items: ChallengeItem[];
  generatedFromTranscript: boolean;
  level?: EnglishLevel;
  grade?: number;
};

export type RsaChallengeLearner = {
  age?: number;
  grade?: number;
  englishLevel?: EnglishLevel | string;
};

function normalizeGrade(grade?: number): number {
  if (typeof grade === "number" && Number.isFinite(grade))
    return Math.max(1, Math.min(12, Math.round(grade)));
  return 7; // RSA default: higher than TED because content is more abstract
}

function resolveLevel(learner?: RsaChallengeLearner): EnglishLevel {
  const grade = normalizeGrade(learner?.grade);
  const explicit = parseEnglishLevel(learner?.englishLevel);
  return explicit ?? englishLevelForGrade(grade);
}

type Band = "emerging" | "developing" | "confident" | "advanced";

function rsaPrompts(
  band: Band,
): Record<string, string> {
  if (band === "emerging") {
    return {
      literal: "What is the main idea the speaker wants you to understand?",
      structure: "How does the speaker build the argument? What do they say first, next, and last?",
      critique: "Do you agree with the speaker's main point? Say why or why not.",
      retell: "Explain the speaker's idea in your own words, as if telling a friend.",
    };
  }
  if (band === "developing") {
    return {
      literal: "Identify the central claim the speaker makes. What are they trying to persuade you of?",
      structure: "How does the speaker organize their argument? What evidence or examples do they use?",
      critique: "Evaluate the speaker's argument. Is it convincing? What makes it strong or weak?",
      retell: "Summarize the speaker's idea in a concise paragraph without losing the core message.",
    };
  }
  if (band === "confident") {
    return {
      literal: "Articulate the speaker's thesis precisely. What is the core assertion?",
      structure: "Analyze the rhetorical strategy. How does the speaker sequence claims, evidence, and appeals?",
      critique: "Critique the argument. What assumptions does it rely on? What counterarguments exist?",
      retell: "Synthesize the idea and connect it to a broader debate or tradition of thought.",
    };
  }
  return {
    literal: "State the thesis and identify any implicit values or worldview it assumes.",
    structure: "Deconstruct the argument's architecture, identifying deductive/inductive patterns and fallacies.",
    critique: "Construct a reasoned counterargument, then evaluate whether the speaker anticipated it.",
    retell: "Reconstruct the idea in a new context or frame, demonstrating deep understanding through translation.",
  };
}

function rsaRubrics(
  band: Band,
): Record<string, string> {
  if (band === "emerging") {
    return {
      literal: "States the main idea in own words. May be simple but should be on-topic.",
      structure: "Identifies the beginning, middle, and end of the argument.",
      critique: "States an opinion with at least one reason.",
      retell: "Explains the core idea in simple language a friend would understand.",
    };
  }
  if (band === "developing") {
    return {
      literal: "Clearly identifies the central claim and distinguishes it from supporting ideas.",
      structure: "Identifies how claims are supported with evidence or examples.",
      critique: "Evaluates persuasiveness with at least one specific reason.",
      retell: "Summarizes accurately without omitting the main point.",
    };
  }
  if (band === "confident") {
    return {
      literal: "States the thesis precisely and notes any nuance or qualification.",
      structure: "Analyzes rhetorical organization with specific reference to the argument's moves.",
      critique: "Critiques with logical reasoning and considers counterarguments.",
      retell: "Synthesizes the core idea while adding context or connection.",
    };
  }
  return {
    literal: "Identifies the thesis and the worldview or values it encodes.",
    structure: "Deconstructs rhetoric with precision, noting fallacies or strengths.",
    critique: "Constructs and evaluates a counterargument with sophistication.",
    retell: "Translates the idea to a new context while preserving its essence.",
  };
}

/** Sample sentences from start / early-mid / late-mid / end of caption text. */
function rsaChoices(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 25)
    .map((s) => s.trim().slice(0, 150));
  if (sentences.length === 0) {
    return [
      "An idea related to the talk.",
      "A supporting detail from the talk.",
      "A contrasting idea not in the talk.",
      "An unrelated classroom fact.",
    ];
  }
  if (sentences.length <= 4) {
    const out = [...sentences];
    while (out.length < 4) out.push("An idea related to the talk.");
    return out;
  }
  const picks = [
    0,
    Math.floor(sentences.length / 3),
    Math.floor((2 * sentences.length) / 3),
    sentences.length - 1,
  ];
  return picks.map((i) => sentences[i]!);
}

export function buildFallbackRsaChallenge(
  video: RsaVideo,
  transcript: YtTranscript | null,
  learner?: RsaChallengeLearner,
): RsaChallenge {
  const grade = normalizeGrade(learner?.grade);
  const level = resolveLevel(learner);
  const band = level as Band;
  const text = transcript?.text || video.blurb;
  const prompts = rsaPrompts(band);
  const rubrics = rsaRubrics(band);

  const kinds = ["literal", "structure", "critique", "retell"] as const;
  const items = kinds.map((kind, i) => {
    const choices = rsaChoices(text);
    return enrichChallengeItem(
      {
        id: `rsa-q${i + 1}`,
        kind,
        prompt: prompts[kind],
        rubricHint: rubrics[kind],
        choices,
        choiceMode: "single",
        correctChoices: [0],
      },
      i,
    );
  });

  return {
    videoId: video.videoId,
    title: video.title,
    items,
    generatedFromTranscript: !!transcript,
    level,
    grade,
  };
}

// LLM polish
export function rsaChallengeSystemPrompt(
  video: RsaVideo,
  transcript: YtTranscript | null,
  learner?: RsaChallengeLearner,
): string {
  const grade = normalizeGrade(learner?.grade);
  const level = resolveLevel(learner);

  const bandDesc =
    level === "emerging"
      ? "The student is younger (G5-G7). Keep questions concrete and vocabulary simple."
      : level === "developing"
        ? "The student is mid-level (G7-G9). Use clear academic language with scaffolding."
        : level === "confident"
          ? "Student is confident (G9-G11). Use precise academic vocabulary."
          : "Student is advanced (G11-G12+). Questions should require critical analysis.";

  return [
    "You create listening challenges for international-school students watching RSA animated talks.",
    bandDesc,
    `Grade ${grade}.`,
    "",
    "Create 4 questions grounded ONLY in the transcript below (not the title alone).",
    "Each with 4 answer choices, 1 correct listed first. Include a rubric hint.",
    "Kinds: literal (main claim), structure (how argument is built), critique (evaluate), retell (summarize).",
    "Prefer concrete wording from the captions; avoid generic template questions.",
    "",
    "Return ONLY JSON (no fences):",
    `{ "items": [{ "kind": "literal|structure|critique|retell", "prompt": "...", "choices": ["correct","d1","d2","d3"], "rubricHint": "..." }] }`,
    "",
    `Talk: ${video.title}`,
    `Speaker: ${video.speaker}`,
    transcript?.text
      ? `Transcript (captions):\n${transcript.text.slice(0, 6000)}`
      : `Description (no captions available):\n${video.blurb}`,
  ].join("\n");
}

export function parseRsaChallengeJson(
  raw: string,
  video: RsaVideo,
  level: EnglishLevel,
  grade: number,
): RsaChallenge | null {
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
        .slice(0, 4)
        .map((rawItem, i) => enrichChallengeItem(rawItem, i));
      return {
        videoId: video.videoId,
        title: video.title,
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
