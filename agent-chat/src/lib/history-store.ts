import fs from "node:fs";
import path from "node:path";
import type { ConversationRecord, SessionMeta, SessionRegistry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "conversations");
const REGISTRY_PATH = path.join(process.cwd(), "data", "session-registry.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadRegistry(): SessionRegistry {
  ensureDir();
  try {
    const data = fs.readFileSync(REGISTRY_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return { sessions: [], lastUpdated: new Date().toISOString() };
  }
}

function saveRegistry(registry: SessionRegistry) {
  ensureDir();
  registry.lastUpdated = new Date().toISOString();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function sessionFilePath(sessionId: string): string {
  return path.join(DATA_DIR, `session-${sessionId.slice(0, 8)}.json`);
}

export function listSessions(): SessionMeta[] {
  const registry = loadRegistry();
  return registry.sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getConversation(sessionId: string): ConversationRecord | null {
  try {
    const data = fs.readFileSync(sessionFilePath(sessionId), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function upsertConversation(record: ConversationRecord) {
  ensureDir();
  record.updatedAt = new Date().toISOString();
  fs.writeFileSync(sessionFilePath(record.sessionId), JSON.stringify(record, null, 2));

  const registry = loadRegistry();
  const idx = registry.sessions.findIndex((s) => s.sessionId === record.sessionId);
  const meta: SessionMeta = {
    sessionId: record.sessionId,
    agentId: record.agentId,
    title: record.title,
    messageCount: record.messages.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    workspacePath: record.workspacePath,
  };

  if (idx >= 0) {
    registry.sessions[idx] = meta;
  } else {
    registry.sessions.push(meta);
  }

  saveRegistry(registry);
}

export function deleteConversation(sessionId: string) {
  const registry = loadRegistry();
  registry.sessions = registry.sessions.filter((s) => s.sessionId !== sessionId);
  saveRegistry(registry);

  try {
    fs.unlinkSync(sessionFilePath(sessionId));
  } catch {
    // file may not exist
  }
}
