import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data", "memory");
const SUMMARIES_PATH = path.join(DATA_DIR, "session-summaries.json");
const MAX_SUMMARIES = 10;

export interface SessionSummary {
  /** Unique sessionId this summary belongs to */
  sessionId: string;
  /** Human-readable title */
  title: string;
  /** What was accomplished in this session */
  accomplished: string;
  /** Key files created or modified */
  filesTouched: string[];
  /** Key commands or operations performed */
  keyActions: string[];
  /** Errors encountered and how they were resolved */
  pitfalls: string[];
  /** ISO timestamp */
  createdAt: string;
}

export interface MemoryStore {
  summaries: SessionSummary[];
  lastUpdated: string;
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadMemory(): MemoryStore {
  ensureDir();
  try {
    const data = fs.readFileSync(SUMMARIES_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return { summaries: [], lastUpdated: new Date().toISOString() };
  }
}

function saveMemory(store: MemoryStore) {
  ensureDir();
  store.lastUpdated = new Date().toISOString();
  fs.writeFileSync(SUMMARIES_PATH, JSON.stringify(store, null, 2));
}

/** Add a session summary and prune to MAX_SUMMARIES */
export function addSummary(summary: Omit<SessionSummary, "createdAt">) {
  const store = loadMemory();
  // Remove existing summary for same session if any
  store.summaries = store.summaries.filter((s) => s.sessionId !== summary.sessionId);
  store.summaries.push({ ...summary, createdAt: new Date().toISOString() });
  // Keep only the most recent N
  if (store.summaries.length > MAX_SUMMARIES) {
    store.summaries = store.summaries.slice(store.summaries.length - MAX_SUMMARIES);
  }
  saveMemory(store);
}

/** Get the last N session summaries for context injection */
export function getRecentSummaries(n: number = 5): SessionSummary[] {
  const store = loadMemory();
  return store.summaries.slice(-n);
}

/** Build a compact memory text for system prompt injection */
export function buildMemoryContext(n: number = 5): string {
  const summaries = getRecentSummaries(n);
  if (summaries.length === 0) return "";

  const lines = ["## Session Memory (recent work)", ""];
  for (const s of summaries) {
    const date = new Date(s.createdAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    lines.push(`### ${date} — ${s.title}`);
    lines.push(`- **Accomplished**: ${s.accomplished}`);
    if (s.filesTouched.length > 0) {
      lines.push(`- **Files modified**: ${s.filesTouched.slice(0, 5).join(", ")}`);
    }
    if (s.keyActions.length > 0) {
      lines.push(`- **Key actions**: ${s.keyActions.slice(0, 3).join(", ")}`);
    }
    if (s.pitfalls.length > 0) {
      lines.push(`- **Pitfalls & fixes**: ${s.pitfalls.slice(0, 2).join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Generate a session summary from the conversation messages (client-side can call API) */
export function generateSummary(
  sessionId: string,
  title: string,
  messages: { role: string; content: string }[]
): Omit<SessionSummary, "createdAt"> {
  const userMessages = messages.filter((m) => m.role === "user");
  const allUserText = userMessages.map((m) => m.content).join(" ");

  // Extract files mentioned in agent responses
  const agentText = messages
    .filter((m) => m.role === "agent")
    .map((m) => m.content)
    .join("\n");

  const filePattern = /`?(\/[^\s`]+)`?/g;
  const files = new Set<string>();
  let match;
  while ((match = filePattern.exec(agentText)) !== null) {
    files.add(match[1]);
  }

  return {
    sessionId,
    title,
    accomplished: title,
    filesTouched: Array.from(files).slice(0, 10),
    keyActions: userMessages.map((m) => m.content.slice(0, 80)),
    pitfalls: [],
  };
}
