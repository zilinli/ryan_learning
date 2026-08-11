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

export type StudioLearningSource = "ted" | "writing";

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
}): Promise<LearningMemory | null> {
  if (typeof window === "undefined") return null;
  const accountId = opts.accountId?.trim() || "acct_ryan";
  const seed =
    opts.source === "ted"
      ? tedTopicsToSkillSeed(opts.tedTopics)
      : "narrative writing essay paragraph vocabulary grammar reading comprehension argumentative writing";
  const userText = [
    opts.source === "ted" ? "[TED Lab challenge]" : "[Writing Studio]",
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
        : `Writing · ${opts.title}`.slice(0, 80),
  });
  saveLearningMemory(next, accountId);
  void pushLearningMemoryToServer(next, accountId);
  return next;
}
