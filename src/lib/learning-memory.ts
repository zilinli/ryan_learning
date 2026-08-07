/**
 * Cross-session learning memory for Ryan.
 * Combines:
 * - Coarse topic buckets (legacy UI / continuity)
 * - Fine-grained skills with Bayesian Knowledge Tracing (BKT)
 * - SM-2 spaced repetition for forgetting decay
 * - Confidence-weighted BKT updates
 * - ZPD-based warm-up skill selection
 * - Recall cache for prompt context snippets
 *
 * Stored in localStorage (per-account namespaced) + synced to /api/learning.
 */

import {
  FLAT_KEYS,
  isAccountMigrated,
  markMigrated,
  nsKey,
  readFlatKey,
  RYAN_ACCOUNT,
} from "./tenant-storage";
import {
  applySm2Decay,
  bktDefaultsForBand,
  DEFAULT_BKT,
  DEFAULT_ELO,
  DEFAULT_SM2,
  difficultyAdjustedBktParams,
  eloUpdate,
  masteryFromPKnown,
  outcomeToSm2Quality,
  pKnownFromMastery,
  sm2Update,
  softBktUpdate,
  zpdScore,
  type EloState,
  type Sm2State,
} from "./bkt";
import {
  getSkillDef,
  inferSkillsFromText,
  SKILL_CATALOG,
  topicLabelForId,
} from "./skill-catalog";

export type TopicMastery = {
  id: string;
  label: string;
  /** 0–100 */
  mastery: number;
  solves: number;
  lastSeen: number;
};

export type SkillMastery = {
  id: string;
  label: string;
  topicId: string;
  /** BKT P(L) in 0–1 (after applying SM-2 decay on load) */
  pKnown: number;
  /** 0–100 mirror of pKnown for display / legacy */
  mastery: number;
  attempts: number;
  correct: number;
  incorrect: number;
  /** Last self-report 1–3, if any */
  confidence?: number;
  lastSeen: number;
  /** SM-2 spaced repetition state for this skill */
  sm2State: Sm2State;
  /** Elo-hybrid difficulty rating for this skill/topic */
  eloState: EloState;
};

/** Auto-advance suggestion when mastery exceeds current band ceiling. Parent opt-in; not auto-applied. */
export type AdvanceSuggestion = {
  suggestedBand: "early" | "elementary" | "middle" | "high";
  confidence: number;
  skillsReady: number;
};

export type LearningMemory = {
  topics: TopicMastery[];
  skills: SkillMastery[];
  recentStruggles: string[];
  recentWins: string[];
  /** Conversation digests from past sessions — max MAX_DIGESTS, newest first */
  sessionDigests: SessionDigest[];
  /** Auto-advance suggestion — set by autoAdvanceCheck, cleared when parent approves */
  advanceSuggestion?: AdvanceSuggestion | null;
  updatedAt: number;
};

export type SessionDigest = {
  date: string;
  topic: string;
  insight: string;
  bestApproach: string;
};

export type TurnOutcome = "correct" | "incorrect" | "practice";

const KEY = FLAT_KEYS.memory;
const MAX_TOPICS = 12;
const MAX_SKILLS = 24;
const MAX_NOTES = 5;
const MAX_DIGESTS = 10;

/** Prerequisite mastery threshold for warm-up eligibility (≥ 60%). */
const PREREQ_THRESHOLD = 0.6;

// ── Recall cache (for Phase 1.3: avoid duplicate tool calls) ───────

let recallCacheLines: string[] | null = null;
let recallCacheTimestamp = 0;
const RECALL_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

/** Store results from a recall_learner_skills tool call for reuse in prompts. */
export function storeRecallCache(lines: string[]): void {
  recallCacheLines = lines;
  recallCacheTimestamp = Date.now();
}

/** Load cached recall results if they're still fresh. */
export function loadRecallCache(): string[] | null {
  if (!recallCacheLines) return null;
  if (Date.now() - recallCacheTimestamp > RECALL_CACHE_TTL_MS) {
    recallCacheLines = null;
    return null;
  }
  return recallCacheLines;
}

// ── Core CRUD ──────────────────────────────────────────────────────

export function emptyLearningMemory(): LearningMemory {
  return {
    topics: [],
    skills: [],
    recentStruggles: [],
    recentWins: [],
    sessionDigests: [],
    updatedAt: 0,
  };
}

export function loadLearningMemory(accountId: string = RYAN_ACCOUNT): LearningMemory {
  if (typeof window === "undefined") return emptyLearningMemory();
  try {
    const nsKeyVal = nsKey(accountId, "memory");
    const raw = localStorage.getItem(nsKeyVal);
    if (raw) {
      const mem = normalizeMemory(JSON.parse(raw) as Partial<LearningMemory>);
      return applyMemoryDecay(mem);
    }
    // Fallback: read flat key and auto-migrate — ONLY for the default Ryan account
    if (accountId === RYAN_ACCOUNT) {
      const flatRaw = readFlatKey(FLAT_KEYS.memory);
      if (flatRaw) {
        const mem = normalizeMemory(JSON.parse(flatRaw) as Partial<LearningMemory>);
        const decayed = applyMemoryDecay(mem);
        try { localStorage.setItem(nsKeyVal, JSON.stringify(decayed)); } catch { /* ignore */ }
        markMigrated(accountId);
        return decayed;
      }
    }
    return emptyLearningMemory();
  } catch {
    return emptyLearningMemory();
  }
}

