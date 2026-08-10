/**
 * Feedback feasibility analysis engine.
 *
 * Analyzes user-submitted feedback (bug / feature / question / docs),
 * estimates effort and risk, checks against existing roadmap, and
 * produces a recommendation suitable for TODO.md.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export type FeedbackInput = {
  category: "bug" | "feature" | "question" | "docs";
  title: string;
  description: string;
};

export type Effort = "quick_win" | "small" | "medium" | "large" | "epic";

export type AnalysisResult = {
  effort: Effort;
  risk: "low" | "medium" | "high";
  dependencies: string[];
  duplicatesExisting: boolean;
  fitsRoadmap: boolean;
  recommendation: "accept" | "defer" | "reject";
  reason: string;
  /** Suggested TODO.md section to add the item to */
  suggestedSection: string;
};

const PROJECT_ROOT = process.cwd();

function readTodoMd(): string {
  const p = join(PROJECT_ROOT, "docs", "TODO.md");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf-8");
}

function readDesignDocs(): string[] {
  const dir = join(PROJECT_ROOT, "docs", "subsystems");
  if (!existsSync(dir)) return [];
  try {
    const { readdirSync } = require("fs");
    return readdirSync(dir)
      .filter((f: string) => f.endsWith(".md"))
      .map((f: string) => readFileSync(join(dir, f), "utf-8").slice(0, 2000));
  } catch {
    return [];
  }
}

/** Very rough keyword-based effort estimator (conservative — always errs high). */
function estimateEffort(input: FeedbackInput): Effort {
  const text = `${input.title} ${input.description}`.toLowerCase();

  // Epic signals
  if (
    /\b(rewrite|architecture|refactor.*whole|entire.*system|platform|native app|offline mode|real.?time|streaming.*video|live.*class)\b/i.test(text)
  ) {
    return "epic";
  }

  // Large signals
  if (
    /\b(dashboard|analytics|multi.?language.*support|new.*language|auth|login|database|migration|import|export.*all|sync.*cross.?device)\b/i.test(text)
  ) {
    return "large";
  }

  // Medium signals
  if (
    /\b(new.*page|new.*feature|ui.*redesign|redesign|animation|integration|api.*key|payment|subscription|notification|email)\b/i.test(text)
  ) {
    return "medium";
  }

  // Small signals
  if (
    /\b(button|label|color|spacing|padding|typo|wording|add.*link|add.*icon|toggle|switch)\b/i.test(text)
  ) {
    return "small";
  }

  // Default: if it's a bug, quick_win; if feature, medium
  if (input.category === "bug") return "quick_win";
  if (input.category === "docs") return "small";
  if (input.category === "question") return "quick_win";
  return "medium";
}

/** Check if a similar feature/issue already exists in TODO.md or design docs. */
function checkDuplicates(input: FeedbackInput): boolean {
  const todo = readTodoMd().toLowerCase();
  const designs = readDesignDocs().map((d) => d.toLowerCase()).join("\n");
  const corpus = `${todo}\n${designs}`;

  // Extract key phrases from title
  const title = input.title.toLowerCase();
  const words = title
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Check if more than half the significant words appear in existing docs
  if (words.length === 0) return false;
  const matches = words.filter((w) => corpus.includes(w));
  return matches.length >= Math.ceil(words.length * 0.5);
}

/** Check if this aligns with the project roadmap. */
function checkRoadmapFit(input: FeedbackInput): boolean {
  const todo = readTodoMd();
  const text = `${input.title} ${input.description}`.toLowerCase();

  // Explicit non-goals or out-of-scope patterns
  const nonGoals = [
    "leaderboard",
    "streak",
    "badge wall",
    "course catalog",
    "3blue1brown",
    "manim",
    "catalog",
    "multi-tab learning center",
  ];

  for (const ng of nonGoals) {
    if (text.includes(ng)) return false;
  }

  // Positive roadmap signals
  const roadmapSignals = [
    "voice",
    "tts",
    "stt",
    "speech",
    "language",
    "dialect",
    "photo",
    "worksheet",
    "dictionary",
    "translation",
    "theme",
    "mobile",
  ];

  for (const rs of roadmapSignals) {
    if (text.includes(rs)) return true;
  }

  // If the feature relates to existing TODO sections
  if (
    /phase.*voice|phase.*stt|phase.*tts|dialect|multi.?lingual|language.*support/i.test(todo)
  ) {
    return true;
  }

  return false;
}

