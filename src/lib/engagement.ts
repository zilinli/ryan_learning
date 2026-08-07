/** Lightweight engagement for a 9–10 year-old (streak + daily solves). */

import { FLAT_KEYS, nsKey, readFlatKey, RYAN_ACCOUNT } from "./tenant-storage";

export type EngagementState = {
  streak: number;
  lastActiveDay: string; // YYYY-MM-DD local
  solvesToday: number;
  totalSolves: number;
  badges: string[];
};

const KEY = FLAT_KEYS.engagement;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function emptyEngagement(): EngagementState {
  return {
    streak: 0,
    lastActiveDay: "",
    solvesToday: 0,
    totalSolves: 0,
    badges: [],
  };
}

export function loadEngagement(accountId: string = RYAN_ACCOUNT): EngagementState {
  if (typeof window === "undefined") return emptyEngagement();
  try {
    const nsKeyVal = nsKey(accountId, "engagement");
    const raw = localStorage.getItem(nsKeyVal);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EngagementState>;
      return {
        ...emptyEngagement(),
        ...parsed,
        badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      };
    }
    // Fallback: read flat key — ONLY for the default Ryan account
    if (accountId === RYAN_ACCOUNT) {
      const flatRaw = readFlatKey(FLAT_KEYS.engagement);
      if (flatRaw) {
        const parsed = JSON.parse(flatRaw) as Partial<EngagementState>;
        const result = {
          ...emptyEngagement(),
          ...parsed,
          badges: Array.isArray(parsed.badges) ? parsed.badges : [],
        };
        try { localStorage.setItem(nsKeyVal, JSON.stringify(result)); } catch { /* ignore */ }
        return result;
      }
    }
    return emptyEngagement();
  } catch {
    return emptyEngagement();
  }
}

export function saveEngagement(state: EngagementState, accountId: string = RYAN_ACCOUNT): void {
  try {
    localStorage.setItem(nsKey(accountId, "engagement"), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function unlockBadges(state: EngagementState): string[] {
  const badges = new Set(state.badges);
  if (state.streak >= 3) badges.add("3-day streak");
  if (state.streak >= 7) badges.add("Week warrior");
  if (state.totalSolves >= 10) badges.add("Curious mind");
  if (state.totalSolves >= 50) badges.add("Problem solver");
  if (state.solvesToday >= 3) badges.add("Daily goal ✓");
  return [...badges];
}

/** Call after a successful tutor turn (student engaged). */
export function recordLearningTurn(
  prev: EngagementState = loadEngagement(RYAN_ACCOUNT),
  accountId: string = RYAN_ACCOUNT,
): EngagementState {
  const today = todayKey();
  const yday = yesterdayKey();
  let streak = prev.streak;
  let solvesToday = prev.solvesToday;

  if (prev.lastActiveDay === today) {
    solvesToday += 1;
  } else if (prev.lastActiveDay === yday) {
    streak = Math.max(1, streak) + 1;
    solvesToday = 1;
  } else {
    streak = 1;
    solvesToday = 1;
  }

  const next: EngagementState = {
    streak,
    lastActiveDay: today,
    solvesToday,
    totalSolves: prev.totalSolves + 1,
    badges: [],
  };
  next.badges = unlockBadges(next);
  saveEngagement(next, accountId);
  return next;
}

export function engagementSummary(state: EngagementState): string {
  const parts = [
    `🔥 ${state.streak}d`,
    `今日 ${state.solvesToday}/3`,
  ];
  if (state.totalSolves >= 10) {
    parts.push(`${state.totalSolves} turns`);
  }
  if (state.badges.length) {
    parts.push(state.badges[state.badges.length - 1]!);
  }
  return parts.join(" · ");
}

/** Compact snapshot for tutor prompt / chat body */
export function engagementForPrompt(state: EngagementState): EngagementState {
  return {
    streak: state.streak,
    lastActiveDay: state.lastActiveDay,
    solvesToday: state.solvesToday,
    totalSolves: state.totalSolves,
    badges: state.badges.slice(-3),
  };
}
