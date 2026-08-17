import path from "node:path";
import { Agent, AgentBusyError, Cursor, CursorAgentError } from "@cursor/sdk";
import type { Run, SDKAgent, SDKImage } from "@cursor/sdk";
import { isAgentBusyError } from "./agent-retry";
import { DEFAULT_CURSOR_API_KEY } from "./default-api-key";
import { hasLlmFallback, streamLlmFallback } from "./llm-fallback";
import {
  clearAgentId,
  getAgentId,
  setAgentId,
} from "./session-store";
import { createTutorHarnessTools, statusLabelForTool } from "./tutor-harness";
import {
  ensureTutorDiagrams,
  extractGeometryMarkdown,
} from "./geometry-svg";
import { preferCompleteTutorText } from "./tutor-text-filter";
import { appendRunLog } from "./run-log";

const TUTOR_CWD = path.join(process.cwd(), "tutor-workspace");
const HARNESS_TOOLS = createTutorHarnessTools();

/** Serialize chat turns per browser session — overlapping send() → AgentBusyError. */
const sessionGates = new Map<string, Promise<void>>();

async function withSessionGate<T>(
  sessionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = sessionGates.get(sessionId) ?? Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  sessionGates.set(
    sessionId,
    prev.then(() => held).catch(() => held),
  );
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (sessionGates.get(sessionId) === held) sessionGates.delete(sessionId);
  }
}

/** Cancel leftover local runs so the next send is not blocked. */
async function cancelRunningRuns(agentId: string): Promise<void> {
  try {
    const { items } = await Agent.listRuns(agentId, {
      runtime: "local",
      cwd: TUTOR_CWD,
      limit: 8,
    });
    await Promise.all(
      items
        .filter((r) => r.status === "running")
        .map(async (r) => {
          try {
            if (r.supports("cancel")) await r.cancel();
            else {
              await Agent.cancelRun(r.id, {
                runtime: "local",
                cwd: TUTOR_CWD,
              });
            }
          } catch {
            // ignore
          }
        }),
    );
  } catch {
    // ignore — fall through to fresh-agent retry
  }
}

// Safety net: catch unhandled rejections that bypass application try/catch
// (e.g., SDK internal gRPC errors)
if (typeof process !== "undefined") {
  process.on("unhandledRejection", (reason) => {
    console.error(
      "[Spark] Unhandled Rejection (safety net):",
      reason instanceof Error ? reason.message : String(reason),
    );
  });
}

function requireApiKey(): string {
  const key =
    process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!key) {
    throw new Error("尚未配置 Cursor API Key。");
  }
  // 保证后续 SDK / 子进程也能读到
  process.env.CURSOR_API_KEY = key;
  return key;
}

function modelSelection() {
  const id = process.env.CURSOR_MODEL?.trim() || "auto";
  return { id };
}

async function createTutorAgent(): Promise<SDKAgent> {
  return Agent.create({
    apiKey: requireApiKey(),
    model: modelSelection(),
    name: "Spark Tutor",
    local: {
      cwd: TUTOR_CWD,
      settingSources: [],
      customTools: HARNESS_TOOLS,
    },
  });
}

async function getOrCreateAgent(
  sessionId: string,
  reset?: boolean,
): Promise<SDKAgent> {
  if (reset) {
    clearAgentId(sessionId);
  }

  const existing = getAgentId(sessionId);
  if (existing) {
    try {
      return await Agent.resume(existing, {
        apiKey: requireApiKey(),
        model: modelSelection(),
        local: {
          cwd: TUTOR_CWD,
          settingSources: [],
          customTools: HARNESS_TOOLS,
        },
      });
    } catch {
      // Clear stale mapping — fall through to create fresh
      clearAgentId(sessionId);
    }
  }

  const agent = await createTutorAgent();
  setAgentId(sessionId, agent.agentId);
  return agent;
}

export type StreamHandlers = {
  onText: (delta: string) => void;
  onStatus?: (status: string) => void;
};

