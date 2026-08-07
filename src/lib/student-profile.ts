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

/**
 * Envision Mathematics Grade 5 topic list (BASIS G4 accelerated math).
 * Reference: ISBN 978-1-4188-4685-5. Used to scope problem difficulty.
 */
export const ENVISION_G5_TOPICS = [
  "Topic 1: Place value (whole numbers & decimals to thousandths)",
  "Topic 2: Adding & subtracting decimals",
  "Topic 3: Multiplying multi-digit whole numbers",
  "Topic 4: Dividing by 1-digit divisors (long division intro)",
  "Topic 5: Dividing by 2-digit divisors",
  "Topic 6: Variables & expressions (intro to algebra)",
  "Topic 7: Multiplying decimals",
  "Topic 8: Dividing decimals",
  "Topic 9: Adding & subtracting fractions",
  "Topic 10: Adding & subtracting mixed numbers",
  "Topic 11: Multiplying & dividing fractions and mixed numbers",
  "Topic 12: Volume of solids",
  "Topic 13: Units of measure",
  "Topic 14: Data (line plots, mean/median/mode)",
  "Topic 15: Classifying plane figures (triangles, quadrilaterals)",
  "Topic 16: Coordinate geometry (graphing on a plane)",
];

/** Prompt fragment: Envision G5 topic context for difficulty calibration. */
export const ENVISION_G5_PROMPT_HINT = [
  "",
  "[Envision Math G5 — textbook alignment]",
  "Ryan's school uses Envision Mathematics Grade 5 (Savvas, ISBN 978-1-4188-4685-5).",
  `G5 topics: ${ENVISION_G5_TOPICS.join(" · ")}.`,
  "When generating practice problems or scaffolding, stay within G5-appropriate difficulty:",
  "- Fraction denominators: 2,3,4,5,6,8,10,12,100 (Common Core G5 baseline).",
  "- Multi-digit ÷: up to 4-digit ÷ 2-digit.",
  "- Decimals: operations through thousandths.",
  "- Word problems: multi-step with bar models expected (Singapore CPA method).",
  "- Do NOT exceed G5 difficulty unless the student explicitly requests enrichment.",
].join("\n");

/** v2: Chinese preference defaults to 粤语 (old key may have stored 普通话). */
const PROFILE_KEY = "spark.studentProfile.v2";
/** Multi-account store — Ryan is always seeded as a switchable account. */
const ACCOUNTS_KEY = "spark.accounts.v1";
export const RYAN_ACCOUNT_ID = "acct_ryan";

export type AccountRecord = {
  id: string;
  profile: StudentProfile;
  createdAt: number;
  updatedAt: number;
};

export type AccountsStore = {
  version: 1;
  activeId: string;
  accounts: AccountRecord[];
};

function normalizeProfile(partial?: Partial<StudentProfile> | null): StudentProfile {
  const parsed = partial ?? {};
  return {
    ...DEFAULT_STUDENT_PROFILE,
    ...parsed,
    preferredChinese: parsed.preferredChinese === "zh" ? "zh" : "yue",
    stronger: Array.isArray(parsed.stronger)
      ? parsed.stronger
      : DEFAULT_STUDENT_PROFILE.stronger,
    focusAreas: Array.isArray(parsed.focusAreas)
      ? parsed.focusAreas
      : DEFAULT_STUDENT_PROFILE.focusAreas,
  };
}

