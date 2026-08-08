/** Student profile — grade-agnostic, supports G1–G12. Ryan's profile is a saved account, not the system default. */

import {
  skillStrengths,
  skillWeaknesses,
  type LearningMemory,
} from "./learning-memory";

export type ChineseDialectPref = "zh" | "yue";

/** Grade band grouping shared pedagogical characteristics. */
export type GradeBand = "early" | "elementary" | "middle" | "high";

/** Derive grade band from a numeric grade (1–12). */
export function gradeBandForGrade(g: number): GradeBand {
  if (g <= 2) return "early";
  if (g <= 5) return "elementary";
  if (g <= 8) return "middle";
  return "high";
}

/** School curriculum context — null means auto-detect from grade. */
export type Curriculum = {
  label: string;
  grade: number;
  subjects: string[];
  textbookHints?: string;
};

export type StudentProfile = {
  name: string;
  age: number;
  /** Numeric grade 1–12 (was a string in v0; migrated on load). */
  grade: number;
  /** Band derived from grade — controls skill pool, BKT priors, language style. */
  gradeBand: GradeBand;
  school: string;
  /** School curriculum — null = auto-detect from grade. */
  curriculum: Curriculum | null;
  /** Auto Chinese: default 粤语 / Cantonese (use 云希 for 普通话) */
  preferredChinese: ChineseDialectPref;
  stronger: string[];
  focusAreas: string[];
};

/** Grade-agnostic default — prompt user on first launch. */
export const DEFAULT_STUDENT_PROFILE: StudentProfile = {
  name: "",
  age: 9,
  grade: 4,
  gradeBand: "elementary",
  school: "",
  curriculum: null,
  preferredChinese: "yue",
  stronger: [],
  focusAreas: [],
};

/** Ryan's complete profile — preserved as a named export, not the system default. */
export const RYAN_PROFILE: StudentProfile = {
  name: "Ryan",
  age: 9,
  grade: 4,
  gradeBand: "elementary",
  school: "BASIS International School",
  curriculum: {
    label: "BASIS G4 (Envision Math G5 accelerated)",
    grade: 4,
    subjects: ["math", "science", "humanities", "ela"],
    textbookHints: "BASIS G5 Envision Mathematics (Savvas, ISBN 978-1-4188-4685-5)",
  },
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
/** Tracks which account IDs were present in the last successful server sync.
 *  Used to detect server-side deletions (account removed on another device). */
const SERVER_SYNC_IDS_KEY = "spark.accounts.serverIds.v1";
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
  const parsed = partial ?? ({} as Partial<StudentProfile>);
  // Handle legacy string grade → numeric migration
  let gradeNum = 4;
  if (typeof (parsed as Record<string, unknown>).grade === "number") {
    gradeNum = (parsed as Record<string, unknown>).grade as number;
  } else if (typeof (parsed as Record<string, unknown>).grade === "string") {
    const match = String((parsed as Record<string, unknown>).grade).match(/Grade (\d+)/i);
    if (match) gradeNum = parseInt(match[1], 10);
  }
  const band = gradeBandForGrade(gradeNum);

  // Handle curriculum: null = auto-detect, otherwise normalize
  const curRaw = (parsed as Record<string, unknown>).curriculum;
  let curriculum: Curriculum | null = null;
  if (curRaw && typeof curRaw === "object") {
    const c = curRaw as Record<string, unknown>;
    curriculum = {
      label: typeof c.label === "string" ? c.label : "",
      grade: typeof c.grade === "number" ? c.grade : gradeNum,
      subjects: Array.isArray(c.subjects) ? c.subjects.filter((s): s is string => typeof s === "string") : [],
      textbookHints: typeof c.textbookHints === "string" ? c.textbookHints : undefined,
    };
  }

  return {
    ...DEFAULT_STUDENT_PROFILE,
    name: typeof parsed.name === "string" ? parsed.name.trim() : DEFAULT_STUDENT_PROFILE.name,
    age: typeof parsed.age === "number" ? parsed.age : DEFAULT_STUDENT_PROFILE.age,
    grade: gradeNum,
    gradeBand: band,
    school: typeof parsed.school === "string" ? parsed.school : DEFAULT_STUDENT_PROFILE.school,
    curriculum,
    preferredChinese: (parsed as Record<string, unknown>).preferredChinese === "zh" ? "zh" : "yue",
    stronger: Array.isArray(parsed.stronger)
      ? parsed.stronger.filter((s): s is string => typeof s === "string")
      : DEFAULT_STUDENT_PROFILE.stronger,
    focusAreas: Array.isArray(parsed.focusAreas)
      ? parsed.focusAreas.filter((s): s is string => typeof s === "string")
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
    profile: { ...RYAN_PROFILE },
    createdAt: now,
    updatedAt: now,
  };
}

