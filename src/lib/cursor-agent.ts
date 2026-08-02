import path from "node:path";
import { Agent, Cursor, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "./default-api-key";
import {
  clearAgentId,
  getAgentId,
  setAgentId,
} from "./session-store";

const TUTOR_CWD = path.join(process.cwd(), "tutor-workspace");

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
        },
      });
    } catch {
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
}): Promise<{ agentId: string; fullText: string }> {
  if (params.signal?.aborted) {
    throw new Error("Request cancelled");
  }

  const agent = await getOrCreateAgent(params.sessionId, params.reset);
  let fullText = "";
  let emittedViaDelta = false;

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

    const run = await agent.send(message, {
      onDelta: ({ update }) => {
        if (params.signal?.aborted) return;
        if (update.type === "text-delta" && update.text) {
          emittedViaDelta = true;
          fullText += update.text;
          params.handlers.onText(update.text);
        }
      },
    });

    for await (const event of run.stream()) {
      if (params.signal?.aborted) {
        throw new Error("Request cancelled");
      }
      // Always try to surface progressive assistant text (covers SDKs that
      // batch deltas or only emit full assistant snapshots).
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
      } else if (event.type === "status" && event.message) {
        params.handlers.onStatus?.(event.message);
      }
    }

    if (params.signal?.aborted) {
      throw new Error("Request cancelled");
    }

    const result = await run.wait();
    if (result.status === "error") {
      throw new Error(`Tutor run failed (${result.id}). Try again or start a new chat.`);
    }

    if (!fullText.trim()) {
      fullText =
        "I couldn't generate a reply. Try again, or start a new chat.";
      params.handlers.onText(fullText);
    }

    return { agentId: agent.agentId, fullText };
  } catch (err) {
    if (params.signal?.aborted) {
      throw new Error("Request cancelled");
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
