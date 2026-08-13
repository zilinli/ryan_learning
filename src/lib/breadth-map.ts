/**
 * P1 — subject breadth footprint map (report §9.4.2).
 * A *lightweight* subject-coverage map for the Me hub: which broad subject
 * domains has this student touched / mastered, and which are still untouched.
 * Deliberately NOT a knowledge graph — the map stays hidden; kids only see
 * "explored vs not-yet" dots and one entry question per untouched subject.
 */

import type { LearningMemory, SkillMastery } from "./learning-memory";
import { getSkillDef } from "./skill-catalog";
import { loadInterests, type InterestRecord } from "./interest-store";

export type SubjectFootprint = {
  subject: "math" | "science" | "ela" | "humanities" | "language" | "general";
  label: string;
  emoji: string;
  /** At least one skill has been attempted */
  explored: boolean;
  skillCount: number;
  masteredCount: number;
  /** Suggested starter question for untouched subjects */
  starter: string;
};

const SUBJECT_META: Record<
  SubjectFootprint["subject"],
  { label: string; emoji: string; starter: string }
> = {
  math: {
    label: "Math",
    emoji: "🔢",
    starter: "Puzzle me one math question I haven't tried yet — just above my level.",
  },
  science: {
    label: "Science",
    emoji: "🔬",
    starter: "Show me one cool scientific idea I don't know yet, then let me investigate it.",
  },
  ela: {
    label: "ELA & Reading",
    emoji: "📚",
    starter: "Give me one short passage and ask me to prove my answer with evidence.",
  },
  humanities: {
    label: "History & People",
    emoji: "🏛️",
    starter: "Tell me one surprising true story from history, then ask me a question about it.",
  },
  language: {
    label: "Languages",
    emoji: "🗣️",
    starter: "Teach me one word or phrase in a new language and test me on it.",
  },
  general: {
    label: "General & Research",
    emoji: "🧭",
    starter: "Give me one research-style question and coach me to answer it step by step.",
  },
};

const MASTERED = 0.8;

export function buildBreadthFootprint(
  mem: LearningMemory | null | undefined,
  accountId = "default",
): SubjectFootprint[] {
  const bySubject = new Map<SubjectFootprint["subject"], { skills: number; mastered: number }>();
  for (const s of mem?.skills || []) {
    if (!s || s.attempts <= 0) continue;
    const def = getSkillDef(s.id);
    const subject = (def?.subject || "general") as SubjectFootprint["subject"];
    const b = bySubject.get(subject) || { skills: 0, mastered: 0 };
    b.skills += 1;
    if (s.pKnown >= MASTERED) b.mastered += 1;
    bySubject.set(subject, b);
  }

  // Interests also count as "explored" territory
  const interests = loadInterests(accountId);
  const interestSubjects = new Set<SubjectFootprint["subject"]>();
  for (const i of interests) {
    const subjectOfInterest = subjectForInterest(i);
    if (subjectOfInterest) interestSubjects.add(subjectOfInterest);
  }

  const keys: SubjectFootprint["subject"][] = [
    "math",
    "science",
    "ela",
    "humanities",
    "language",
    "general",
  ];
  return keys.map((subject) => {
    const b = bySubject.get(subject) || { skills: 0, mastered: 0 };
    const meta = SUBJECT_META[subject];
    const explored = b.skills > 0 || interestSubjects.has(subject);
    return {
      subject,
      label: meta.label,
      emoji: meta.emoji,
      explored,
      skillCount: b.skills,
      masteredCount: b.mastered,
      starter: meta.starter,
    };
  });
}

/** Rough subject guess from an interest record (via its label keywords). */
export function subjectForInterest(
  i: Pick<InterestRecord, "topicId" | "label">,
): SubjectFootprint["subject"] | null {
  const t = `${i.topicId} ${i.label}`.toLowerCase();
  if (/(math|number|money|sports|magic)/.test(t)) return "math";
  if (/(space|dinosaur|ocean|animal|weather|vehicle|robot)/.test(t)) return "science";
  if (/(music|food)/.test(t)) return "math"; // fraction-forward topics
  if (/(code|coding|program)/.test(t)) return "general";
  return null;
}

// ── V2 P1 — breadth as navigation (report §9.4.1) ───────────────────

/**
 * A door from a subject the child has mastered into an *adjacent* subject they
 * haven't — built from skill-catalog's `subject` + `adjacent` fields so the
 * map becomes a navigation tool, not just a record.
 */
