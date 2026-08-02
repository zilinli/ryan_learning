/** In-memory map: browser sessionId -> Cursor agentId (process-local LRU) */

const MAX_AGENTS = 40;

const sessionToAgent = new Map<string, string>();

function touch(sessionId: string, agentId: string): void {
  // Re-insert for LRU ordering (Map preserves insertion order)
  sessionToAgent.delete(sessionId);
  sessionToAgent.set(sessionId, agentId);
  while (sessionToAgent.size > MAX_AGENTS) {
    const oldest = sessionToAgent.keys().next().value;
    if (oldest === undefined) break;
    sessionToAgent.delete(oldest);
  }
}

export function getAgentId(sessionId: string): string | undefined {
  const id = sessionToAgent.get(sessionId);
  if (id) touch(sessionId, id);
  return id;
}

export function setAgentId(sessionId: string, agentId: string): void {
  touch(sessionId, agentId);
}

export function clearAgentId(sessionId: string): void {
  sessionToAgent.delete(sessionId);
}