/** Estimate risk based on category and scope. */
function estimateRisk(input: FeedbackInput, effort: Effort): "low" | "medium" | "high" {
  if (effort === "epic") return "high";
  if (effort === "large") return "medium";
  if (input.category === "bug" && /\b(crash|data.?loss|security|privacy|leak)\b/i.test(input.title + input.description)) {
    return "high";
  }
  if (input.category === "bug") return "low";
  if (input.category === "docs") return "low";
  return "medium";
}

/** Find dependencies by matching against TODO.md section names. */
function findDeps(input: FeedbackInput): string[] {
  const todo = readTodoMd();
  const text = `${input.title} ${input.description}`.toLowerCase();
  const deps: string[] = [];

  const depChecks: [RegExp, string][] = [
    [/\b(voice|tts|stt|speech|microphone|speak)\b/i, "Phase 15 cloud dialect / G dialect speech"],
    [/\b(dictionary|translate|translation)\b/i, "Dictionary / Translation"],
    [/\b(photo|image|camera|worksheet|ocr)\b/i, "CA-1 Worksheet planner / photo workflow"],
    [/\b(theme|dark|light|color|appearance)\b/i, "Phase B Multi-Theme"],
    [/\b(account|switch|login|profile)\b/i, "Phase 13 Multi-Tenant"],
    [/\b(mobile|phone|ios|android|responsive)\b/i, "Phase 0 UI"],
    [/\b(game|entertain|chess|xiangqi|go)\b/i, "Entertainments"],
  ];

  for (const [re, section] of depChecks) {
    if (re.test(text) && todo.toLowerCase().includes(section.toLowerCase())) {
      deps.push(section);
    }
  }

  return deps;
}

/** Main analysis function. */
export function analyzeFeedback(input: FeedbackInput): AnalysisResult {
  const effort = estimateEffort(input);
  const duplicatesExisting = checkDuplicates(input);
  const fitsRoadmap = checkRoadmapFit(input);
  const risk = estimateRisk(input, effort);
  const dependencies = findDeps(input);

  let recommendation: AnalysisResult["recommendation"];
  let reason: string;
  let suggestedSection = "User Feedback";

  if (duplicatesExisting) {
    recommendation = "defer";
    reason = "Similar item already exists in TODO.md or design docs. Consider commenting on the existing plan instead.";
  } else if (!fitsRoadmap) {
    recommendation = "reject";
    reason = "Does not align with project roadmap or falls into explicit non-goals.";
  } else if (effort === "epic") {
    recommendation = "defer";
    reason = "Epic scope — needs dedicated design doc and phased breakdown before committing to TODO.";
    suggestedSection = "User Feedback (needs design doc)";
  } else if (risk === "high") {
    recommendation = "defer";
    reason = "High risk — needs careful design review before implementation.";
    suggestedSection = "User Feedback (needs design doc)";
  } else if (effort === "large" && dependencies.length > 0) {
    recommendation = "defer";
    reason = `Large effort with dependencies: ${dependencies.join(", ")}. Recommend breaking it down into smaller pieces.`;
    suggestedSection = "User Feedback";
  } else {
    recommendation = "accept";
    reason = "Feasible and aligns with roadmap. Adding to TODO.md.";
    if (effort === "quick_win") {
      suggestedSection = "User Feedback (quick wins)";
    } else if (effort === "small") {
      suggestedSection = "User Feedback (small)";
    } else {
      suggestedSection = "User Feedback";
    }
  }

  return {
    effort,
    risk,
    dependencies,
    duplicatesExisting,
    fitsRoadmap,
    recommendation,
    reason,
    suggestedSection,
  };
}

/** Format the analysis as a TODO.md checklist item. */
export function formatTodoItem(
  issueNumber: number,
  input: FeedbackInput,
  analysis: AnalysisResult,
): string {
  const effortLabel = {
    quick_win: "⚡ quick win",
    small: "🔹 small",
    medium: "🔸 medium",
    large: "🔶 large",
    epic: "🔴 epic",
  }[analysis.effort];

  const recLabel = {
    accept: "✅ accepted",
    defer: "⏸️ deferred",
    reject: "❌ rejected",
  }[analysis.recommendation];

  const desc = input.description.slice(0, 120).replace(/\n/g, " ").trim();
  const descSuffix = input.description.length > 120 ? "…" : "";

  return [
    `- [ ] **GH-${issueNumber}** [${input.category}] ${input.title} — ${effortLabel}, ${recLabel}`,
    `  - Description: ${desc}${descSuffix}`,
    `  - Analysis: ${analysis.reason}`,
    ...(analysis.dependencies.length > 0
      ? [`  - Dependencies: ${analysis.dependencies.join(", ")}`]
      : []),
    `  - Created: ${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");
}
