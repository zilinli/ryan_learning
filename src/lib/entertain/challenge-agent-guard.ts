/**
 * Low-RAM hosts (≈4 GB) can OOM when Cursor Agent + Next run together.
 * Prefer deterministic fallback challenges when free memory is tight.
 */

import { freemem } from "node:os";

const DEFAULT_MIN_FREE_MB = 350;

export function canAffordChallengeAgent(
  minFreeMb = DEFAULT_MIN_FREE_MB,
): boolean {
  return freemem() / (1024 * 1024) >= minFreeMb;
}
