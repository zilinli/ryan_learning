/** In-memory map: browser sessionId -> Cursor agentId */
const sessionToAgent = new Map<string, string>();

export function getAgentId(sessionId: string): string | undefined {
  return sessionToAgent.get(sessionId);
}

export function setAgentId(sessionId: string, agentId: string): void {
  sessionToAgent.set(sessionId, agentId);
}

export function clearAgentId(sessionId: string): void {
  sessionToAgent.delete(sessionId);
}