export function saveLearningMemory(mem: LearningMemory, accountId: string = RYAN_ACCOUNT): void {
  try {
    localStorage.setItem(nsKey(accountId, "memory"), JSON.stringify(mem));
  } catch {
    // ignore quota
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeDigest(raw: unknown): SessionDigest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = typeof o.date === "string" ? o.date.slice(0, 10) : "";
  const topic = typeof o.topic === "string" ? o.topic.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const insight = typeof o.insight === "string" ? o.insight.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const bestApproach = typeof o.bestApproach === "string" ? o.bestApproach.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (!date || !topic || !insight) return null;
  return { date, topic, insight, bestApproach: bestApproach || insight.slice(0, 80) };
}

function cleanDigests(v: unknown): SessionDigest[] {
  if (!Array.isArray(v)) return [];
  const out: SessionDigest[] = [];
  for (const item of v) {
    const d = normalizeDigest(item);
    if (!d) continue;
    // Dedup: same date+topic → keep only the first (newest arrives first)
    if (out.some((existing) => existing.date === d.date && existing.topic === d.topic)) continue;
    out.push(d);
  }
  return out.slice(0, MAX_DIGESTS);
}

function cleanNotes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.replace(/\s+/g, " ").trim().slice(0, 80))
    .slice(0, MAX_NOTES);
}

// ── SM-2 Decay ─────────────────────────────────────────────────────

/** Parse SM-2 state from serialised data, defaulting missing fields. */
function normalizeSm2(raw: unknown): Sm2State {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SM2 };
  const o = raw as Record<string, unknown>;
  return {
    ef: clamp(typeof o.ef === "number" ? o.ef : DEFAULT_SM2.ef, 1.3, 3.5),
    interval: Math.max(1, Math.floor(Number(o.interval) || DEFAULT_SM2.interval)),
    reps: Math.max(0, Math.floor(Number(o.reps) || 0)),
    prevReview: Number(o.prevReview) || 0,
  };
}

/** Parse Elo state from serialised data, defaulting missing fields. */
function normalizeElo(raw: unknown): EloState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ELO };
  const o = raw as Record<string, unknown>;
  return {
    rating: clamp(typeof o.rating === "number" ? o.rating : DEFAULT_ELO.rating, 800, 2600),
    n: Math.max(0, Math.floor(Number(o.n) || 0)),
    lastUpdate: Number(o.lastUpdate) || 0,
  };
}

/** Apply SM-2 forgetting decay to all skills in memory. */
export function applyMemoryDecay(mem: LearningMemory): LearningMemory {
  const now = Date.now();
  const skills = mem.skills.map((s) => {
    const decayed = applySm2Decay(s.pKnown, s.sm2State, now);
    return {
      ...s,
      pKnown: decayed,
      mastery: masteryFromPKnown(decayed),
    };
  });
  return { ...mem, skills };
}

// ── Normalisation ───────────────────────────────────────────────────

function normalizeSkill(raw: Partial<SkillMastery>): SkillMastery | null {
  if (!raw || typeof raw.id !== "string") return null;
  const def = getSkillDef(raw.id);
  const label =
    (typeof raw.label === "string" && raw.label) || def?.label || raw.id;
  const topicId =
    (typeof raw.topicId === "string" && raw.topicId) ||
    def?.topicId ||
    "general";
  let pKnown =
    typeof raw.pKnown === "number"
      ? raw.pKnown
      : pKnownFromMastery(typeof raw.mastery === "number" ? raw.mastery : 40);
  pKnown = clamp(pKnown, 0.001, 0.999);
  return {
    id: String(raw.id).slice(0, 48),
    label: String(label).slice(0, 56),
    topicId: String(topicId).slice(0, 40),
    pKnown,
    mastery: masteryFromPKnown(pKnown),
    attempts: Math.max(0, Math.floor(Number(raw.attempts) || 0)),
    correct: Math.max(0, Math.floor(Number(raw.correct) || 0)),
    incorrect: Math.max(0, Math.floor(Number(raw.incorrect) || 0)),
    confidence:
      typeof raw.confidence === "number"
        ? clamp(Math.round(raw.confidence), 1, 3)
        : undefined,
    lastSeen: Number(raw.lastSeen) || 0,
    sm2State: normalizeSm2((raw as Record<string, unknown>).sm2State),
    eloState: normalizeElo((raw as Record<string, unknown>).eloState),
  };
}

/** Migrate legacy topic rows into skills when skills[] is empty. */
function skillsFromTopics(topics: TopicMastery[]): SkillMastery[] {
  const out: SkillMastery[] = [];
  for (const t of topics) {
    const defs = SKILL_CATALOG.filter((s) => s.topicId === t.id);
    if (!defs.length) {
      out.push({
        id: t.id,
        label: t.label,
        topicId: t.id,
        pKnown: pKnownFromMastery(t.mastery),
        mastery: t.mastery,
        attempts: t.solves,
        correct: 0,
        incorrect: 0,
        lastSeen: t.lastSeen,
        sm2State: { ...DEFAULT_SM2 },
        eloState: { ...DEFAULT_ELO },
      });
      continue;
    }
    const primary = defs[0]!;
    out.push({
      id: primary.id,
      label: primary.label,
      topicId: primary.topicId,
      pKnown: pKnownFromMastery(t.mastery),
      mastery: t.mastery,
      attempts: t.solves,
      correct: 0,
      incorrect: 0,
      lastSeen: t.lastSeen,
      sm2State: { ...DEFAULT_SM2 },
      eloState: { ...DEFAULT_ELO },
    });
  }
  return out.slice(0, MAX_SKILLS);
}