export type SubjectBridge = {
  from: SubjectFootprint["subject"];
  fromLabel: string;
  /** The mastered skill that acts as the anchor ("you already know X"). */
  anchorSkillId: string;
  anchorSkillLabel: string;
  to: SubjectFootprint["subject"];
  toLabel: string;
  /** The adjacent, not-yet-mastered skill that opens the new subject. */
  doorSkillId: string;
  doorSkillLabel: string;
  /** Starter question: starts from what the child already knows. */
  starter: string;
};

/**
 * Find cross-subject bridges: for every mastered skill, look at its catalog
 * `adjacent` skills; when an adjacent skill lives in a different subject and
 * isn't mastered yet, that's a "you know X → try Y over there" door.
 * Deduped by (from→to) pair, best anchor wins.
 */
export function buildSubjectBridges(
  mem: LearningMemory | null | undefined,
): SubjectBridge[] {
  const skills = mem?.skills || [];
  const byId = new Map<string, SkillMastery>(skills.map((s) => [s.id, s]));
  const isMastered = (id: string) => {
    const s = byId.get(id);
    return !!s && s.attempts > 0 && s.pKnown >= MASTERED;
  };

  const best = new Map<string, SubjectBridge>();
  for (const s of skills) {
    if (!s || s.attempts <= 0 || s.pKnown < MASTERED) continue;
    const def = getSkillDef(s.id);
    if (!def?.adjacent?.length) continue;
    const from = (def.subject || "general") as SubjectFootprint["subject"];
    for (const adjId of def.adjacent) {
      if (isMastered(adjId)) continue; // not new ground
      const adjDef = getSkillDef(adjId);
      if (!adjDef) continue;
      const to = (adjDef.subject || "general") as SubjectFootprint["subject"];
      if (to === from) continue; // same-subject adjacency is ZPD, not breadth
      const key = `${from}->${to}`;
      const existing = best.get(key);
      if (
        existing &&
        s.pKnown < (byId.get(existing.anchorSkillId)?.pKnown ?? -1)
      )
        continue;
      best.set(key, {
        from,
        fromLabel: SUBJECT_META[from].label,
        anchorSkillId: s.id,
        anchorSkillLabel: s.label,
        to,
        toLabel: SUBJECT_META[to].label,
        doorSkillId: adjId,
        doorSkillLabel: adjDef.label,
        starter: `I already know ${s.label} — show me how that connects to ${adjDef.label} over in ${SUBJECT_META[to].label}. Give me ONE question that starts from what I know, then let me explore the new subject.`,
      });
    }
  }
  return [...best.values()];
}

/** One-shot handoff for a cross-subject bridge door (same key as subject starter). */
export function stashBreadthBridgeStarter(b: SubjectBridge): void {
  kickoffWrite(
    JSON.stringify({ subject: b.to, label: b.toLabel, starter: b.starter }),
  );
}

// ── Dashboard → chat handoff for "try an entry question" ────────────

const SUBJECT_KICKOFF_KEY = "spark.subjectStarter.v1";
const kickoffMemory = new Map<string, string>();

function kickoffWrite(raw: string): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SUBJECT_KICKOFF_KEY, raw);
      return;
    }
  } catch {
    /* fall through */
  }
  kickoffMemory.set(SUBJECT_KICKOFF_KEY, raw);
}

function kickoffRead(): string | null {
  try {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(SUBJECT_KICKOFF_KEY);
    }
  } catch {
    /* fall through */
  }
  return kickoffMemory.get(SUBJECT_KICKOFF_KEY) ?? null;
}

function kickoffClear(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SUBJECT_KICKOFF_KEY);
    }
  } catch {
    /* ignore */
  }
  kickoffMemory.delete(SUBJECT_KICKOFF_KEY);
}

/** One-shot handoff: "try an entry question in this untouched subject". */
export function stashSubjectStarter(f: SubjectFootprint): void {
  kickoffWrite(
    JSON.stringify({ subject: f.subject, label: f.label, starter: f.starter }),
  );
}

export function consumeSubjectStarter(): {
  subject: string;
  label: string;
  starter: string;
} | null {
  const raw = kickoffRead();
  kickoffClear();
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as {
      subject?: string;
      label?: string;
      starter?: string;
    };
    if (!p?.starter) return null;
    return {
      subject: String(p.subject || "general").slice(0, 32),
      label: String(p.label || "this subject").slice(0, 48),
      starter: String(p.starter).slice(0, 600),
    };
  } catch {
    return null;
  }
}
