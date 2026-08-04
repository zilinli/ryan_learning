# Code Agent Robustness Subsystem — Detailed Design

> Subsystem document — part of [Spark Design Docs](../DESIGN.md)  
> Implements patterns from [code-agent-reliability-design.md](../code-agent-reliability-design.md)

---

## 1. Current State Analysis

### 1.1 Agent Lifecycle (as-is)

```
Browser Request
    │
    ▼
POST /api/chat
    │
    ├─ Validate input (sessionId, message, attachments)
    ├─ buildTutorPrompt()          ─────  ~50ms  (pure compute)
    ├─ streamTutorReply()
    │   ├─ getOrCreateAgent()      ─────  ~200-500ms  (SDK call)
    │   │   ├─ Agent.resume() if cached
    │   │   │   └─ Falls through on ANY error → Agent.create()
    │   │   └─ Agent.create()
    │   │
    │   ├─ agent.send(prompt, { onDelta })
    │   │       └─ Returns Run handle
    │   │
    │   ├─ for await (run.stream())
    │   │       └─ Emits assistant/tool_call/thinking/status events
    │   │
    │   ├─ run.wait()              ─────  ~5-120s  (LLM execution)
    │   │       └─ status: "completed" | "error" | "cancelled"
    │   │
    │   ├─ preferCompleteTutorText()
    │   ├─ ensureTutorDiagrams()
    │   └─ Return { agentId, fullText }
    │
    └─ SSE → Browser
```

### 1.2 Problem Points (annotated)

```typescript
// cursor-agent.ts:49-77
async function getOrCreateAgent(sessionId, reset) {
  // PROBLEM 1: Agent.resume() falls through on ALL errors
  //            including transient network issues that should be retried
  const existing = getAgentId(sessionId);
  if (existing) {
    try {
      return await Agent.resume(existing, { ... });
    } catch {
      clearAgentId(sessionId);  // PROBLEM 2: Immediately discards potentially recoverable state
    }
  }
  return await createTutorAgent();
}

// cursor-agent.ts:101-107
const closeAgent = () => {
  try { agent.close(); } catch { /* ignore */ }
};
// PROBLEM 3: agent.close() in finally block — fires EVERY time
//            even when agent should persist for next message

// cursor-agent.ts:207-210
const result = await run.wait();
if (result.status === "error") {
  // PROBLEM 4: No distinction between bare error (stale session) vs genuine error
  throw new Error(`Tutor run failed (${result.id}). Try again or start a new chat.`);
}
```

### 1.3 Known SDK Issues (from Cursor Forum)

| SDK Version | Issue | Impact on Spark |
|-------------|-------|-----------------|
| < 1.0.19 | `unhandledRejection` on idle-agent auth expiry | Host process crash, unrecoverable |
| < 1.0.23 | `agent.send()` returns bare `status: "error"` after ~15min idle | User sees "Tutor run failed", must restart chat |
| All versions | `Agent.resume()` internal credential cache expiry after hours | Stale handle → all subsequent runs fail |

---

## 2. Proposed Architecture

### 2.1 Agent Lifecycle (to-be)

```
Browser Request
    │
    ▼
POST /api/chat
    │
    ├─ Validate input
    ├─ buildTutorPrompt()
    │
    ├─ executeWithRetry({ maxRetries: 3, backoff: "exponential" })
    │   │
    │   ├─ Attempt 1: streamTutorReply()
    │   │   ├─ getOrCreateAgent(resumeIfExists=true)
    │   │   │   ├─ Agent.resume() — on CursorAgentError(isRetryable) → retry resume
    │   │   │   ├─ Agent.resume() — on non-retryable error → create fresh
    │   │   │   └─ Agent.create()
    │   │   │
    │   │   ├─ agent.send() → run.stream() → run.wait(120s timeout)
    │   │   │
    │   │   ├─ On bare status:"error" (no error field):
    │   │   │   ├─ Detect as stale session
    │   │   │   ├─ dispose handle + clearAgentId
    │   │   │   ├─ Retry ONCE with fresh Agent (not counted against maxRetries)
    │   │   │   └─ If still fails → escalate to ErrorHandler
    │   │   │
    │   │   └─ On completed:
    │   │       ├─ appendRunLog({ agentId, runId, status, durationMs })
    │   │       ├─ Keep agent alive (DON'T close) for next message
    │   │       └─ Return { agentId, fullText }
    │   │
    │   ├─ Attempt 2-N: Same logic, fresh agent if previous failed
    │   │
    │   └─ ErrorHandler (after all retries exhausted):
    │       ├─ Log full error context to run log
    │       ├─ Clear agent mapping
    │       └─ Throw user-friendly error (NOT raw stack trace)
    │
    └─ SSE → Browser
```