function topicsFromSkills(skills: SkillMastery[]): TopicMastery[] {
  const map = new Map<string, TopicMastery>();
  for (const s of skills) {
    const prev = map.get(s.topicId);
    if (!prev) {
      map.set(s.topicId, {
        id: s.topicId,
        label: topicLabelForId(s.topicId),
        mastery: s.mastery,
        solves: s.attempts,
        lastSeen: s.lastSeen,
      });
      continue;
    }
    map.set(s.topicId, {
      id: s.topicId,
      label: prev.label,
      mastery: Math.round((prev.mastery + s.mastery) / 2),
      solves: prev.solves + s.attempts,
      lastSeen: Math.max(prev.lastSeen, s.lastSeen),
    });
  }
  return [...map.values()]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_TOPICS);
}

export function normalizeMemory(
  raw: Partial<LearningMemory> | null | undefined,
): LearningMemory {
  const base = emptyLearningMemory();
  if (!raw || typeof raw !== "object") return base;

  const topics = Array.isArray(raw.topics)
    ? raw.topics
        .filter((t) => t && typeof t.id === "string" && typeof t.label === "string")
        .map((t) => ({
          id: String(t.id).slice(0, 40),
          label: String(t.label).slice(0, 48),
          mastery: clamp(
            typeof t.mastery === "number" ? t.mastery : 40,
            0,
            100,
          ),
          solves: Math.max(0, Math.floor(Number(t.solves) || 0)),
          lastSeen: Number(t.lastSeen) || 0,
        }))
        .slice(0, MAX_TOPICS)
    : [];

  let skills = Array.isArray(raw.skills)
    ? raw.skills
        .map((s) => normalizeSkill(s as Partial<SkillMastery>))
        .filter((s): s is SkillMastery => !!s)
        .slice(0, MAX_SKILLS)
    : [];

  if (!skills.length && topics.length) {
    skills = skillsFromTopics(topics);
  }

  const syncedTopics = skills.length ? topicsFromSkills(skills) : topics;

  return {
    topics: syncedTopics,
    skills,
    recentStruggles: cleanNotes(raw.recentStruggles),
    recentWins: cleanNotes(raw.recentWins),
    sessionDigests: cleanDigests(raw.sessionDigests),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

// ── Text Analysis ───────────────────────────────────────────────────

/** @deprecated prefer inferSkillsFromText — kept for tests / topic UI */
export function inferTopicsFromText(
  text: string,
): Array<{ id: string; label: string }> {
  const skills = inferSkillsFromText(text);
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string }> = [];
  for (const s of skills) {
    if (seen.has(s.topicId)) continue;
    seen.add(s.topicId);
    out.push({ id: s.topicId, label: topicLabelForId(s.topicId) });
  }
  return out;
}

export function looksLikeStruggle(userText: string): boolean {
  return /\b(i don'?t know|idk|stuck|confused|hard|help|give up|wrong|不对|不懂|不会|不會|好难|好難|唔识|唔識|卡住|唔明)\b/i.test(
    userText,
  );
}

export function looksLikeWin(userText: string, assistantText: string): boolean {
  if (
    /\b(got it|i (got|see)|makes sense|明白了|懂了|会了|會了|得咗|啱咗)\b/i.test(
      userText,
    )
  ) {
    return true;
  }
  if (
    /\b(yes[,!]?\s*(that'?s|you'?re)?\s*(right|correct)|nice work|you'?ve got it|exactly|对了|對了|答对|答對|啱喇)\b/i.test(
      assistantText,
    )
  ) {
    return true;
  }
  return false;
}

/** Parse confidence 1–3 from student reply (after self-check prompt). */
export function parseConfidence(userText: string): number | undefined {
  const m = userText.match(
    /\b(?:confidence|自信|信心)?\s*([123])\b|\b([123])\s*(?:\/\s*3|out of 3)?\b/i,
  );
  if (!m) return undefined;
  const n = Number(m[1] || m[2]);
  if (n >= 1 && n <= 3) return n;
  return undefined;
}

export function classifyTurnOutcome(
  userText: string,
  assistantText: string,
): TurnOutcome {
  if (looksLikeWin(userText, assistantText)) return "correct";
  if (looksLikeStruggle(userText)) return "incorrect";
  return "practice";
}

// ── Session Digest Generation ───────────────────────────────────────

/** Patterns that indicate the assistant teacher introduced a named approach or method. */
const APPROACH_HINTS = [
  /\b(?:method|approach|strategy|technique|trick|tactic|framework|recipe|formula|rule|mnemonic|口诀|方法|技巧|思路|套路)\b.*?[:：](.+?)(?:\.|,|\n|$)/i,
  /\b(let'?s|we'?ll|you can|try) (.+?)(?:\.|\n|$)/i,
  /\b(画|数|格|图|表|列|分|拆|凑|补|换|套|猜|验) *(?:图|法|个|表|列|式|解|数)\b/,
  /\b(drawing|number line|grid|chart|table|diagram|visual|color|coding) (method|approach|trick|way)\b/i,
];

function extractBestApproach(assistantTexts: string[]): string {
  const full = assistantTexts.join("\n");
  for (const re of APPROACH_HINTS) {
    const m = re.exec(full);
    if (m) {
      const captured = (m[1] || m[0]).trim().replace(/\s+/g, " ").slice(0, 120);
      if (captured.length > 4) return captured;
    }
  }
  // Fallback: pick the first sentence that mentions a how-to pattern
  const fallback = full.match(/(?:先|first|start by|可以).*?(?:再|then|就可以)[^。.]+[。.]/);
  if (fallback) return fallback[0].replace(/\s+/g, " ").trim().slice(0, 120);
  return "discussion-based tutoring";
}

/**
 * Generate a session digest from the completed conversation.
 * Uses rule-based extraction — no LLM call, zero token cost.
 */
export function autoGenerateDigest(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  chatTitle?: string,
): SessionDigest | null {
  if (!messages || messages.length < 2) return null;

  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  if (!userMessages.length) return null;

  const allText = messages.map((m) => m.content).join("\n");
  const userText = userMessages.map((m) => m.content).join("\n");
  const assistantText = assistantMessages.map((m) => m.content).join("\n");

  // 1. Topic: use skill-catalog inference on all text
  const inferred = inferSkillsFromText(allText);
  const topic = inferred.length > 0
    ? inferred[0]!.label
    : (chatTitle && chatTitle !== "New chat" ? chatTitle.replace(/\s+/g, " ").trim().slice(0, 60) : "general practice");

  // 2. Insight: detect struggle/win patterns from user messages
  const struggleCount = userMessages.filter(
    (m) => looksLikeStruggle(m.content),
  ).length;
  const winCount = userMessages.filter(
    (m) => /\b(got it|i see|makes sense|明白了|懂了|会了|得咗)\b/i.test(m.content),
  ).length;

  let insight: string;
  if (struggleCount > winCount && struggleCount >= 2) {
    insight = `Had some difficulty — ${struggleCount} signs of struggle detected`;
  } else if (winCount > struggleCount && winCount >= 2) {
    insight = `Showed understanding — ${winCount} confirmation signals`;
  } else if (inferred.length > 0) {
    insight = `Worked on ${inferred.map((s) => s.label).join(", ")}`;
  } else {
    insight = `General practice session with ${messages.length} messages`;
  }

  // 3. Best approach: extract from assistant messages
  const bestApproach = extractBestApproach(assistantMessages.map((m) => m.content));

  const today = new Date().toISOString().slice(0, 10);
  return { date: today, topic, insight, bestApproach };
}

/**
 * Append a digest to learning memory, performing dedup and size cap.
 * Returns a new LearningMemory (does not mutate or persist).
 */
export function appendDigestToMemory(
  mem: LearningMemory,
  digest: SessionDigest,
): LearningMemory {
  const normalized = normalizeMemory(mem);
  const digests = [...normalized.sessionDigests];
  // Dedup: same date+topic within 7 days → replace existing
  const idx = digests.findIndex(
    (d) => d.topic === digest.topic && d.date === digest.date,
  );
  if (idx >= 0) digests[idx] = digest;
  else digests.unshift(digest);
  return normalizeMemory({
    ...normalized,
    sessionDigests: digests.slice(0, MAX_DIGESTS),
  });
}

// ── Merge ───────────────────────────────────────────────────────────

function mergeSkill(a: SkillMastery, b: SkillMastery): SkillMastery {
  const newer = a.lastSeen >= b.lastSeen ? a : b;
  const pKnown = Math.max(a.pKnown, b.pKnown);
  const mergedSm2 = newer.sm2State.prevReview
    ? newer.sm2State
    : a.sm2State.prevReview >= (b.sm2State.prevReview || 0)
      ? a.sm2State
      : b.sm2State || { ...DEFAULT_SM2 };
  return {
    id: a.id,
    label: newer.label,
    topicId: newer.topicId || a.topicId,
    pKnown,
    mastery: masteryFromPKnown(pKnown),
    attempts: Math.max(a.attempts, b.attempts),
    correct: Math.max(a.correct, b.correct),
    incorrect: Math.max(a.incorrect, b.incorrect),
    confidence: newer.confidence ?? a.confidence ?? b.confidence,
    lastSeen: Math.max(a.lastSeen, b.lastSeen),
    sm2State: mergedSm2,
    eloState: newer.eloState.n > 0 ? newer.eloState : (b.eloState.n > 0 ? b.eloState : a.eloState),
  };
}

/** Merge remote + local; prefer higher pKnown / fresher notes. */
export function mergeLearningMemory(
  a: LearningMemory,
  b: LearningMemory,
): LearningMemory {
  const na = normalizeMemory(a);
  const nb = normalizeMemory(b);
  const map = new Map<string, SkillMastery>();
  for (const s of [...na.skills, ...nb.skills]) {
    const prev = map.get(s.id);
    map.set(s.id, prev ? mergeSkill(prev, s) : { ...s });
  }
  const skills = [...map.values()]
    .sort((x, y) => y.lastSeen - x.lastSeen)
    .slice(0, MAX_SKILLS);
  const newer = (na.updatedAt || 0) >= (nb.updatedAt || 0) ? na : nb;
  const older = newer === na ? nb : na;
  const mergedDigests = [...cleanDigests(newer.sessionDigests),
    ...cleanDigests(older.sessionDigests).filter(
      (d) => !cleanDigests(newer.sessionDigests).some(
        (e) => e.date === d.date && e.topic === d.topic),
    ),
  ].slice(0, MAX_DIGESTS);

  const merged = normalizeMemory({
    skills,
    topics: topicsFromSkills(skills),
    recentStruggles: [
      ...newer.recentStruggles,
      ...older.recentStruggles.filter((s) => !newer.recentStruggles.includes(s)),
    ].slice(0, MAX_NOTES),
    recentWins: [
      ...newer.recentWins,
      ...older.recentWins.filter((s) => !newer.recentWins.includes(s)),
    ].slice(0, MAX_NOTES),
    sessionDigests: mergedDigests,
    updatedAt: Math.max(na.updatedAt || 0, nb.updatedAt || 0),
  });
  // Apply SM-2 decay after merge so stale remote skills don't look mastered
  return applyMemoryDecay(merged);
}

// ── Record Turn (BKT + SM-2 + Confidence-weighted) ─────────────────

/**
 * Update memory after a tutoring turn using confidence-weighted BKT
 * and SM-2 spaced repetition updates.
 */
export function recordLearningTurnMemory(
  prev: LearningMemory,
  params: {
    userText: string;
    assistantText?: string;
    chatTitle?: string;
  },
): LearningMemory {
  const now = Date.now();
  const blob = [
    params.userText,
    params.chatTitle || "",
    params.assistantText || "",
  ].join("\n");
  const inferred = inferSkillsFromText(blob);
  if (!inferred.length && !params.userText.trim()) return prev;

  // Apply SM-2 decay before updating, so stale pKnown is current
  const base = applyMemoryDecay(normalizeMemory(prev));
  const skills = [...base.skills];
  const outcome = classifyTurnOutcome(
    params.userText,
    params.assistantText || "",
  );
  const confidence = parseConfidence(params.userText);

  const touch = (id: string, label: string, topicId: string) => {
    let s = skills.find((x) => x.id === id);
    if (!s) {
      const def = getSkillDef(id);
      s = {
        id,
        label: def?.label || label,
        topicId: def?.topicId || topicId,
        pKnown: 0.25,
        mastery: 25,
        attempts: 0,
        correct: 0,
        incorrect: 0,
        lastSeen: now,
        sm2State: { ...DEFAULT_SM2 },
        eloState: { ...DEFAULT_ELO },
      };
      skills.unshift(s);
    }
    s.label = label;
    s.topicId = topicId;
    s.lastSeen = now;
    s.attempts += 1;

    // ── Confidence-weighted BKT update (Phase 1.5) ──
    if (confidence && (outcome === "correct" || outcome === "incorrect")) {
      if (outcome === "incorrect" && confidence >= 2) {
        // High-conf wrong → amplified slip penalty (larger drop)
        // Apply BKT twice to simulate stronger negative evidence
        const first = softBktUpdate(s.pKnown, outcome);
        s.pKnown = softBktUpdate(first, outcome);
      } else if (outcome === "correct" && confidence === 1) {
        // Low-conf correct → dampened gain (half-step)
        const damped = softBktUpdate(s.pKnown, "practice");
        s.pKnown = damped;
      } else {
        s.pKnown = softBktUpdate(s.pKnown, outcome);
      }
    } else {
      s.pKnown = softBktUpdate(s.pKnown, outcome);
    }

    s.mastery = masteryFromPKnown(s.pKnown);
    if (outcome === "correct") s.correct += 1;
    if (outcome === "incorrect") s.incorrect += 1;
    if (confidence) s.confidence = confidence;

    // ── SM-2 update (Phase 1.1) ──
    const quality = outcomeToSm2Quality(outcome, confidence);
    s.sm2State = sm2Update(s.sm2State, quality, now);

    // ── Elo-hybrid difficulty update (Phase 1.6) ──
    s.eloState = eloUpdate(s.eloState, outcome, now);

    // Re-apply BKT with difficulty-adjusted params for a finer update
    // (the primary BKT above uses default params; this second pass
    //  nudges pKnown toward the difficulty-calibrated estimate)
    const diff = difficultyAdjustedBktParams(s.eloState);
    const adjustedPKnown = softBktUpdate(
      s.pKnown,
      outcome,
      { ...DEFAULT_BKT, ...diff },
    );
    // Blend: 30% difficulty-adjusted, 70% original to avoid oscillation
    s.pKnown = clamp(s.pKnown * 0.7 + adjustedPKnown * 0.3, 0.001, 0.999);
    s.mastery = masteryFromPKnown(s.pKnown);
  };

  if (inferred.length) {
    for (const sk of inferred) touch(sk.id, sk.label, sk.topicId);
  } else if (params.userText.trim().length > 8) {
    touch("general-practice", "general practice", "general");
  }

  // ── Recall cache: invalidate after a turn (stale) ──
  recallCacheLines = null;

  const recentStruggles = [...base.recentStruggles];
  const recentWins = [...base.recentWins];
  if (outcome === "incorrect" && inferred[0]) {
    const note = `Needed help with ${inferred[0].label}`;
    if (!recentStruggles.includes(note)) recentStruggles.unshift(note);
  }
  if (outcome === "correct" && inferred[0]) {
    const note = `Progress on ${inferred[0].label}`;
    if (!recentWins.includes(note)) recentWins.unshift(note);
  }

  const next = normalizeMemory({
    skills: skills
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, MAX_SKILLS),
    recentStruggles: recentStruggles.slice(0, MAX_NOTES),
    recentWins: recentWins.slice(0, MAX_NOTES),
    updatedAt: now,
  });
  saveLearningMemory(next);
  return next;
}

