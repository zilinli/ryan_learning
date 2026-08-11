/**
 * Adult gate helpers — industry pattern (YouTube Kids / Google Building for Kids):
 * PIN for routine unlock; harder adult challenge before PIN reset so kids can't one-tap bypass.
 */

import {
  clearParentPin,
  hasParentPin,
  isParentSessionUnlocked,
  lockParentSession,
  saveParentPin,
  unlockParentSession,
  verifyParentPin,
  PARENT_PIN_LENGTH,
} from "./parent-pin";

export {
  clearParentPin,
  hasParentPin,
  isParentSessionUnlocked,
  lockParentSession,
  saveParentPin,
  unlockParentSession,
  verifyParentPin,
  PARENT_PIN_LENGTH,
};

export type AdultChallenge = {
  id: string;
  prompt: string;
  /** Canonical numeric or string answer (trimmed, case-insensitive for words). */
  answer: string;
};

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Fresh challenge each call — harder than impulsive G4 tapping. */
export function createAdultChallenge(now = Date.now()): AdultChallenge {
  const roll = randInt(0, 3);
  if (roll === 0) {
    const a = randInt(28, 79);
    const b = randInt(17, 48);
    return {
      id: `add-${now}`,
      prompt: `What is ${a} + ${b}?`,
      answer: String(a + b),
    };
  }
  if (roll === 1) {
    const a = randInt(7, 12);
    const b = randInt(8, 12);
    return {
      id: `mul-${now}`,
      prompt: `What is ${a} × ${b}?`,
      answer: String(a * b),
    };
  }
  if (roll === 2) {
    const hours = randInt(2, 5);
    return {
      id: `min-${now}`,
      prompt: `How many minutes are in ${hours} hours?`,
      answer: String(hours * 60),
    };
  }
  const year = new Date(now).getFullYear();
  return {
    id: `year-${now}`,
    prompt: `What year is it right now? (4 digits)`,
    answer: String(year),
  };
}

export function checkAdultChallenge(
  challenge: AdultChallenge,
  raw: string,
): boolean {
  const got = (raw || "").trim().toLowerCase();
  if (!got) return false;
  return got === challenge.answer.trim().toLowerCase();
}
