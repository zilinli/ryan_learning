#!/usr/bin/env node
/**
 * Bolt Console 的 Cursor SDK 侧车。
 * 用法：echo '{"message":"...","cwd":"/abs/path"}' | node cursor-agent.mjs
 * 输出：单行 JSON { status: "done"|"error", text, error?, agentId? }
 *
 * 对齐 ryan_learning 的接入方式（agent-chat/src/lib/agent.ts）：
 *   Agent.create(local) → agent.send → run.stream() → run.wait() → agent.close()
 * 关键点：区分「启动失败」(CursorAgentError) 与「运行失败」(result.status==="error")。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";

const SESSION_ID = "019ce7";
const INGEST = "http://127.0.0.1:7709/ingest/5d548bb7-9b56-4d68-a9a7-7a091881944b";

// region agent log
function dbg(message, hypothesisId, data = {}) {
  fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION_ID },
    body: JSON.stringify({ sessionId: SESSION_ID, location: "cursor-agent.mjs", message, hypothesisId, data, timestamp: Date.now() }),
  }).catch(() => {});
}
// endregion

// 流式事件输出（NDJSON，一行一个 JSON 对象）：server.py 逐行读取实时推送
function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function loadApiKey() {
  const fromEnv = process.env.CURSOR_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const envFile = path.join(os.homedir(), ".openclaw", ".env");
  try {
    const txt = fs.readFileSync(envFile, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*CURSOR_API_KEY\s*=\s*['"]?([^'"#\s]+)/);
      if (m && m[1]) return m[1];
    }
  } catch {
    /* ignore */
  }
  return "";
}

function readInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
}

async function main() {
  const input = readInput();
  if (!input || !input.message) {
    console.log(JSON.stringify({ status: "error", error: "empty message" }));
    return 1;
  }
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ status: "error", error: "CURSOR_API_KEY 未配置（~/.openclaw/.env）" }));
    return 1;
  }
  const cwd = input.cwd || path.join(os.homedir(), "tasks");
  const model = { id: process.env.CURSOR_MODEL?.trim() || "auto" };
  const sessionId = (input.sessionId || "").trim();

  // region agent log
  dbg("cursor agent start", "C", { cwd, model: model.id, resume: !!sessionId, sessionId: sessionId || null });
  // endregion

  let agent;
  try {
    const base = {
      apiKey,
      model,
      name: "Bolt Console",
      local: {
        cwd,
        settingSources: [],
        enableAgentRetries: false,
      },
    };
    if (sessionId) {
      // 续接已有会话：Agent.resume(agentId) 恢复上下文
      try {
        agent = await Agent.resume(sessionId, base);
        emit({ type: "status", message: "已恢复会话，继续…" });
      } catch (err) {
        dbg("cursor agent resume failed, fallback create", "C", { error: err instanceof Error ? err.message : String(err) });
        emit({ type: "status", message: "会话恢复失败，新建会话" });
        agent = await Agent.create(base);
      }
    } else {
      agent = await Agent.create(base);
    }
  } catch (err) {
    // region agent log
    dbg("cursor agent create failed", "C", { error: err instanceof Error ? err.message : String(err) });
    // endregion
    console.log(JSON.stringify({ status: "error", error: `Agent 创建失败: ${err instanceof Error ? err.message : String(err)}` }));
    return 1;
  }

  let fullText = "";
  let agentId = agent.agentId || "";
  let runId = "";

  // 尽早回传 agentId，便于 server 在首轮就持久化（用于续会话，避免时序竞争）
  emit({ type: "agent", agentId });

  try {
    emit({ type: "status", message: "正在执行…" });
    const run = await agent.send(input.message, {
      onDelta: ({ update }) => {
        // 真正的增量文本：立即透传给 server 实时显示
        if (update && update.type === "text-delta" && update.text) {
          emit({ type: "delta", text: update.text });
        }
      },
    });
    runId = run.id || "";
    // region agent log
    dbg("cursor run started", "C", { agentId, runId });
    // endregion

    for await (const event of run.stream()) {
      if (event.type === "thinking") {
        const t = (event.text || "").trim();
        if (t) {
          emit({ type: "thinking", text: t });
        } else {
          emit({ type: "status", message: "思考中…" });
        }
      } else if (event.type === "tool_call") {
        const name = (event.name || "").replace(/^.*\//, "") || "unknown";
        if (event.status === "running") {
          emit({ type: "tool", tool: name, phase: "running" });
        } else if (event.status === "completed" || event.status === "error") {
          emit({
            type: "tool",
            tool: name,
            phase: event.status === "completed" ? "completed" : "error",
            output: event.result === undefined ? "" : String(event.result),
          });
        }
      } else if (event.type === "assistant") {
        for (const block of event.message?.content || []) {
          // 累积文本作为最终兜底（真正的增量已通过 onDelta 发出）
          if (block.type === "text" && block.text && block.text.length > fullText.length) {
            fullText = block.text;
          }
        }
      }
    }

    const result = await run.wait();
    // region agent log
    dbg("cursor run finished", "C", { agentId, runId, status: result.status, textLen: fullText.length });
    // endregion

    if (result.status === "error") {
      emit({ type: "error", error: "Cursor agent 运行失败，请重试" });
      return 2;
    }

    // 优先用 run 的最终 result（更完整），否则用流式累积文本
    const finalText = (typeof result.result === "string" && result.result.trim())
      ? result.result
      : fullText;

    emit({ type: "done", text: finalText || "", agentId, runId });
    return 0;
  } catch (err) {
    // region agent log
    dbg("cursor run error", "C", { agentId, runId, error: err instanceof Error ? err.message : String(err) });
    // endregion
    if (err instanceof CursorAgentError) {
      emit({ type: "error", error: `Cursor 启动失败: ${err.message}${err.isRetryable ? " (可重试)" : ""}` });
      return 1;
    }
    emit({ type: "error", error: err instanceof Error ? err.message : String(err) });
    return 2;
  } finally {
    try {
      agent.close();
    } catch {
      /* ignore */
    }
  }
}

// 显式退出：Cursor SDK 在本地会持有子进程/句柄，即使 close() 后事件循环也不一定清空
main()
  .then((code) => process.exit(code ?? 0))
  .catch(() => process.exit(2));
