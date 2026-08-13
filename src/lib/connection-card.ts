/**
 * P1 — weekly cross-subject connection card (report §9.4.1).
 * Turns the occasional "Spark Moment" into a weekly rhythm: one card per week
 * showing an explicit link between two ideas ("fractions = ratios = the start
 * of probability"), with an option to go deeper. Explicit connections matter —
 * implicit ones are missed (Interdisciplinary Learning review).
 *
 * Card is picked deterministically by week index so every student sees a
 * rotating set; a "seen this week" flag stops it nagging.
 */

import { kvGet, kvSet } from "./browser-kv";
import { deepDiveWeekKey } from "./deep-dive-week";

export type ConnectionCard = {
  id: string;
  title: string;
  fromLabel: string;
  toLabel: string;
  blurb: string;
  /** Kickoff sent to the chat when the student taps "Show me the link" */
  kickoff: string;
};

export type ConnectionOffer = {
  card: ConnectionCard;
  weekOf: string;
  done: boolean;
};

const KEY_PREFIX = "spark.connectionCard.";

export function connectionCardStorageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId || "default"}`;
}

/**
 * Curated cards (one per ~2 weeks across the year). Each is an explicit
 * conceptual bridge kids can actually verify in a chat conversation.
 */
export const CONNECTION_CARDS: ConnectionCard[] = [
  {
    id: "fraction-ratio-probability",
    title: "Fractions → Ratios → Probability",
    fromLabel: "fractions",
    toLabel: "probability",
    blurb:
      "A fraction is a ratio in disguise, and a ratio is the first step of probability. Same idea, three masks.",
    kickoff:
      "Show me the link: fractions, ratios and probability are the SAME idea wearing three masks. Ask me ONE question to make me see it myself (a pizza or a dice example), then check my explanation.",
  },
  {
    id: "perimeter-area-scale",
    title: "Perimeter → Area → Scale",
    fromLabel: "perimeter & area",
    toLabel: "proportions",
    blurb:
      "Double the side of a square: perimeter doubles, but area quadruples. Why does area grow faster?",
    kickoff:
      "Prove the surprising one to me: when you double a shape's side, perimeter doubles but area quadruples. Use a small square I can check by counting. Then ask me to predict a triple.",
  },
  {
    id: "history-geography",
    title: "History ↔ Geography",
    fromLabel: "history",
    toLabel: "geography",
    blurb:
      "Why did the first civilizations hug rivers? Why does a country's geography shape its history?",
    kickoff:
      "Connect history and geography: pick one ancient civilization and show me how its geography (a river, a desert, a sea) shaped its history. One question at a time, let me figure out the 'why'.",
  },
  {
    id: "music-math",
    title: "Music → Math",
    fromLabel: "music & rhythm",
    toLabel: "fractions",
    blurb:
      "Half notes, quarter notes, eighth notes — rhythm is fractions played with your ears.",
    kickoff:
      "Show me the math inside music: how a whole note splits into halves, quarters and eighths — then test me with a rhythm pattern I have to count out loud.",
  },
  {
    id: "art-geometry",
    title: "Art ↔ Geometry",
    fromLabel: "art",
    toLabel: "geometry",
    blurb:
      "Symmetry, perspective, tiling — artists use geometry on purpose. Make me see it.",
    kickoff:
      "Connect art and geometry: pick a famous art style (tessellation, perspective, or symmetry) and show me the geometry hiding in it. Let me discover the rule before you name it.",
  },
  {
    id: "sports-stats",
    title: "Sports → Statistics",
    fromLabel: "sports",
    toLabel: "statistics",
    blurb:
      "A batting average is a ratio. A '3-point average' is a unit rate. Athletes live inside statistics.",
    kickoff:
      "Use a real sports stat (batting average, points per game, win rate) and show me it's really fractions and ratios. Ask me to compute one from made-up numbers, one step at a time.",
  },
  {
    id: "grammar-logic",
    title: "Grammar ↔ Logic",
    fromLabel: "grammar",
    toLabel: "logic / math",
    blurb:
      "'If it rains, the ground is wet' — grammar's if/then is logic's conditional. Language is logic with rhythm.",
    kickoff:
      "Connect grammar and logic: show me how if/then sentences in English are the same thing as conditionals in logic. Give me a weird sentence and ask if it's true or false, then justify.",
  },
  {
    id: "money-science",
    title: "Money ↔ Science",
    fromLabel: "money & percent",
    toLabel: "science",
    blurb:
      "Compound interest is exponential growth — the same curve as bacteria and radioactive decay.",
    kickoff:
      "Surprise me: compound interest in a bank grows the SAME way populations and radioactive atoms decay (exponential growth). Ask me to predict a doubling, then reveal the connection.",
  },
];

function hashWeek(weekOf: string): number {
  let h = 0;
  for (let i = 0; i < weekOf.length; i++) {
    h = (h * 31 + weekOf.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function cardForWeek(weekOf: string): ConnectionCard {
  return CONNECTION_CARDS[hashWeek(weekOf) % CONNECTION_CARDS.length];
}

/**
 * Build this week's connection offer. Null when already shown this week.
 */
export function buildConnectionOffer(
  accountId: string,
  now = Date.now(),
): ConnectionOffer | null {
  const weekOf = deepDiveWeekKey(now);
  const raw = kvGet(connectionCardStorageKey(accountId));
  try {
    if (raw) {
      const p = JSON.parse(raw) as Partial<ConnectionOffer>;
      if (p && p.weekOf === weekOf && p.card?.id) return null; // already offered
    }
  } catch {
    /* fall through — offer again */
  }
  return { card: cardForWeek(weekOf), weekOf, done: false };
}

/** Record that this week's card was shown (or dismissed). */
export function markConnectionShown(accountId: string, weekOf: string): void {
  const card = cardForWeek(weekOf);
  kvSet(connectionCardStorageKey(accountId), JSON.stringify({ card, weekOf, done: true }));
}
