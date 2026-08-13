/**
 * P1 — subject breadth footprint map (report §9.4.2).
 * A *lightweight* subject-coverage map for the Me hub: which broad subject
 * domains has this student touched / mastered, and which are still untouched.
 * Deliberately NOT a knowledge graph — the map stays hidden; kids only see
 * "explored vs not-yet" dots and one entry question per untouched subject.
 */

import type { LearningMemory } from "./learning-memory";
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
