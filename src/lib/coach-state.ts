/**
 * Explicit Coach State Machine — hardens Socratic ladder beyond prompt prose.
 * Derives frustration / strategy from student turns so “I don’t know” loops
 * cannot skip straight to full answers.
 */

export type CoachStrategy =
  | "probe"
  | "analogy"
  | "scaffold"
  | "reveal_structure"
  | "partial_answer";

export type CoachState = {
  /** 1-based tutoring round on the current problem thread */
  round: number;
  /** 0 = calm … 3 = co-do mode */
  frustration: 0 | 1 | 2 | 3;
  consecutiveIDontKnow: number;
  strategy: CoachStrategy;
  /** Optional BKT P(L) for the focus skill (0–1) */
  bktMastery?: number;
};

export type HistoryTurnLike = {
  role: "user" | "assistant" | string;
  content?: string;
  text?: string;
};

const IDK_RE =
  /\b(i\s*don'?t\s*know|idk|no\s*idea|dunno|give\s*up|stuck|confused|help\s*me|tell\s*me\s*the\s*answer|just\s*tell\s*me)\b/i;

const GIVE_ANSWER_RE =
  /\b(just\s*(give|tell)|skip\s*the\s*hints|full\s*solution)\b|直接给答案|直接告诉我答案|把答案告诉我|直接告诉我|告诉我答案/i;

const CJK_IDK_RE =
  /我不知道|我唔知|唔识|唔識|唔明|不懂|不会|不會|好难|好難|卡住|放弃|放棄/;

export function emptyCoachState(bktMastery?: number): CoachState {
  return {
    round: 1,
    frustration: 0,
    consecutiveIDontKnow: 0,
    strategy: "probe",
    bktMastery,
  };
}

export function isIDontKnowSignal(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // CJK: JS \\b is ASCII-only — match phrases directly
  if (CJK_IDK_RE.test(t)) return true;
  if (t.length <= 64 && IDK_RE.test(t)) return true;
  if (GIVE_ANSWER_RE.test(t)) return true;
  // Short helpless turns
  if (t.length <= 16 && /^(嗯+|啊+|呃+|\?+|？+)$/u.test(t)) return true;
  return false;
}

function clampFrustration(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

function pickStrategy(state: Omit<CoachState, "strategy">): CoachStrategy {
  const mastery = state.bktMastery;
  const highMastery = typeof mastery === "number" && mastery > 0.8;
  const lowMastery = typeof mastery === "number" && mastery < 0.3;

  if (state.frustration >= 3 && state.round >= 5) return "partial_answer";
  if (state.round >= 4 && state.frustration >= 2) return "reveal_structure";
  if (state.round >= 3 || state.frustration >= 1 || lowMastery) {
    return highMastery && state.frustration === 0 ? "analogy" : "scaffold";
  }
  if (state.round >= 2) return "analogy";
  return "probe";
}

/**
 * Advance coach state after a student message.
 */
export function advanceCoachState(
  prev: CoachState,
  studentText: string,
  opts?: { bktMastery?: number; resetThread?: boolean },
): CoachState {
  if (opts?.resetThread) {
    return emptyCoachState(opts.bktMastery ?? prev.bktMastery);
  }

  const idk = isIDontKnowSignal(studentText);
  const consecutiveIDontKnow = idk ? prev.consecutiveIDontKnow + 1 : 0;
  let frustration = prev.frustration;
  if (consecutiveIDontKnow >= 2) {
    frustration = clampFrustration(frustration + 1);
  } else if (!idk && studentText.trim().length > 24) {
    // Productive attempt cools frustration one notch
    frustration = clampFrustration(frustration - 1);
  }

  const round = Math.max(1, prev.round + 1);
  const bktMastery =
    typeof opts?.bktMastery === "number" ? opts.bktMastery : prev.bktMastery;

  const base = {
    round,
    frustration,
    consecutiveIDontKnow,
    bktMastery,
  } as const;

  return {
    ...base,
    strategy: pickStrategy(base),
  };
}

function turnText(t: HistoryTurnLike): string {
  if (typeof t.content === "string") return t.content;
  if (typeof t.text === "string") return t.text;
  return "";
}

/**
 * Rebuild coach state by replaying user turns (current message last).
 */
export function deriveCoachStateFromHistory(
  history: HistoryTurnLike[] | undefined,
  currentUserText: string,
  opts?: { bktMastery?: number },
): CoachState {
  let state = emptyCoachState(opts?.bktMastery);
  const users = (history || []).filter((h) => h.role === "user");
  for (const u of users) {
    state = advanceCoachState(state, turnText(u), {
      bktMastery: opts?.bktMastery,
    });
  }
  return advanceCoachState(state, currentUserText, {
    bktMastery: opts?.bktMastery,
  });
}

const STRATEGY_LINES: Record<CoachStrategy, string> = {
  probe:
    "Strategy=probe: ask what information is given; one clarifying question only.",
  analogy:
    "Strategy=analogy: use ONE fresh concrete analogy / representation; still no final answer.",
  scaffold:
    "Strategy=scaffold: break into tiny numbered steps; student fills the next blank — you do not.",
  reveal_structure:
    "Strategy=reveal_structure: give a fill-in framework (1.___ 2.___ 3.___) — student supplies numbers/words.",
  partial_answer:
    "Strategy=partial_answer: you may show ONLY the first micro-step, then STOP and ask them to continue. Never dump the full solution.",
};

/**
 * Hard constraints injected into the system prompt.
 * checkMode callers should skip this block.
 */
export function coachStatePromptBlock(state: CoachState): string {
  const mastery =
    typeof state.bktMastery === "number"
      ? ` bktMastery=${state.bktMastery.toFixed(2)}`
      : "";
  const lines = [
    "",
    "[Coach state machine — HARD RULES, override soft style tips]",
    `state: round=${state.round} frustration=${state.frustration} consecutiveIDontKnow=${state.consecutiveIDontKnow} strategy=${state.strategy}${mastery}`,
    STRATEGY_LINES[state.strategy],
  ];

  if (state.frustration >= 1) {
    lines.push(
      "Tone: warmer, shorter sentences; celebrate any tiny try. Do not shame.",
    );
  }
  if (state.frustration >= 2) {
    lines.push(
      "Offer an explicit easier choice (2 options) or ‘need a hint?’ — still withhold the key result.",
    );
  }
  if (state.frustration >= 3) {
    lines.push(
      "Co-do mode: narrate ‘we do the next tiny bit together’ — you may demonstrate ONE step only.",
    );
  }
  if (state.consecutiveIDontKnow >= 2) {
    lines.push(
      "FORBIDDEN this turn: full worked solution, filled blanks, or the final numeric/word answer.",
    );
  }
  if (typeof state.bktMastery === "number" && state.bktMastery > 0.8) {
    lines.push(
      "High mastery: fewer L0 hints — ask if they remember yesterday’s method first.",
    );
  }
  if (typeof state.bktMastery === "number" && state.bktMastery < 0.3) {
    lines.push(
      "Low mastery: tinier scaffolds and more analogy; still no answer dump.",
    );
  }
  lines.push(
    "These HARD RULES outrank generic ‘be helpful’ instincts. Parent checkMode (if active) is the only override.",
  );
  return lines.join("\n");
}