### 2.2 Key Code Changes

#### 2.2.1 Agent Retry Wrapper

```typescript
// new: src/lib/agent-retry.ts

interface RetryConfig {
  maxRetries: number;           // default: 3
  baseDelayMs: number;          // default: 1000
  maxDelayMs: number;           // default: 8000
  staleSessionRetryCount: number; // default: 1 (separate from main retries)
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  isRetryable: (error: unknown) => boolean,
): Promise<T> {
  let lastError: unknown;
  let staleRetries = 0;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // Stale session detection: special one-time retry
      if (isStaleSessionError(err) && staleRetries < config.staleSessionRetryCount) {
        staleRetries += 1;
        // The operation should have already cleared and re-created the agent
        continue;  // retry immediately (no backoff for stale session)
      }

      if (attempt >= config.maxRetries || !isRetryable(err)) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 200,
        config.maxDelayMs,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

function isStaleSessionError(err: unknown): boolean {
  // Bare status:error from run.wait() with no error field
  if (err instanceof Error && err.message.includes('bare error')) return true;
  // SDK ConnectError [unauthenticated]
  if (err instanceof CursorAgentError && err.protoErrorCode === 16) return true;
  return false;
}
```

#### 2.2.2 Session Store with TTL

```typescript
// updated: src/lib/session-store.ts

interface AgentEntry {
  agentId: string;
  createdAt: number;
  lastUsedAt: number;
}

const MAX_AGENTS = 40;
const AGENT_TTL_MS = 30 * 60 * 1000; // 30 minutes — before SDK auth expiry

const sessionToAgent = new Map<string, AgentEntry>();

function touch(sessionId: string, agentId: string): void {
  const now = Date.now();
  sessionToAgent.delete(sessionId);
  sessionToAgent.set(sessionId, { agentId, createdAt: now, lastUsedAt: now });

  // LRU eviction
  while (sessionToAgent.size > MAX_AGENTS) {
    const oldest = sessionToAgent.keys().next().value;
    if (oldest === undefined) break;
    sessionToAgent.delete(oldest);
  }

  // TTL eviction (stale agents)
  for (const [sid, entry] of sessionToAgent) {
    if (now - entry.lastUsedAt > AGENT_TTL_MS) {
      sessionToAgent.delete(sid);
    }
  }
}

export function getAgentId(sessionId: string): string | undefined {
  const entry = sessionToAgent.get(sessionId);
  if (!entry) return undefined;

  // Check TTL before returning
  if (Date.now() - entry.lastUsedAt > AGENT_TTL_MS) {
    sessionToAgent.delete(sessionId);
    return undefined;
  }

  entry.lastUsedAt = Date.now();
  return entry.agentId;
}
```

#### 2.2.3 Agent Run Log

```typescript
// new: src/lib/run-log.ts

import { promises as fs } from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "agent-runs.jsonl");

interface RunLogEntry {
  timestamp: string;       // ISO 8601
  sessionId: string;
  agentId: string;
  runId: string;
  status: "completed" | "error" | "cancelled" | "timeout";
  durationMs: number;
  model?: string;
  errorMessage?: string;   // only on error
  retryCount?: number;     // how many retries were attempted
}

const MAX_LOG_SIZE = 10000; // keep last 10k runs

export async function appendRunLog(entry: RunLogEntry): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  await fs.appendFile(LOG_FILE, line, "utf8");
}

export async function getLastRun(agentId: string): Promise<RunLogEntry | null> {
  try {
    const content = await fs.readFile(LOG_FILE, "utf8");
    const lines = content.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as RunLogEntry;
        if (entry.agentId === agentId) return entry;
      } catch { continue; }
    }
  } catch { /* file doesn't exist yet */ }
  return null;
}

export async function getRecentRuns(
  limit: number = 50,
): Promise<RunLogEntry[]> {
  try {
    const content = await fs.readFile(LOG_FILE, "utf8");
    const lines = content.trim().split("\n");
    return lines.slice(-limit).map(l => JSON.parse(l) as RunLogEntry);
  } catch {
    return [];
  }
}

export async function getErrorRate(
  windowMinutes: number = 60,
): Promise<{ total: number; errors: number; rate: number }> {
  const runs = await getRecentRuns(500);
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const recent = runs.filter(r => new Date(r.timestamp).getTime() > cutoff);
  const errors = recent.filter(r => r.status === "error").length;
  return {
    total: recent.length,
    errors,
    rate: recent.length > 0 ? errors / recent.length : 0,
  };
}
```