export async function streamTutorReply(params: {
  sessionId: string;
  text: string;
  images?: SDKImage[];
  reset?: boolean;
  signal?: AbortSignal;
  handlers: StreamHandlers;
  /** Internal: set by retry to prevent infinite recursion. */
  _staleRetried?: boolean;
  /** Internal: set once we already fell back to a backup LLM this turn. */
  _fallbackTried?: boolean;
}): Promise<{ agentId: string; fullText: string; fallback?: boolean }> {
  if (params.signal?.aborted) {
    throw new Error("Request cancelled");
  }

  const agent = await getOrCreateAgent(params.sessionId, params.reset);
  let fullText = "";
  let emittedViaDelta = false;
  const capturedDiagrams: string[] = [];
  const startTime = Date.now();
  let runId = "";

  const closeAgent = () => {
    try {
      agent.close();
    } catch {
      // ignore
    }
  };

  const onAbort = () => closeAgent();
  params.signal?.addEventListener("abort", onAbort);

  try {
    const message =
      params.images && params.images.length > 0
        ? { text: params.text, images: params.images }
        : params.text;

    const emitExtra = (next: string) => {
      if (!next) return;
      if (next.length > fullText.length && next.startsWith(fullText)) {
        const extra = next.slice(fullText.length);
        fullText = next;
        if (extra) params.handlers.onText(extra);
        return;
      }
      if (!fullText) {
        fullText = next;
        params.handlers.onText(next);
      }
    };

    const injectDiagram = (diagram: string) => {
      if (!diagram || capturedDiagrams.includes(diagram)) return;
      capturedDiagrams.push(diagram);
      if (!fullText.includes("data:image/svg+xml")) {
        const inject = fullText.trim()
          ? `\n\n${diagram}\n\n`
          : `${diagram}\n\n`;
        fullText += inject;
        params.handlers.onText(inject);
      }
    };

    const run = await agent.send(message, {
      local: { customTools: HARNESS_TOOLS },
      onDelta: ({ update }) => {
        if (params.signal?.aborted) return;
        if (update.type === "text-delta" && update.text) {
          emittedViaDelta = true;
          fullText += update.text;
          params.handlers.onText(update.text);
        }
      },
    });
    runId = run.id;

    for await (const event of run.stream()) {
      if (params.signal?.aborted) {
        throw new Error("Request cancelled");
      }
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            if (!emittedViaDelta) {
              emitExtra(block.text);
            } else if (
              block.text.length > fullText.length &&
              block.text.startsWith(fullText)
            ) {
              emitExtra(block.text);
            }
          }
        }
      } else if (event.type === "tool_call") {
        if (event.status === "running" && event.name) {
          const key = event.name.replace(/^.*\//, "");
          params.handlers.onStatus?.(statusLabelForTool(key));
        }
        if (
          (event.status === "completed" || event.status === "error") &&
          event.name
        ) {
          const key = event.name.replace(/^.*\//, "");
          if (key === "draw_geometry" || key.endsWith("draw_geometry")) {
            const diagram = extractGeometryMarkdown(event.result);
            if (diagram) injectDiagram(diagram);
          }
        }
      } else if (event.type === "thinking") {
        params.handlers.onStatus?.("Thinking…");
      } else if (event.type === "status" && event.message) {
        const raw = String(event.message);
        const toolish = raw.replace(/^.*\//, "").trim();
        const label = statusLabelForTool(toolish);
        params.handlers.onStatus?.(
          label.startsWith("Using ") ? raw : label,
        );
      }
    }

    if (params.signal?.aborted) {
      throw new Error("Request cancelled");
    }

    const result = await run.wait();

    // Log every run for audit / reliability tracking
    appendRunLog({
      timestamp: new Date().toISOString(),
      sessionId: params.sessionId,
      agentId: agent.agentId,
      runId: result.id,
      status: result.status === "error" ? "error" : result.status === "cancelled" ? "cancelled" : "completed",
      durationMs: result.durationMs ?? (Date.now() - startTime),
      model: result.model?.id,
      errorMessage: result.status === "error" ? (result as unknown as Record<string,unknown>).error as string : undefined,
    }).catch(() => {});

    // Stale-session bare error: retry ONCE with fresh agent
    if (result.status === "error" && !(result as unknown as Record<string,unknown>).error && !params._staleRetried) {
      clearAgentId(params.sessionId);
      closeAgent();
      return streamTutorReply({ ...params, _staleRetried: true });
    }

    if (result.status === "error") {
      throw new Error(`Tutor run failed (${result.id}). Try again or start a new chat.`);
    }

    fullText = preferCompleteTutorText(fullText, result.result);
    fullText = ensureTutorDiagrams(fullText, capturedDiagrams);

    if (!fullText.trim()) {
      fullText =
        "I couldn't generate a reply. Try again, or start a new chat.";
      params.handlers.onText(fullText);
    }

    return { agentId: agent.agentId, fullText };
  } catch (err) {
    // Log error runs
    appendRunLog({
      timestamp: new Date().toISOString(),
      sessionId: params.sessionId,
      agentId: agent.agentId,
      runId: runId || "unknown",
      status: "error",
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : String(err),
    }).catch(() => {});

    if (params.signal?.aborted) {
      throw new Error("Request cancelled");
    }

    // ── Multi-model fallback ────────────────────────────────────────
    // When the primary Cursor Agent path fails (agent start error, run
    // error, or missing key), degrade to an OpenAI-compatible backup LLM
    // (DeepSeek / 百炼 Qwen) once per turn so the kid still gets a reply.
    if (!params._fallbackTried && hasLlmFallback()) {
      try {
        const fb = await streamLlmFallback({
          text: params.text,
          signal: params.signal,
          handlers: params.handlers,
        });
        const finalText = preferCompleteTutorText(fb.fullText, fb.fullText);
        if (!finalText.trim()) {
          throw new Error("fallback returned empty text");
        }
        params.handlers.onStatus?.(`Backup ${fb.provider} replied`);
        return {
          agentId: agent.agentId,
          fullText: finalText,
          fallback: true,
        };
      } catch (fbErr) {
        // Fallback also failed — surface the original error below.
        console.error(
          `[Spark] LLM fallback failed (${err instanceof Error ? err.message : String(err)}):`,
          fbErr instanceof Error ? fbErr.message : String(fbErr),
        );
      }
    }

    if (err instanceof CursorAgentError) {
      clearAgentId(params.sessionId);
      throw new Error(
        `Cursor Agent failed to start: ${err.message}${err.isRetryable ? " (retryable)" : ""}`,
      );
    }
    throw err;
  } finally {
    params.signal?.removeEventListener("abort", onAbort);
    closeAgent();
  }
}

export async function listAvailableModels() {
  const apiKey = requireApiKey();
  return Cursor.models.list({ apiKey });
}

export function hasCursorApiKey(): boolean {
  return Boolean(
    process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim(),
  );
}
