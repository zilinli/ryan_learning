/**
 * Cross-session learning memory for Ryan.
 * Combines:
 * - Coarse topic buckets (legacy UI / continuity)
 * - Fine-grained skills with Bayesian Knowledge Tracing (BKT)
 *
 * Stored in localStorage + synced to /api/learning.
 */

import { masteryFromPKnown, pKnownFromMastery, softBktUpdate } from "./bkt";
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
  /** BKT P(L) in 0–1 */
  pKnown: number;
  /** 0–100 mirror of pKnown for display / legacy */
  mastery: number;
  attempts: number;
  correct: number;
  incorrect: number;
  /** Last self-report 1–3, if any */
  confidence?: number;
  lastSeen: number;
};

export type LearningMemory = {
  topics: TopicMastery[];
  skills: SkillMastery[];
  recentStruggles: string[];
  recentWins: string[];
  updatedAt: number;
};

export type TurnOutcome = "correct" | "incorrect" | "practice";

const KEY = "spark.learningMemory";
const MAX_TOPICS = 12;
const MAX_SKILLS = 24;
const MAX_NOTES = 5;

export function emptyLearningMemory(): LearningMemory {
  return {
    topics: [],
    skills: [],
    recentStruggles: [],
    recentWins: [],
    updatedAt: 0,
  };
}

export function loadLearningMemory(): LearningMemory {
  if (typeof window === "undefined") return emptyLearningMemory();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyLearningMemory();
    return normalizeMemory(JSON.parse(raw) as Partial<LearningMemory>);
  } catch {
    return emptyLearningMemory();
  }
}

export function saveLearningMemory(mem: LearningMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    // ignore quota
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function cleanNotes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.replace(/\s+/g, " ").trim().slice(0, 80))
    .slice(0, MAX_NOTES);
}

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
      });
      continue;
    }
    // Put mass on the first matching skill for that topic
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
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

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

function mergeSkill(a: SkillMastery, b: SkillMastery): SkillMastery {
  const newer = a.lastSeen >= b.lastSeen ? a : b;
  const pKnown = Math.max(a.pKnown, b.pKnown);
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
  return normalizeMemory({
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
    updatedAt: Math.max(na.updatedAt || 0, nb.updatedAt || 0),
  });
}

/**
 * Update memory after a tutoring turn using BKT on inferred skills.
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

  const base = normalizeMemory(prev);
  const skills = [...base.skills];
  const outcome = classifyTurnOutcome(
    params.userText,
    params.assistantText || "",
  );
  const confidence = parseConfidence(params.userText);

  const touch = (id: string, label: string, topicId: string) => {
    let s = skills.find((x) => x.id === id);
    if (!s) {
      s = {
        id,
        label,
        topicId,
        pKnown: 0.25,
        mastery: 25,
        attempts: 0,
        correct: 0,
        incorrect: 0,
        lastSeen: now,
      };
      skills.unshift(s);
    }
    s.label = label;
    s.topicId = topicId;
    s.lastSeen = now;
    s.attempts += 1;
    s.pKnown = softBktUpdate(s.pKnown, outcome);
    s.mastery = masteryFromPKnown(s.pKnown);
    if (outcome === "correct") s.correct += 1;
    if (outcome === "incorrect") s.incorrect += 1;
    if (confidence) s.confidence = confidence;
  };

  if (inferred.length) {
    for (const sk of inferred) touch(sk.id, sk.label, sk.topicId);
  } else if (params.userText.trim().length > 8) {
    touch("general-practice", "general practice", "general");
  }

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

/** Compact lines for the tutor system prompt */
export function learningMemoryPromptLines(mem?: LearningMemory | null): string[] {
  const m = mem ? normalizeMemory(mem) : null;
  if (!m || (!m.skills.length && !m.topics.length)) {
    return [
      "",
      "[Learning memory — skills / BKT]",
      "No prior skill history yet. After this session, update Ryan’s skill map (strengths vs focus areas).",
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
      `, n=${s.attempts})`,
  );

  const lines = [
    "",
    "[Learning memory — skills / Bayesian Knowledge Tracing — USE AS REFERENCE]",
    "Model: each skill has P(known) updated after turns (correct / incorrect / practice). Prefer this over guessing.",
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
      const extra = prereq.length
        ? ` — check prerequisites first: ${prereq.join(", ")}`
        : "";
      return `${s.label} ~${s.mastery}%${extra}`;
    });
    lines.push(`Focus / weaker skills (gentler scaffolds, more L0–L1): ${tips.join("; ")}.`);
  }
  if (m.recentWins.length) {
    lines.push(`Recent wins: ${m.recentWins.join(" · ")}.`);
  }
  if (m.recentStruggles.length) {
    lines.push(`Recent struggles: ${m.recentStruggles.join(" · ")}.`);
  }
  lines.push(
    "When asking a question: briefly tailor difficulty to the skill map (easier if weak; richer if strong).",
    "Continuity: on a fresh thread, ONE short offer to continue a weak or recent topic is OK.",
    "Adaptive difficulty: high P(known) → fewer L0 hints; low P(known) → tinier steps. Never shame.",
    "Self-assessment: after a harder win, you may ask confidence 1–3 once; store that feeling in the next turn.",
    "Progress celebration: occasionally mention a streak when engagement stats are provided — short and genuine.",
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
    })),
    recentStruggles: m.recentStruggles.slice(0, 4),
    recentWins: m.recentWins.slice(0, 4),
    updatedAt: m.updatedAt,
  };
}

export async function hydrateLearningMemoryFromServer(): Promise<LearningMemory> {
  const local = loadLearningMemory();
  try {
    const res = await fetch("/api/learning", { cache: "no-store" });
    if (!res.ok) return local;
    const data = (await res.json()) as { memory?: Partial<LearningMemory> };
    const remote = normalizeMemory(data.memory);
    const merged = mergeLearningMemory(local, remote);
    saveLearningMemory(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function pushLearningMemoryToServer(
  mem: LearningMemory,
): Promise<void> {
  const m = normalizeMemory(mem);
  if (!m.skills.length && !m.topics.length && !m.recentWins.length) {
    return;
  }
  try {
    await fetch("/api/learning", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory: serializeLearningMemoryForChat(m) }),
    });
  } catch {
    // offline / ignore
  }
}