// ── Analysis Queries ────────────────────────────────────────────────

export function skillStrengths(mem: LearningMemory, limit = 3): SkillMastery[] {
  return [...normalizeMemory(mem).skills]
    .filter((s) => s.attempts > 0 && s.mastery >= 65)
    .sort((a, b) => b.mastery - a.mastery || b.attempts - a.attempts)
    .slice(0, limit);
}

export function skillWeaknesses(mem: LearningMemory, limit = 3): SkillMastery[] {
  return [...normalizeMemory(mem).skills]
    .filter((s) => s.attempts > 0 && (s.mastery <= 50 || (s.confidence ?? 3) <= 1))
    .sort((a, b) => a.mastery - b.mastery || b.incorrect - a.incorrect)
    .slice(0, limit);
}

/** Check if all prerequisites for a skill are satisfied (≥ PREREQ_THRESHOLD). */
export function prerequisitesSatisfied(
  mem: LearningMemory,
  skillId: string,
): boolean {
  const def = getSkillDef(skillId);
  if (!def?.requires?.length) return true;
  const skills = normalizeMemory(mem).skills;
  for (const req of def.requires) {
    const row = skills.find((s) => s.id === req);
    if (!row || row.pKnown < PREREQ_THRESHOLD) return false;
  }
  return true;
}