function newAccountId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `acct_${crypto.randomUUID()}`;
  }
  return `acct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ryanAccount(now = Date.now()): AccountRecord {
  return {
    id: RYAN_ACCOUNT_ID,
    profile: { ...DEFAULT_STUDENT_PROFILE },
    createdAt: now,
    updatedAt: now,
  };
}

function ensureRyan(store: AccountsStore): AccountsStore {
  if (store.accounts.some((a) => a.id === RYAN_ACCOUNT_ID)) return store;
  return {
    ...store,
    accounts: [ryanAccount(), ...store.accounts],
  };
}

function emptyAccountsStore(): AccountsStore {
  const ryan = ryanAccount();
  return { version: 1, activeId: ryan.id, accounts: [ryan] };
}

export function loadAccounts(): AccountsStore {
  if (typeof window === "undefined") return emptyAccountsStore();
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AccountsStore;
      if (parsed?.version === 1 && Array.isArray(parsed.accounts)) {
        const accounts = parsed.accounts
          .filter((a) => a && typeof a.id === "string")
          .map((a) => ({
            id: a.id,
            profile: normalizeProfile(a.profile),
            createdAt: a.createdAt || Date.now(),
            updatedAt: a.updatedAt || Date.now(),
          }));
        const withRyan = ensureRyan({
          version: 1,
          activeId: parsed.activeId || RYAN_ACCOUNT_ID,
          accounts,
        });
        if (!withRyan.accounts.some((a) => a.id === withRyan.activeId)) {
          withRyan.activeId = withRyan.accounts[0]!.id;
        }
        return withRyan;
      }
    }
    // Migrate legacy single profile → multi-account (keep Ryan + optional other)
    const legacyRaw = localStorage.getItem(PROFILE_KEY);
    const store = emptyAccountsStore();
    if (legacyRaw) {
      const legacy = normalizeProfile(JSON.parse(legacyRaw) as Partial<StudentProfile>);
      if (legacy.name.trim() && legacy.name.trim() !== "Ryan") {
        const id = newAccountId();
        const now = Date.now();
        store.accounts.push({
          id,
          profile: legacy,
          createdAt: now,
          updatedAt: now,
        });
        store.activeId = id;
      } else {
        store.accounts = store.accounts.map((a) =>
          a.id === RYAN_ACCOUNT_ID ? { ...a, profile: legacy, updatedAt: Date.now() } : a,
        );
      }
    }
    saveAccounts(store);
    return store;
  } catch {
    return emptyAccountsStore();
  }
}

export function saveAccounts(store: AccountsStore): void {
  if (typeof window === "undefined") return;
  try {
    const next = ensureRyan(store);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
    const active = next.accounts.find((a) => a.id === next.activeId);
    if (active) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(active.profile));
    }
  } catch {
    // ignore
  }
}

export function getActiveAccount(store: AccountsStore): AccountRecord {
  return (
    store.accounts.find((a) => a.id === store.activeId) ||
    store.accounts.find((a) => a.id === RYAN_ACCOUNT_ID) ||
    store.accounts[0]!
  );
}

/** Create a new account from a typed name and switch to it. */
export function createAccount(name: string, store?: AccountsStore): AccountsStore {
  const base = store ?? loadAccounts();
  const trimmed = name.trim();
  if (!trimmed) return base;
  const now = Date.now();
  const id =
    trimmed.toLowerCase() === "ryan"
      ? RYAN_ACCOUNT_ID
      : newAccountId();
  if (id === RYAN_ACCOUNT_ID && base.accounts.some((a) => a.id === RYAN_ACCOUNT_ID)) {
    const next: AccountsStore = {
      ...base,
      activeId: RYAN_ACCOUNT_ID,
      accounts: base.accounts.map((a) =>
        a.id === RYAN_ACCOUNT_ID
          ? {
              ...a,
              profile: { ...a.profile, name: "Ryan" },
              updatedAt: now,
            }
          : a,
      ),
    };
    saveAccounts(next);
    return next;
  }
  const record: AccountRecord = {
    id,
    profile: {
      ...DEFAULT_STUDENT_PROFILE,
      name: trimmed,
    },
    createdAt: now,
    updatedAt: now,
  };
  const next: AccountsStore = {
    version: 1,
    activeId: id,
    accounts: [...base.accounts.filter((a) => a.id !== id), record],
  };
  saveAccounts(next);
  return next;
}

/** Switch the active account (e.g. to Ryan). */
export function switchAccount(accountId: string, store?: AccountsStore): AccountsStore {
  const base = store ?? loadAccounts();
  if (!base.accounts.some((a) => a.id === accountId)) return base;
  const next = { ...base, activeId: accountId };
  saveAccounts(next);
  return next;
}

/** Ensure Ryan exists as a saved account and optionally switch to it. */
export function saveRyanAccount(switchTo = false, store?: AccountsStore): AccountsStore {
  const base = ensureRyan(store ?? loadAccounts());
  const now = Date.now();
  const next: AccountsStore = {
    ...base,
    activeId: switchTo ? RYAN_ACCOUNT_ID : base.activeId,
    accounts: base.accounts.map((a) =>
      a.id === RYAN_ACCOUNT_ID
        ? {
            ...a,
            profile: { ...DEFAULT_STUDENT_PROFILE, ...a.profile, name: "Ryan" },
            updatedAt: now,
          }
        : a,
    ),
  };
  if (!next.accounts.some((a) => a.id === RYAN_ACCOUNT_ID)) {
    next.accounts = [ryanAccount(now), ...next.accounts];
  }
  saveAccounts(next);
  return next;
}

export function loadStudentProfile(): StudentProfile {
  if (typeof window === "undefined") return { ...DEFAULT_STUDENT_PROFILE };
  try {
    const accounts = loadAccounts();
    return { ...getActiveAccount(accounts).profile };
  } catch {
    return { ...DEFAULT_STUDENT_PROFILE };
  }
}

export function saveStudentProfile(profile: StudentProfile): void {
  try {
    const store = loadAccounts();
    const now = Date.now();
    const next: AccountsStore = {
      ...store,
      accounts: store.accounts.map((a) =>
        a.id === store.activeId
          ? { ...a, profile: normalizeProfile(profile), updatedAt: now }
          : a,
      ),
    };
    saveAccounts(next);
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
