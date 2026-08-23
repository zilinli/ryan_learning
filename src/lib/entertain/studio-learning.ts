/**
 * Studio → Learning memory bridge.
 * TED challenges and Writing Studio turns update the active account's
 * BKT skills (subjects / topics) the same way tutor chat does.
 */

import {
  hydrateLearningMemoryFromServer,
  loadLearningMemory,
  pushLearningMemoryToServer,
  recordLearningTurnMemory,
  saveLearningMemory,
  type LearningMemory,
  type TurnOutcome,
} from "@/lib/learning-memory";
import type { TedTopic } from "@/lib/entertain/ted-catalog";

/** Seed phrases so inferSkillsFromText can latch subject skills. */
const TOPIC_SEED: Record<TedTopic, string> = {
  science:
    "science biology chemistry physics evidence experiment hypothesis",
  technology: "technology engineering computer science innovation systems",
  society: "society history government civics culture humanities",
  education: "education school learning teaching reading comprehension",
  creativity: "creativity art design narrative writing imagination",
  ideas: "ideas philosophy argument critical thinking evidence claim",
};

export function tedTopicsToSkillSeed(topics: TedTopic[] | undefined): string {
  if (!topics?.length) return TOPIC_SEED.ideas;
  return topics.map((t) => TOPIC_SEED[t] || t).join(" ");
}

/**
 * Map TED Lab soft-feedback copy → BKT outcome so Studio closes the loop
 * (v4 report: Studio answers must move P(known), not only log practice).
 */
export function studioOutcomeFromSoftFeedback(feedback: string): TurnOutcome {
  const t = feedback.trim();
  if (!t) return "practice";
  if (/^Short answers/i.test(t) || /^Retell should/i.test(t)) {
    return "incorrect";
  }
  if (/^Nice start/i.test(t) || /^Push the critique/i.test(t)) {
    return "practice";
  }
  if (/^Solid draft/i.test(t)) {
    return "correct";
  }
  return "practice";
}

export type StudioLearningSource =
  | "ted"
  | "writing"
  | "natgeo"
  | "bbc"
  | "rsa"
  | "podcast"
  | "game";

/**
 * Record a Studio learning turn into local + server learning memory.
 * Safe to call from client components (browser only).
 */
function sourcePrefix(source: StudioLearningSource): string {
  if (source === "ted") return "[TED Lab challenge]";
  if (source === "natgeo") return "[NatGeo Lab]";
  if (source === "bbc") return "[BBC Doc Lab]";
  if (source === "rsa") return "[RSA Lab]";
  if (source === "podcast") return "[Podcast Lab]";
  if (source === "game") return "[Learning Game]";
  return "[Writing Studio]";
}

function sourceSeed(opts: {
  source: StudioLearningSource;
  tedTopics?: TedTopic[];
  skillSeed?: string;
}): string {
  if (opts.skillSeed) return opts.skillSeed;
  if (opts.source === "ted") return tedTopicsToSkillSeed(opts.tedTopics);
  if (opts.source === "natgeo") {
    return "reading comprehension science geography nature animals history vocabulary inference evidence article main idea";
  }
  if (opts.source === "bbc") {
    return "documentary viewing observation explanation sequence vocabulary science nature technology geography history";
  }
  if (opts.source === "rsa") {
    return "critical thinking argument analysis rhetoric debate philosophy psychology society creativity listening comprehension idea evaluation";
  }
  if (opts.source === "podcast") {
    return "listening comprehension audio podcast main idea details inference vocabulary argument evidence conversation explanation transcript";
  }
  if (opts.source === "game") {
    return "force motion push collide balanced energy gravity science experiment";
  }
  return "narrative writing essay paragraph vocabulary grammar reading comprehension argumentative writing";
}

function sourceChatTitle(source: StudioLearningSource, title: string): string {
  const tag =
    source === "ted"
      ? "TED"
      : source === "natgeo"
        ? "NatGeo"
        : source === "bbc"
          ? "BBC"
          : source === "rsa"
            ? "RSA"
            : source === "podcast"
              ? "Podcast"
              : source === "game"
                ? "Game"
                : "Writing";
  return `${tag} · ${title}`.slice(0, 80);
}

export async function recordStudioLearningTurn(opts: {
  accountId: string;
  source: StudioLearningSource;
  title: string;
  userText: string;
  assistantText?: string;
  tedTopics?: TedTopic[];
  /** Extra skill-latch text (Learning Games pass forces-motion / energy seeds). */
  skillSeed?: string;
  outcome?: TurnOutcome;
}): Promise<LearningMemory | null> {
  if (typeof window === "undefined") return null;
  const accountId = opts.accountId?.trim() || "acct_ryan";
  const seed = sourceSeed(opts);
  const userText = [sourcePrefix(opts.source), opts.title, seed, opts.userText]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);

  try {
    await hydrateLearningMemoryFromServer(accountId);
  } catch {
    /* local-only ok */
  }
  const prev = loadLearningMemory(accountId);
  const next = recordLearningTurnMemory(prev, {
    userText,
    assistantText: opts.assistantText,
    chatTitle: sourceChatTitle(opts.source, opts.title),
    outcome: opts.outcome,
    // V2 attribution — count Studio turns under their mechanism so the
    // parent weekly report can see TED/NatGeo/BBC/RSA/Writing as drivers.
    source: opts.source,
  });
  saveLearningMemory(next, accountId);
  void pushLearningMemoryToServer(next, accountId);
  return next;
}
