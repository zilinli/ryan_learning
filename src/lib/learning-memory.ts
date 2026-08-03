/**
 * Cross-session learning memory for Ryan (topics, mastery, struggles, wins).
 * Stored in localStorage + synced to /api/learning for multi-device continuity.
 */

export type TopicMastery = {
  id: string;
  label: string;
  /** 0–100 */
  mastery: number;
  solves: number;
  lastSeen: number;
};

export type LearningMemory = {
  topics: TopicMastery[];
  recentStruggles: string[];
  recentWins: string[];
  updatedAt: number;
};

const KEY = "spark.learningMemory";
const MAX_TOPICS = 12;
const MAX_NOTES = 5;

export function emptyLearningMemory(): LearningMemory {
  return {
    topics: [],
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
  return {
    topics,
    recentStruggles: cleanNotes(raw.recentStruggles),
    recentWins: cleanNotes(raw.recentWins),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

function cleanNotes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.replace(/\s+/g, " ").trim().slice(0, 80))
    .slice(0, MAX_NOTES);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Keyword → topic buckets (G4 / BASIS-relevant). */
const TOPIC_RULES: Array<{ id: string; label: string; re: RegExp }> = [
  {
    id: "fractions",
    label: "fractions",
    re: /\bfract|fraction|equivalent|numerator|denominator|\d+\s*\/\s*\d+|分数|分數/i,
  },
  {
    id: "division",
    label: "division / long division",
    re: /\bdivid|÷|除法|除以|\b\d+\s*\/\s*\d+\b(?!\s*[a-z])/i,
  },
  {
    id: "multiplication",
    label: "multiplication facts",
    re: /\bmultipl|times table|×|x\s*\d+|乘法|乘以/i,
  },
  {
    id: "decimals",
    label: "decimals / place value",
    re: /\bdecimal|place value|小数|小數|位值/i,
  },
  {
    id: "geometry",
    label: "geometry",
    re: /\bangle|triangle|perimeter|area|geometry|几何|幾何|周长|面积/i,
  },
  {
    id: "science-space",
    label: "Earth–Moon–Sun / space",
    re: /\bmoon|phase|solar|planet|earth|sun|月亮|月相|太阳系|太陽系/i,
  },
  {
    id: "science-eco",
    label: "ecosystems",
    re: /\becosystem|habitat|food chain|生态|生態/i,
  },
  {
    id: "writing",
    label: "narrative writing",
    re: /\bparagraph|essay|writing|story|作文|写作|寫作|段落/i,
  },
  {
    id: "reading",
    label: "reading comprehension",
    re: /\breading|comprehension|passage|evidence|阅读|閱讀|理解/i,
  },
  {
    id: "humanities",
    label: "ancient civilizations",
    re: /\begypt|mesopotamia|civilization|pharaoh|埃及|美索不|文明/i,
  },
];

export function inferTopicsFromText(text: string): Array<{ id: string; label: string }> {
  const t = text || "";
  const out: Array<{ id: string; label: string }> = [];
  for (const rule of TOPIC_RULES) {
    if (rule.re.test(t)) out.push({ id: rule.id, label: rule.label });
  }
  return out;
}

function looksLikeStruggle(userText: string): boolean {
  return /\b(i don'?t know|idk|stuck|confused|hard|help|give up|不懂|不会|不會|好难|好難|唔识|唔識|卡住)\b/i.test(
    userText,
  );
}

function looksLikeWin(userText: string, assistantText: string): boolean {
  if (/\b(got it|i (got|see)|makes sense|明白了|懂了|会了|會了|得咗)\b/i.test(userText)) {
    return true;
  }
  // Assistant confirmed a correct student attempt
  if (
    /\b(yes[,!]?\s*(that'?s|you'?re)?\s*(right|correct)|nice work|you'?ve got it|exactly|对了|對了|答对|答對)\b/i.test(
      assistantText,
    )
  ) {
    return true;
  }
  return false;
}

/** Merge remote + local by newer updatedAt, union topics by id (prefer higher mastery). */
export function mergeLearningMemory(
  a: LearningMemory,
  b: LearningMemory,
): LearningMemory {
  const map = new Map<string, TopicMastery>();
  for (const t of [...a.topics, ...b.topics]) {
    const prev = map.get(t.id);
    if (!prev) {
      map.set(t.id, { ...t });
      continue;
    }
    map.set(t.id, {
      id: t.id,
      label: t.lastSeen >= prev.lastSeen ? t.label : prev.label,
      mastery: Math.max(prev.mastery, t.mastery),
      solves: Math.max(prev.solves, t.solves),
      lastSeen: Math.max(prev.lastSeen, t.lastSeen),
    });
  }
  const topics = [...map.values()]
    .sort((x, y) => y.lastSeen - x.lastSeen)
    .slice(0, MAX_TOPICS);
  const newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
  const older = newer === a ? b : a;
  return {
    topics,
    recentStruggles: [
      ...newer.recentStruggles,
      ...older.recentStruggles.filter((s) => !newer.recentStruggles.includes(s)),
    ].slice(0, MAX_NOTES),
    recentWins: [
      ...newer.recentWins,
      ...older.recentWins.filter((s) => !newer.recentWins.includes(s)),
    ].slice(0, MAX_NOTES),
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
  };
}

/**
 * Update memory after a tutoring turn.
 * Outcome heuristics keep this lightweight (no ML).
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
  const blob = [params.userText, params.chatTitle || "", params.assistantText || ""].join(
    "\n",
  );
  const inferred = inferTopicsFromText(blob);
  if (!inferred.length && !params.userText.trim()) return prev;

  const topics = [...prev.topics];
  const struggle = looksLikeStruggle(params.userText);
  const win = looksLikeWin(params.userText, params.assistantText || "");

  const ensure = (id: string, label: string) => {
    let t = topics.find((x) => x.id === id);
    if (!t) {
      t = { id, label, mastery: 40, solves: 0, lastSeen: now };
      topics.unshift(t);
    }
    t.label = label;
    t.lastSeen = now;
    t.solves += 1;
    if (win) t.mastery = clamp(t.mastery + 8, 0, 100);
    else if (struggle) t.mastery = clamp(t.mastery - 6, 0, 100);
    else t.mastery = clamp(t.mastery + 2, 0, 100);
  };

  if (inferred.length) {
    for (const t of inferred) ensure(t.id, t.label);
  } else if (params.userText.trim().length > 8) {
    ensure("general", "general practice");
  }

  const recentStruggles = [...prev.recentStruggles];
  const recentWins = [...prev.recentWins];
  if (struggle && inferred[0]) {
    const note = `Needed help with ${inferred[0].label}`;
    if (!recentStruggles.includes(note)) recentStruggles.unshift(note);
  }
  if (win && inferred[0]) {
    const note = `Progress on ${inferred[0].label}`;
    if (!recentWins.includes(note)) recentWins.unshift(note);
  }

  const next: LearningMemory = {
    topics: topics
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, MAX_TOPICS),
    recentStruggles: recentStruggles.slice(0, MAX_NOTES),
    recentWins: recentWins.slice(0, MAX_NOTES),
    updatedAt: now,
  };
  saveLearningMemory(next);
  return next;
}

/** Compact lines for the tutor system prompt */
export function learningMemoryPromptLines(mem?: LearningMemory | null): string[] {
  const m = mem && mem.topics.length ? mem : null;
  if (!m) {
    return [
      "",
      "[Learning memory — cross-session]",
      "No prior topic history yet. After this session, remember what Ryan practiced.",
    ];
  }

  const ranked = [...m.topics].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 6);
  const topicBits = ranked.map(
    (t) => `${t.label} (mastery ~${Math.round(t.mastery)})`,
  );
  const strong = ranked.filter((t) => t.mastery >= 70).map((t) => t.label);
  const weak = ranked.filter((t) => t.mastery <= 45).map((t) => t.label);

  const lines = [
    "",
    "[Learning memory — cross-session — use lightly]",
    `Recent topics: ${topicBits.join("; ") || "—"}.`,
  ];
  if (strong.length) {
    lines.push(
      `Strengths to celebrate briefly: ${strong.join(", ")}.`,
    );
  }
  if (weak.length) {
    lines.push(
      `Needs gentler scaffolds: ${weak.join(", ")}.`,
    );
  }
  if (m.recentWins.length) {
    lines.push(`Recent wins: ${m.recentWins.join(" · ")}.`);
  }
  if (m.recentStruggles.length) {
    lines.push(`Recent struggles: ${m.recentStruggles.join(" · ")}.`);
  }
  lines.push(
    "Continuity: on a fresh thread, ONE short offer to continue a recent topic is OK (e.g. “Last time you practiced fractions — want to warm up with one more?”).",
    "Adaptive difficulty: high mastery → slightly richer challenge / fewer L0 hints; low mastery → tinier steps and warmer L0–L1 choices. Never shame.",
    "Progress celebration: occasionally mention a streak or cumulative win when engagement stats are provided — keep it short and genuine.",
  );
  return lines;
}

export function learningMemorySummary(mem: LearningMemory): string | null {
  if (!mem.topics.length) return null;
  const top = [...mem.topics].sort((a, b) => b.lastSeen - a.lastSeen)[0];
  if (!top) return null;
  return `${top.label} · ${Math.round(top.mastery)}%`;
}

/** Compact snapshot safe to send in chat JSON */
export function serializeLearningMemoryForChat(
  mem: LearningMemory,
): LearningMemory {
  return {
    topics: mem.topics.slice(0, 8).map((t) => ({
      id: t.id,
      label: t.label.slice(0, 48),
      mastery: Math.round(t.mastery),
      solves: t.solves,
      lastSeen: t.lastSeen,
    })),
    recentStruggles: mem.recentStruggles.slice(0, 4),
    recentWins: mem.recentWins.slice(0, 4),
    updatedAt: mem.updatedAt,
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
  if (!mem.topics.length && !mem.recentWins.length && !mem.recentStruggles.length) {
    return;
  }
  try {
    await fetch("/api/learning", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory: serializeLearningMemoryForChat(mem) }),
    });
  } catch {
    // offline / ignore
  }
}