#### 2.2.4 SSE Heartbeat & Event IDs

```typescript
// updated: src/app/api/chat/route.ts (SSE stream section)

const encoder = new TextEncoder();
let eventId = 0;

const stream = new ReadableStream({
  async start(controller) {
    let closed = false;
    let lastActivity = Date.now();

    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeatTimer);
      try { controller.close(); } catch { /* already closed */ }
    };

    // Heartbeat: keep proxy connections alive during LLM thinking
    const heartbeatTimer = setInterval(() => {
      if (closed || req.signal.aborted) {
        clearInterval(heartbeatTimer);
        return;
      }
      // If no activity for 30s, send heartbeat
      if (Date.now() - lastActivity > 25_000) {
        try {
          controller.enqueue(encoder.encode(":hb\n\n"));
        } catch {
          clearInterval(heartbeatTimer);
        }
      }
    }, 15_000);

    const send = (event: string, data: unknown) => {
      if (closed || req.signal.aborted) return;
      eventId += 1;
      lastActivity = Date.now();
      try {
        const payload = `id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      } catch {
        closed = true;
        clearInterval(heartbeatTimer);
      }
    };

    // ... rest of streaming logic ...

    // Cleanup on request close
    req.signal.addEventListener("abort", () => {
      clearInterval(heartbeatTimer);
      close();
    });
  },
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "Content-Encoding": "identity",
    "Connection": "keep-alive",
    "Keep-Alive": "timeout=300",
  },
});
```

#### 2.2.5 Global Safety Net

```typescript
// new: src/app/layout.tsx or server entry point

// Catch unhandled rejections that bypass application try/catch
// (e.g., SDK internal gRPC errors in versions < 1.0.19)
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason, promise) => {
    console.error(
      '[Spark] Unhandled Rejection (safety net):',
      reason instanceof Error ? reason.message : String(reason),
      '\nThis should not crash the server. Check @cursor/sdk version.',
    );
    // Do NOT re-throw — that would crash the process
    // Do NOT exit — let the server continue
  });

  process.on('uncaughtException', (error) => {
    console.error(
      '[Spark] Uncaught Exception:',
      error.message,
      '\nStack:', error.stack,
    );
    // Log and continue for non-fatal errors
    // Only exit for truly unrecoverable states
    if (error.message.includes('EADDRINUSE')) {
      console.error('[Spark] Port conflict — server already running?');
      process.exit(1);
    }
    // For other errors, attempt to continue (belt and suspenders)
  });
}
```

---

## 3. Error Classification & Recovery Matrix

| Error Type | Detection | retryable? | Recovery Strategy | Retry Count | Backoff |
|-----------|-----------|-----------|-------------------|------------|---------|
| `CursorAgentError.isRetryable=true` | Caught in `executeWithRetry` | ✅ Yes | Retry with fresh agent | 3 | Exp: 1s→2s→4s |
| Stale session (`run.wait()` bare error) | No `error` field in result | ✅ Yes (once) | Dispose + re-resume, retry once | 1 (separate) | Immediate |
| Rate limit (429 / proto error 8) | `CursorAgentError.protoErrorCode=8` | ✅ Yes | Back off 30s minimum | 3 | 30s→60s→120s |
| Invalid API key (proto error 16) | `CursorAgentError.protoErrorCode=16` | ❌ No | Return 503 to user | 0 | N/A |
| Run timeout (120s wall clock) | `Promise.race([run.wait(), timeout])` | ✅ Yes (once) | Retry with fresh agent | 1 | 2s |
| SSE idle timeout (30s no events) | Last-activity timer | ✅ Yes | Close stream, browser reconnects | ∞ (via EventSource) | 3s |
| Agent.create() fails | Exception in `createTutorAgent()` | ✅ Yes | Retry | 2 | 1s→2s |
| Agent.resume() fails | Exception in `Agent.resume()` | Depends on error type | If retryable → retry resume; else → create new | 1 | Immediate |

---

## 4. File Locking Implementation

```typescript
// new: src/lib/file-lock.ts

import { promises as fs } from "node:fs";
import path from "node:path";

/** In-process per-file write queue (no cross-process locking needed for single server). */
const pendingWrites = new Map<string, Promise<void>>();

