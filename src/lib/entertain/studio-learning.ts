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

export type StudioLearningSource = "ted" | "writing" | "natgeo" | "bbc" | "rsa";

/**
 * Record a Studio learning turn into local + server learning memory.
 * Safe to call from client components (browser only).
 */
export async function recordStudioLearningTurn(opts: {
  accountId: string;
  source: StudioLearningSource;
  title: string;
  userText: string;
  assistantText?: string;
  tedTopics?: TedTopic[];
  outcome?: TurnOutcome;
}): Promise<LearningMemory | null> {
  if (typeof window === "undefined") return null;
  const accountId = opts.accountId?.trim() || "acct_ryan";
  const seed =
    opts.source === "ted"
      ? tedTopicsToSkillSeed(opts.tedTopics)
      : opts.source === "natgeo"
        ? "reading comprehension science geography nature animals history vocabulary inference evidence article main idea"
        : opts.source === "bbc"
          ? "documentary viewing observation explanation sequence vocabulary science nature technology geography history"
          : opts.source === "rsa"
            ? "critical thinking argument analysis rhetoric debate philosophy psychology society creativity listening comprehension idea evaluation"
            : "narrative writing essay paragraph vocabulary grammar reading comprehension argumentative writing";
  const userText = [
    opts.source === "ted"
      ? "[TED Lab challenge]"
      : opts.source === "natgeo"
        ? "[NatGeo Lab]"
        : opts.source === "bbc"
          ? "[BBC Doc Lab]"
          : opts.source === "rsa"
            ? "[RSA Lab]"
            : "[Writing Studio]",
    opts.title,
    seed,
    opts.userText,
  ]
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
    chatTitle:
      opts.source === "ted"
        ? `TED · ${opts.title}`.slice(0, 80)
        : opts.source === "natgeo"
          ? `NatGeo · ${opts.title}`.slice(0, 80)
          : opts.source === "bbc"
            ? `BBC · ${opts.title}`.slice(0, 80)
            : opts.source === "rsa"
              ? `RSA · ${opts.title}`.slice(0, 80)
              : `Writing · ${opts.title}`.slice(0, 80),
    outcome: opts.outcome,
    // V2 attribution — count Studio turns under their mechanism so the
    // parent weekly report can see TED/NatGeo/BBC/RSA/Writing as drivers.
    source: opts.source,
  });
  saveLearningMemory(next, accountId);
  void pushLearningMemoryToServer(next, accountId);
  return next;
}
