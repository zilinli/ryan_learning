import type { CodeAgentPanelContext, MiniConsoleState } from "./types";
const K = "spark.miniConsole";
const CK = "spark.consoleSessionId";
const PK = "spark.codeAgentPanel";
const D: MiniConsoleState = { open: false, sessionId: "", phase: "idle", userMessage: "", agentMessage: "" };

function hasLS(): boolean { return typeof localStorage !== "undefined"; }

export function loadMiniConsoleState(): MiniConsoleState {
  if (!hasLS()) return { ...D };
  try { const r = localStorage.getItem(K); return r ? { ...D, ...JSON.parse(r) } : { ...D }; } catch { return { ...D }; }
}
export function saveMiniConsoleState(s: MiniConsoleState) {
  if (!hasLS()) return;
  try { localStorage.setItem(K, JSON.stringify(s)); } catch {}
}
export function clearMiniConsoleState() {
  if (!hasLS()) return;
  try { localStorage.removeItem(K); } catch {}
}
export function getConsoleSessionId(): string {
  if (!hasLS()) return `cs_ssr_${Date.now()}`;
  const e = localStorage.getItem(CK); if (e) return e;
  const id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(CK, id); return id;
}
export function setConsoleSessionId(id: string) {
  if (!hasLS()) return;
  localStorage.setItem(CK, id);
}

const PANEL_DEFAULT: CodeAgentPanelContext = {
  sessionId: "", phase: "idle", messages: [], updatedAt: 0,
};

export function loadCodeAgentPanelContext(): CodeAgentPanelContext {
  if (!hasLS()) return { ...PANEL_DEFAULT };
  try {
    const r = localStorage.getItem(PK);
    if (!r) return { ...PANEL_DEFAULT };
    const parsed = JSON.parse(r) as Partial<CodeAgentPanelContext>;
    return {
      ...PANEL_DEFAULT,
      ...parsed,
      messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-20) : [],
    };
  } catch {
    return { ...PANEL_DEFAULT };
  }
}

export function saveCodeAgentPanelContext(ctx: CodeAgentPanelContext) {
  if (!hasLS()) return;
  try {
    localStorage.setItem(PK, JSON.stringify({
      ...ctx,
      messages: ctx.messages.slice(-20),
      updatedAt: Date.now(),
    }));
  } catch {}
}

export function clearCodeAgentPanelContext() {
  if (!hasLS()) return;
  try { localStorage.removeItem(PK); } catch {}
}