function ensureDefaultAccount(store: AccountsStore): AccountsStore {
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
        const withRyan = ensureDefaultAccount({
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
    const next = ensureDefaultAccount(store);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
    const active = next.accounts.find((a) => a.id === next.activeId);
    if (active) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(active.profile));
    }
    // Push to server so accounts are shared across devices (fire-and-forget)
    void pushAccountsToServer(next);
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

/** Create a new account from a typed name (and optional grade/profile overrides) and switch to it. */
export function createAccount(
  name: string,
  storeOrProfile?: AccountsStore | Partial<StudentProfile>,
  maybeStore?: AccountsStore,
): AccountsStore {
  // Flexible overload: createAccount(name) — simple; createAccount(name, store) — legacy;
  // createAccount(name, { grade: 8 }) — new partial profile; createAccount(name, profilePartial, store)
  let store: AccountsStore;
  let profileOverrides: Partial<StudentProfile> = {};

  if (maybeStore !== undefined) {
    // 3-arg form: createAccount(name, profileOverrides, store)
    profileOverrides = (storeOrProfile as Partial<StudentProfile>) || {};
    store = maybeStore;
  } else if (storeOrProfile && typeof storeOrProfile === "object" && "version" in storeOrProfile) {
    // 2-arg legacy: createAccount(name, store)
    store = storeOrProfile as AccountsStore;
  } else if (storeOrProfile && typeof storeOrProfile === "object") {
    // 2-arg new: createAccount(name, profileOverrides)
    profileOverrides = storeOrProfile as Partial<StudentProfile>;
    store = loadAccounts();
  } else {
    store = loadAccounts();
  }

  const base = store;
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
              profile: normalizeProfile({ ...a.profile, name: "Ryan" }),
              updatedAt: now,
            }
          : a,
      ),
    };
    saveAccounts(next);
    return next;
  }
  // New accounts get grade-agnostic defaults + overrides (not Ryan's copy)
  const profile = normalizeProfile({ ...DEFAULT_STUDENT_PROFILE, name: trimmed, ...profileOverrides });
  const record: AccountRecord = {
    id,
    profile,
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
  const base = ensureDefaultAccount(store ?? loadAccounts());
  const now = Date.now();
  const next: AccountsStore = {
    ...base,
    activeId: switchTo ? RYAN_ACCOUNT_ID : base.activeId,
    accounts: base.accounts.map((a) =>
      a.id === RYAN_ACCOUNT_ID
        ? {
            ...a,
            profile: { ...RYAN_PROFILE, ...a.profile, name: "Ryan" },
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
  profile: StudentProfile = RYAN_PROFILE,
): string[] {
  const gradeLabel = `Grade ${profile.grade}`;
  const schoolText = profile.school || "(no school set)";
  const curLines = profile.curriculum
    ? `Curriculum: ${profile.curriculum.label} — subjects: ${profile.curriculum.subjects.join(", ")}.`
    : `Curriculum: grade-appropriate general topics (auto-detected from Grade ${profile.grade}).`;
  return [
    "",
    "[Student profile — know this learner]",
    `Name: ${profile.name || "(new student)"} (${profile.age} years old).`,
    `School: ${schoolText}, ${gradeLabel}.`,
    `Grade band: ${profile.gradeBand} (controls difficulty, vocabulary, and skill scope).`,
    `Stronger / likes: ${profile.stronger.join("; ") || "—"}.`,
    `Watch / support: ${profile.focusAreas.join("; ") || "—"}.`,
    `Chinese preference for Auto mode: ${
      profile.preferredChinese === "yue" ? "粤语 / Cantonese" : "普通话 / Mandarin"
    }.`,
    curLines,
    profile.name
      ? `Address the student as ${profile.name} naturally sometimes. Remember frustration moments and celebrate small wins.`
      : `Ask the student what they'd like to be called. Remember frustration moments and celebrate small wins.`,
    "If starting a fresh thread, you may briefly recall a recent topic from [Recent chats] if provided.",
  ];
}

/**
 * Generate grade-band-appropriate curriculum hints for the system prompt.
 * Called by buildTutorPrompt — replaces the hardcoded ENVISION_G5_PROMPT_HINT.
 */
export function curriculumPromptLines(profile: StudentProfile): string[] {
  const band = profile.gradeBand;
  const cur = profile.curriculum;

  if (cur && cur.label.includes("BASIS")) {
    // BASIS-specific textbook refs by band
    const refs: string[] = [];
    if (profile.grade <= 5 && cur.subjects.includes("math")) {
      refs.push(
        "BASIS Accelerated Math: Envision Mathematics G6 (Savvas, ISBN 978-1-4188-4908-5).",
        "Fractions denominators: 2,3,4,5,6,8,10,12,100 (Common Core G5).",
        "Multi-digit ÷: up to 4-digit ÷ 2-digit. Word problems: multi-step with bar models (Singapore CPA).",
      );
    } else if (profile.grade >= 6 && profile.grade <= 8 && cur.subjects.includes("math")) {
      refs.push(
        `BASIS Math: ${profile.grade === 6 ? "Envision Mathematics Accelerated G7" : profile.grade === 7 ? "Envision A|G|A Algebra 1 (ISBN 978-1-4188-5436-2)" : "Envision A|G|A Algebra 2 (ISBN 978-1-4188-5452-2)"}.`,
        "Fractions extend to rational numbers, ratios, and proportional reasoning.",
        "Multi-step equation solving. Geometry: angles, transformations, volume.",
      );
    } else if (profile.grade >= 9 && cur.subjects.includes("math")) {
      refs.push(
        "BASIS Honors/AP Math track. AP Calculus references: Larson/Stewart.",
        "Rational functions, asymptotes, complex fractions. Formal proofs expected.",
        "Khan Academy as supplemental resource.",
      );
    }
    if (profile.grade >= 6 && cur.subjects.some((s) => s === "science")) {
      refs.push(
        "BASIS three-science model: Biology, Chemistry, Physics taught concurrently.",
      );
    }
    if (refs.length) {
      return ["", "[BASIS Curriculum — grade-band alignment]", ...refs];
    }
  }

  // Generic grade-band curriculum hints
  if (band === "early") {
    return [
      "",
      "[Curriculum — K-2]",
      "Math: counting, shapes, addition/subtraction within 20, place value to 100.",
      "Reading: letter sounds, sight words, simple sentences. Concrete examples, lots of encouragement.",
    ];
  }
  if (band === "elementary") {
    return [
      "",
      "[Curriculum — G3-5]",
      "Math: fractions, decimals, multiplication/division fluency, multi-step word problems.",
      "Fractions denominator range: 2,3,4,5,6,8,10,12,100. Use food/sharing metaphors.",
      "Science: ecosystems, solar system, simple experiments. Humanities: ancient civilizations.",
    ];
  }
  if (band === "middle") {
    return [
      "",
      "[Curriculum — G6-8]",
      "Math: pre-algebra, algebra I, geometry, statistics. Fractions → rational numbers, proportional reasoning.",
      "Science: Biology, Chemistry, Physics (often concurrent). Argumentative writing, text analysis.",
    ];
  }
  // high
  return [
    "",
    "[Curriculum — G9-12]",
    "Math: Algebra II, trig, pre-calc, calculus. Statistics, functions, modeling.",
    "Science: Honors/AP Biology, Chemistry, Physics. Literary analysis, research papers.",
    "If grade 12: act as research advisor for capstone projects — methodology coaching, not drills.",
  ];
}

/** ----- Server-side accounts sync (cross-device) ----- */

/**
 * Fetch the global account list from the server and merge with local.
 * Server accounts are authoritative; any local-only accounts are uploaded.
 * Returns the merged store (already saved to localStorage).
 */
export async function hydrateAccountsFromServer(): Promise<AccountsStore> {
  const local = loadAccounts();
  try {
    const res = await fetch("/api/accounts");
    if (!res.ok) return local;
    const data = (await res.json()) as { accounts: AccountRecord[] | null; version?: number };

    // Server has no accounts yet → push local to bootstrap the shared store
    if (!data.accounts || !Array.isArray(data.accounts) || data.accounts.length === 0) {
      void pushAccountsToServer(local);
      return local;
    }

    const serverStore: AccountsStore = {
      version: 1,
      activeId: local.activeId,
      accounts: data.accounts,
    };

    const merged = mergeServerAccounts(local, serverStore);
    // Remember server IDs so we can detect deletions on next sync
    recordServerSyncIds(serverStore.accounts);
    saveAccounts(merged);
    return merged;
  } catch {
    return local;
  }
}

/**
 * Push the current local accounts store to the server (fire-and-forget).
 * The server becomes the shared source of truth for all devices.
 */
export function pushAccountsToServer(store?: AccountsStore): void {
  try {
    const payload = store ?? loadAccounts();
    void fetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // non-critical
  }
}

/** Server baseline + add any local-only accounts, ensure Ryan exists.
 *  Accounts that were previously on the server but are now missing → deleted remotely → drop locally. */
function mergeServerAccounts(local: AccountsStore, server: AccountsStore): AccountsStore {
  const serverIds = new Set(server.accounts.map((a) => a.id));
  const prevServerIds = readServerSyncIds();
  const mergedAccounts = [...server.accounts];
  let changed = false;

  for (const acct of local.accounts) {
    if (serverIds.has(acct.id)) continue;
    // Local-only account → was it known from a previous server sync?
    if (prevServerIds.has(acct.id)) {
      // This account was on the server before but is now missing → deleted on another device
      changed = true;
      continue; // drop it
    }
    // Genuinely new local account → add to merged list + will be pushed to server
    mergedAccounts.push(acct);
  }

  const result = ensureDefaultAccount({
    version: 1,
    activeId: local.activeId,
    accounts: mergedAccounts,
  });

  // If we dropped accounts, persist the cleanup immediately
  if (changed) saveAccounts(result);

  return result;
}

/** Store server account IDs for deletion detection on the next sync. */
function recordServerSyncIds(accounts: AccountRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const ids = accounts.map((a) => a.id);
    localStorage.setItem(SERVER_SYNC_IDS_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
  // Also record as side-effect of success
}

/** Read the set of account IDs that were in the last successful server sync. */
function readServerSyncIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SERVER_SYNC_IDS_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    if (Array.isArray(ids)) return new Set(ids);
  } catch { /* ignore */ }
  return new Set();
}