/**
 * Atomically write JSON to a file:
 * 1. Serialize to temp file
 * 2. Rename (atomic on POSIX)
 * 3. Readers never see partial content
 */
async function atomicWrite(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  const json = JSON.stringify(data, null, 2);

  try {
    await fs.writeFile(tmpPath, json, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Attempt cleanup of tmp file
    try { await fs.unlink(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Sequenced write: ensures concurrent writes to the same file are serialized.
 * Last writer wins (no merge). Prevents interleaved partial writes.
 */
export async function lockedWriteJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  const prev = pendingWrites.get(filePath) ?? Promise.resolve();

  const next = prev
    .then(() => atomicWrite(filePath, data))
    .catch((err) => {
      console.error(`[Spark] Failed to write ${filePath}:`, err);
      throw err;
    })
    .finally(() => {
      // Clean up from queue when done
      if (pendingWrites.get(filePath) === next) {
        pendingWrites.delete(filePath);
      }
    });

  pendingWrites.set(filePath, next);
  await next;
}
```

Apply in `history-store.ts`:

```typescript
import { lockedWriteJson } from "./file-lock";

export async function upsertServerConversation(
  record: ConversationRecord,
): Promise<ConversationRecord | null> {
  const id = safeId(record.sessionId);
  if (!id || !record.messages?.length) return null;
  await ensureDir();
  const clean = await prepareConversationForServer({ ...record, sessionId: id });
  await lockedWriteJson(filePath(id), clean);  // ← atomic + queued
  await enforceServerRetention();
  return clean;
}
```

---

## 5. STT Service Robustness

For detailed STT design, see [STT Service Reliability](./stt-service-reliability.md).

### 5.1 Summary of Changes

| Change | Rationale |
|--------|-----------|
| systemd unit for STT server | Process supervision, auto-restart with backoff |
| `Restart=on-failure` + `RestartSec=5` | Prevents crash-restart-loop with 0-delay |
| `MemoryMax=2G` | Prevents OOM on 4GB boxes |
| `StartLimitBurst=6` over 300s | Caps restarts to 6 per 5 minutes |
| Graceful SIGTERM handler | Allows waitress to drain connections before exit |
| Pre-flight port check in Python | Detect EADDRINUSE before trying to bind |
| Sequential model loading (whisper → sensevoice) | Already implemented; ensure only ONE process loads |

---

## 6. Agent Chat Console Symlink Safety

```bash
# updated: start.sh (Agent Chat Console section)

if [[ -d "$ACC_DIR" ]]; then
  echo "[Spark] Setting up Agent Chat Console..."
  cd "$ACC_DIR"

  # Validate node_modules symlink
  if [[ ! -e node_modules/next ]]; then
    echo "[Spark] Fixing agent-chat node_modules symlink..."
    rm -f node_modules
    if [[ -d ../node_modules ]]; then
      ln -sf ../node_modules node_modules
    fi
  fi

  # Verification
  if [[ ! -e node_modules/next ]]; then
    echo "[Spark] ❌ Agent Chat Console dependencies missing — skipping ACC" >&2
    cd ..
  else
    mkdir -p logs data/conversations
    nohup npx next dev -H 0.0.0.0 -p "${ACC_PORT}" >../logs/agent-chat.log 2>&1 &
    ACC_PID=$!
    echo "[Spark] Agent Chat Console PID: ${ACC_PID} → http://0.0.0.0:${ACC_PORT}"
    trap "kill ${ACC_PID} 2>/dev/null; echo '[Spark] Stopped Agent Chat Console'" EXIT
    cd ..
  fi
fi
```

---

## 7. References

- [Main Reliability Design](../code-agent-reliability-design.md)
- [Reliability Test Design](../code-agent-test-design.md)
- [Existing Testing Subsystem](./testing.md)
- [Cursor SDK v1.0.19 fix: unhandledRejection crash](https://forum.cursor.com/t/cursor-sdk-1-0-18-unhandled-promise-rejection-on-session-auth-error-crashes-host-process/163620)
- [Cursor SDK v1.0.22: stale session bare error](https://forum.cursor.com/t/cursor-sdk-1-0-22-local-agent-returns-bare-status-error-after-idle-process-restart-fixes-it-not-quota/164866)
- [Cursor SDK Agent State Persistence](https://startdebugging.net/2026/06/persist-cursor-sdk-agent-state-across-restarts-sqlite-vs-jsonl/)
