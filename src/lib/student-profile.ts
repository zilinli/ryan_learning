/** Ryan / family student profile + BASIS G4 context (local, editable). */

import {
  skillStrengths,
  skillWeaknesses,
  type LearningMemory,
} from "./learning-memory";

export type ChineseDialectPref = "zh" | "yue";

export type StudentProfile = {
  name: string;
  age: number;
  grade: string;
  school: string;
  /** Auto Chinese: default 粤语 / Cantonese (use 云希 for 普通话) */
  preferredChinese: ChineseDialectPref;
  stronger: string[];
  focusAreas: string[];
};

export const DEFAULT_STUDENT_PROFILE: StudentProfile = {
  name: "Ryan",
  age: 9,
  grade: "Grade 4 (G4)",
  school: "BASIS International School",
  preferredChinese: "yue",
  stronger: ["science curiosity", "trying again after a short break"],
  focusAreas: [
    "multi-step fraction word problems",
    "staying calm when stuck",
  ],
};

/** Compact BASIS G4 subject map for tutoring continuity */
export const BASIS_G4_CURRICULUM = [
  "Math: fractions & decimals, place value, geometry basics, multi-step word problems",
  "Science: solar system / Earth–Moon–Sun, ecosystems, simple experiments",
  "Humanities: ancient civilizations (e.g. Egypt & Mesopotamia), compare/contrast",
  "ELA: reading comprehension with evidence, narrative writing, vocabulary",
].join("; ");

/** v2: Chinese preference defaults to 粤语 (old key may have stored 普通话). */
const PROFILE_KEY = "spark.studentProfile.v2";

export function loadStudentProfile(): StudentProfile {
  if (typeof window === "undefined") return { ...DEFAULT_STUDENT_PROFILE };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_STUDENT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<StudentProfile>;
    return {
      ...DEFAULT_STUDENT_PROFILE,
      ...parsed,
      preferredChinese:
        parsed.preferredChinese === "zh" ? "zh" : "yue",
      stronger: Array.isArray(parsed.stronger)
        ? parsed.stronger
        : DEFAULT_STUDENT_PROFILE.stronger,
      focusAreas: Array.isArray(parsed.focusAreas)
        ? parsed.focusAreas
        : DEFAULT_STUDENT_PROFILE.focusAreas,
    };
  } catch {
    return { ...DEFAULT_STUDENT_PROFILE };
  }
}

export function saveStudentProfile(profile: StudentProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/**
 * Refresh static stronger/focus lists from BKT skill memory so the profile
 * stays aligned with what Ryan actually practices.
 */
export function syncProfileFromSkills(
  profile: StudentProfile,
  mem: LearningMemory,
): StudentProfile {
  const strong = skillStrengths(mem, 3).map((s) => s.label);
  const weak = skillWeaknesses(mem, 3).map((s) => s.label);
  const next: StudentProfile = {
    ...profile,
    stronger: strong.length
      ? strong
      : profile.stronger.length
        ? profile.stronger
        : DEFAULT_STUDENT_PROFILE.stronger,
    focusAreas: weak.length
      ? weak
      : profile.focusAreas.length
        ? profile.focusAreas
        : DEFAULT_STUDENT_PROFILE.focusAreas,
  };
  saveStudentProfile(next);
  return next;
}

/** Lines injected into every tutor prompt */
export function studentProfilePromptLines(
  profile: StudentProfile = DEFAULT_STUDENT_PROFILE,
): string[] {
  return [
    "",
    "[Student profile — know this learner]",
    `Name: ${profile.name} (${profile.age} years old).`,
    `School: ${profile.school}, ${profile.grade}.`,
    `Stronger / likes: ${profile.stronger.join("; ") || "—"}.`,
    `Watch / support: ${profile.focusAreas.join("; ") || "—"}.`,
    `Chinese preference for Auto mode: ${
      profile.preferredChinese === "yue" ? "粤语 / Cantonese" : "普通话 / Mandarin"
    }.`,
    `Curriculum map (BASIS G4 — use when relevant, do not quiz the syllabus): ${BASIS_G4_CURRICULUM}.`,
    `Address the student as ${profile.name} naturally sometimes. Remember frustration moments and celebrate small wins.`,
    "If starting a fresh thread, you may briefly recall a recent topic from [Recent chats] if provided.",
  ];
}
