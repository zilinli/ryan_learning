import path from "node:path";
import { Agent } from "@cursor/sdk";
import type { SDKAgent, SDKMessage } from "@cursor/sdk";
import { buildSystemPrompt, getOSInfo, DEFAULT_WORKSPACE } from "./prompts";

const API_KEY = process.env.CURSOR_API_KEY?.trim() || "";

function getApiKey(): string {
  if (!API_KEY) {
    throw new Error("CURSOR_API_KEY is not set. Please configure it first.");
  }
  return API_KEY;
}

export interface AgentStreamEvent {
  type: "status" | "delta" | "tool_call" | "error" | "done";
  content?: string;
  message?: string;
  tool?: string;
  input?: unknown;
  output?: string;
  code?: string;
  sessionId?: string;
}

const ACC_WORKSPACE = "/root/codes/ryan_learning";

async function createLocalAgent(): Promise<SDKAgent> {
  return Agent.create({
    apiKey: getApiKey(),
    model: { id: "auto" },
    name: "Agent Chat Console",
    local: {
      cwd: ACC_WORKSPACE,
      settingSources: [],
      enableAgentRetries: false,
    },
  });
}

export async function* streamAgentResponse(
  userMessage: string,
  sessionId: string | undefined,
  workspacePath: string = DEFAULT_WORKSPACE
): AsyncGenerator<AgentStreamEvent> {
  let agent: SDKAgent;

  yield { type: "status", message: "正在创建 Agent..." };

  try {
    if (sessionId) {
      try {
        agent = await Agent.resume(sessionId, {
          apiKey: getApiKey(),
          model: { id: "auto" },
          local: {
            cwd: ACC_WORKSPACE,
            settingSources: [],
            enableAgentRetries: false,
          },
        });
      } catch {
        // Resume failed, create new
        agent = await createLocalAgent();
      }
    } else {
      agent = await createLocalAgent();
    }
  } catch (err) {
    yield {
      type: "error",
      code: "AGENT_CREATE_FAILED",
      message: `无法创建 Agent: ${err instanceof Error ? err.message : String(err)}`,
    };
    return;
  }

  yield { type: "status", message: "正在执行..." };

  try {
    // Include system prompt context in the message
    const sysPrompt = buildSystemPrompt({
      workspacePath,
      osInfo: getOSInfo(),
      userMessage,
    });

    // For the first message with a new agent, include context
    const fullMessage = !sessionId
      ? `${sysPrompt}\n\n---\n\n**User request**: ${userMessage}`
      : userMessage;

    const run = await agent.send(fullMessage, {
      onDelta: ({ update }) => {
        if (update.type === "text-delta" && update.text) {
          // We'll capture these through stream() instead for consistency
        }
      },
    });

    let capturedAgentId = agent.agentId;
    sessionId = capturedAgentId;

    for await (const event of run.stream()) {
      const msg = event as SDKMessage;
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text) {
            yield { type: "delta", content: block.text };
          }
        }
      } else if (msg.type === "tool_call") {
        const toolName = msg.name?.replace(/^.*\//, "") || "unknown";
        if (msg.status === "running") {
          yield {
            type: "status",
            message: `执行: ${toolName}`,
          };
        } else if (msg.status === "completed" || msg.status === "error") {
          yield {
            type: "tool_call",
            tool: toolName,
            input: msg.input,
            output: msg.result,
          };
        }
      } else if (msg.type === "thinking") {
        yield { type: "status", message: "思考中..." };
      }
    }

    // Wait for final result to ensure completion
    const result = await run.wait();
    if (result.status === "error") {
      yield {
        type: "error",
        code: "RUN_FAILED",
        message: "Agent 执行失败. 请重试.",
      };
    }

    yield { type: "done", sessionId: capturedAgentId };
  } catch (err) {
    yield {
      type: "error",
      code: "STREAM_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
    yield { type: "done" };
  } finally {
    try {
      agent.close();
    } catch {
      // ignore
    }
  }
}