/** Prerequisites that look weak relative to a focus skill. */
export function weakPrerequisites(mem: LearningMemory, skillId: string): string[] {
  const def = getSkillDef(skillId);
  if (!def?.requires?.length) return [];
  const skills = normalizeMemory(mem).skills;
  const weak: string[] = [];
  for (const req of def.requires) {
    const row = skills.find((s) => s.id === req);
    const reqDef = getSkillDef(req);
    if (!row || row.mastery < 55) {
      weak.push(reqDef?.label || req);
    }
  }
  return weak;
}

// ── ZPD-based Warm-up Selection (Phase 1.2 + 1.4) ──────────────────

/**
 * Find the best skill for warm-up / next session:
 * weakest skill whose prerequisites are all ≥ 60%, scored by ZPD closeness.
 * Also considers SM-2 interval: skills due for review get a bonus.
 */
export function zpdWarmUpSkills(
  mem: LearningMemory,
  limit = 3,
): SkillMastery[] {
  const decaied = applyMemoryDecay(normalizeMemory(mem));
  const now = Date.now();
  const eligible = decaied.skills.filter(
    (s) => s.attempts > 0 && prerequisitesSatisfied(decaied, s.id),
  );

  // Score by ZPD closeness to 0.7, with review-due bonus
  const scored = eligible.map((s) => {
    let score = zpdScore(s.pKnown);
    // Bonus for skills past their SM-2 review interval (needs review)
    const daysSince = (now - s.sm2State.prevReview) / 86_400_000;
    if (s.sm2State.prevReview > 0 && daysSince >= s.sm2State.interval * 0.5) {
      score *= 1.15; // 15% bonus for review-due skills
    }
    // Penalty for very new skills (low confidence)
    if (s.attempts <= 2) score *= 0.85;
    return { skill: s, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.skill.attempts - b.skill.attempts)
    .slice(0, limit)
    .map((x) => x.skill);
}

// ── SM-2 Review Alerts (Phase 2.1) ──────────────────────────────────

/**
 * Find skills that are past their SM-2 review interval and need refreshing.
 * Sorted by how overdue they are (days past interval).
 */
export function needsReviewSkills(
  mem: LearningMemory,
  limit = 3,
): SkillMastery[] {
  const decayed = applyMemoryDecay(normalizeMemory(mem));
  const now = Date.now();
  const overdue = decayed.skills
    .filter((s) => {
      if (!s.sm2State.prevReview || s.sm2State.interval <= 0) return false;
      const daysSince = (now - s.sm2State.prevReview) / 86_400_000;
      return daysSince >= s.sm2State.interval * 0.8;
    })
    .map((s) => {
      const daysSince = (now - s.sm2State.prevReview) / 86_400_000;
      const overdueDays = daysSince - s.sm2State.interval;
      return { skill: s, overdueDays };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, limit)
    .map((x) => x.skill);
  return overdue;
}

// ── Confidence-BKT Mismatch Detection (Phase 2.4) ────────────────────

export type ConfidenceMismatch = {
  skillId: string;
  label: string;
  type: "underconfident" | "overconfident";
  pKnown: number;
  confidence: number;
};

/**
 * Detect significant gaps between BKT estimate (pKnown) and student
 * self-reported confidence (1-3). Gaps suggest either lack of confidence
 * in a known skill, or overconfidence on a shaky one.
 *
 * Returns the highest-priority mismatch or null if none found.
 */
export function detectConfidenceMismatch(
  mem: LearningMemory,
): ConfidenceMismatch | null {
  const normalized = normalizeMemory(mem);
  let best: ConfidenceMismatch | null = null;
  let bestScore = 0;

  for (const s of normalized.skills) {
    if (s.confidence == null || s.attempts < 2) continue;

    const bktPct = s.pKnown * 100;
    const confScaled = s.confidence / 3 * 100;

    // Underconfident: BKT ≥ 75%, confidence ≤ 1
    if (bktPct >= 75 && s.confidence <= 1) {
      const gap = bktPct - confScaled;
      if (gap > bestScore) {
        bestScore = gap;
        best = { skillId: s.id, label: s.label, type: "underconfident", pKnown: s.pKnown, confidence: s.confidence };
      }
    }

    // Overconfident: BKT ≤ 35%, confidence ≥ 3
    if (bktPct <= 35 && s.confidence >= 3) {
      const gap = confScaled - bktPct;
      if (gap > bestScore) {
        bestScore = gap;
        best = { skillId: s.id, label: s.label, type: "overconfident", pKnown: s.pKnown, confidence: s.confidence };
      }
    }
  }

  return best;
}

// ── Auto-Advance Check (Phase 12D) ──────────────────────────────────

const BANDS: Array<"early" | "elementary" | "middle" | "high"> = ["early", "elementary", "middle", "high"];
const ADVANCE_THRESHOLD = 0.85;

function nextBand(current: "early" | "elementary" | "middle" | "high"): "early" | "elementary" | "middle" | "high" {
  const idx = BANDS.indexOf(current);
  if (idx < 0 || idx >= BANDS.length - 1) return current;
  return BANDS[idx + 1];
}

/**
 * Check if all active-band skills have pKnown > 0.85, suggesting the
 * student is ready for the next grade band. Returns null if no advance
 * is warranted, or if already at the highest band.
 */
export function autoAdvanceCheck(
  mem: LearningMemory,
  band: "early" | "elementary" | "middle" | "high",
): AdvanceSuggestion | null {
  if (band === "high") return null; // already at ceiling

  const normalized = normalizeMemory(mem);
  // Filter skills that have been attempted and are active for this band
  // (we don't know exact band from skill defs alone in this module, so
  //  we check all attempted skills with pKnown above threshold)
  const activeSkills = normalized.skills.filter((s) => s.attempts > 0);
  if (activeSkills.length < 3) return null; // not enough data

  const ready = activeSkills.filter((s) => s.pKnown > ADVANCE_THRESHOLD);
  const ratio = ready.length / activeSkills.length;
  if (ratio < 0.75 || ready.length < 3) return null; // most skills need to be ready

  const suggested = nextBand(band);
  if (suggested === band) return null;

  const confidence = Math.min(0.95, ratio * 1.1); // cap at 0.95
  return { suggestedBand: suggested, confidence, skillsReady: ready.length };
}

// ── Prompt Lines ────────────────────────────────────────────────────

/** Compact lines for the tutor system prompt */
export function learningMemoryPromptLines(mem?: LearningMemory | null): string[] {
  // Try recall cache first (Phase 1.3)
  const cached = loadRecallCache();
  if (cached && mem) {
    // Cache hit: append freshness note but don't recompute
    const lines = [...cached];
    lines.push(
      `[Skill snapshot cached < 5 min — use this; call recall_learner_skills if you need a fresh read.]`,
    );
    return lines;
  }

  const m = mem ? applyMemoryDecay(normalizeMemory(mem)) : null;
  if (!m || (!m.skills.length && !m.topics.length)) {
    return [
      "",
      "[Learning memory — skills / BKT]",
      "No prior skill history yet. After this session, update Ryan's skill map (strengths vs focus areas).",
    ];
  }

  const strong = skillStrengths(m, 4);
  const weak = skillWeaknesses(m, 4);
  const recent = [...m.skills]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 6);
  const skillBits = recent.map(
    (s) =>
      `${s.label} (P≈${s.mastery}%` +
      (s.confidence ? `, conf ${s.confidence}/3` : "") +
      `, n=${s.attempts}` +
      `, SM2: int=${s.sm2State.interval}d reps=${s.sm2State.reps})`,
  );

  const lines = [
    "",
    "[Learning memory — skills / BKT + SM-2 spaced repetition — USE AS REFERENCE]",
    "Model: each skill has P(known) updated after turns (correct / incorrect / practice). SM-2 interval tracks review spacing.",
    `Recent skills: ${skillBits.join("; ") || "—"}.`,
  ];

  if (strong.length) {
    lines.push(
      `Strengths (lean on these / celebrate): ${strong
        .map((s) => `${s.label} ~${s.mastery}%`)
        .join("; ")}.`,
    );
  }
  if (weak.length) {
    const tips = weak.map((s) => {
      const prereq = weakPrerequisites(m, s.id);
      const zpd = zpdScore(s.pKnown);
      const extra = prereq.length
        ? ` — prereqs weak: ${prereq.join(", ")}`
        : "";
      return `${s.label} ~${s.mastery}% (ZPD: ${zpd.toFixed(2)})${extra}`;
    });
    lines.push(`Focus / weaker skills (gentler scaffolds, more L0–L1): ${tips.join("; ")}.`);
  }

  // ZPD warm-up suggestion (Phase 1.2 + 1.4)
  const warmUps = zpdWarmUpSkills(m, 2);
  if (warmUps.length) {
    lines.push(
      `ZPD warm-up suggestion (prereqs ready, closest to difficulty sweet spot): ${
        warmUps.map((s) => `${s.label} (P≈${s.mastery}%)`).join(", ")
      }.`,
    );
  }

  // Session digests — episodic memory from past sessions
  if (m.sessionDigests.length) {
    const digestLines = m.sessionDigests
      .slice(0, 6) // newest first
      .map((d) => `  - ${d.date} — ${d.topic}: ${d.insight}. ${d.bestApproach ? `Approach: ${d.bestApproach}.` : ""}`.trim());
    lines.push(
      `## Session History (recent tutoring sessions)`,
      ...digestLines,
      `When teaching: prefer approaches that worked before. If returning to a topic, acknowledge prior session insights.`,
    );
  }

  if (m.recentWins.length) {
    lines.push(`Recent wins: ${m.recentWins.join(" · ")}.`);
  }
  if (m.recentStruggles.length) {
    lines.push(`Recent struggles: ${m.recentStruggles.join(" · ")}.`);
  }
  // Auto-advance suggestion (Phase 12D)
  if (m.advanceSuggestion) {
    lines.push(
      `[Auto-advance] ${Math.round(m.advanceSuggestion.confidence * 100)}% confidence the student may be ready for ${m.advanceSuggestion.suggestedBand}-band material (${m.advanceSuggestion.skillsReady} skills above 85%). You may occasionally offer harder challenges or check with the student if they'd like more advanced work.`,
    );
  }
  lines.push(
    "When asking a question: briefly tailor difficulty to the skill map (easier if weak; richer if strong).",
    "Continuity: on a fresh thread, ONE short offer to continue a weak or recent topic is OK.",
    "Adaptive difficulty: high P(known) → fewer L0 hints; low P(known) → tinier steps. Never shame.",
    "Self-assessment: after a harder win, you may ask confidence 1–3 once; store that feeling in the next turn.",
    "Progress celebration: occasionally mention a streak when engagement stats are provided — short and genuine.",
    "SM-2 review: skills with interval overdue benefit most from a quick check-in (don't over-drill).",
  );
  return lines;
}

export function learningMemorySummary(mem: LearningMemory): string | null {
  const m = normalizeMemory(mem);
  if (!m.skills.length && !m.topics.length) return null;
  const weak = skillWeaknesses(m, 1)[0];
  const strong = skillStrengths(m, 1)[0];
  const top = [...m.skills].sort((a, b) => b.lastSeen - a.lastSeen)[0];
  if (weak && strong) {
    return `强 ${strong.label} · 弱 ${weak.label}`;
  }
  if (top) return `${top.label} · ${Math.round(top.mastery)}%`;
  return null;
}

/** Compact snapshot safe to send in chat JSON */
export function serializeLearningMemoryForChat(
  mem: LearningMemory,
): LearningMemory {
  const m = normalizeMemory(mem);
  return {
    topics: m.topics.slice(0, 8).map((t) => ({
      id: t.id,
      label: t.label.slice(0, 48),
      mastery: Math.round(t.mastery),
      solves: t.solves,
      lastSeen: t.lastSeen,
    })),
    skills: m.skills.slice(0, 12).map((s) => ({
      id: s.id,
      label: s.label.slice(0, 56),
      topicId: s.topicId,
      pKnown: Math.round(s.pKnown * 1000) / 1000,
      mastery: Math.round(s.mastery),
      attempts: s.attempts,
      correct: s.correct,
      incorrect: s.incorrect,
      confidence: s.confidence,
      lastSeen: s.lastSeen,
      sm2State: s.sm2State,
      eloState: { rating: s.eloState.rating, n: s.eloState.n, lastUpdate: s.eloState.lastUpdate },
    })),
    recentStruggles: m.recentStruggles.slice(0, 4),
    recentWins: m.recentWins.slice(0, 4),
    sessionDigests: m.sessionDigests.slice(0, MAX_DIGESTS),
    advanceSuggestion: m.advanceSuggestion ?? undefined,
    updatedAt: m.updatedAt,
  };
}

// ── Server Sync ─────────────────────────────────────────────────────

export async function hydrateLearningMemoryFromServer(accountId: string = RYAN_ACCOUNT): Promise<LearningMemory> {
  const local = loadLearningMemory(accountId);
  try {
    const res = await fetch(`/api/learning?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" });
    if (!res.ok) return local;
    const data = (await res.json()) as { memory?: Partial<LearningMemory> };
    const remote = normalizeMemory(data.memory);
    const merged = mergeLearningMemory(local, remote);
    saveLearningMemory(merged, accountId);
    return merged;
  } catch {
    return local;
  }
}

export async function pushLearningMemoryToServer(
  mem: LearningMemory,
  accountId: string = RYAN_ACCOUNT,
): Promise<void> {
  const m = normalizeMemory(mem);
  if (!m.skills.length && !m.topics.length && !m.recentWins.length) {
    return;
  }
  try {
    await fetch("/api/learning", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, memory: serializeLearningMemoryForChat(m) }),
    });
  } catch {
    // offline / ignore
  }
}
