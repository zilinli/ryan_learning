# Spark Code Agent — Reliability & Robustness Design

> Version 1.0 · August 2026  
> Status: Design proposal for service stability fixes

---

## 1. Problem Statement

The Spark code agent service (`@cursor/sdk` agent + Next.js 16 server + Python STT server) exhibits recurring crash and availability issues:

| Symptom | Root Cause Category | Severity |
|---------|-------------------|----------|
| Port conflict on restart (EADDRINUSE) | No pre-flight process check in `start.sh` | 🔴 Critical |
| SDK `unhandledRejection` crashes host process | Cursor SDK < 1.0.19: idle-agent gRPC auth expiry | 🔴 Critical |
| `agent.send()` returns bare `status: "error"` after idle | Long-lived `Agent.resume()` handle stale credential cache | 🔴 Critical |
| STT server repeated crash-restart (EADDRINUSE loop) | No supervisor; no graceful shutdown | 🔴 Critical |
| STT `Task queue depth` warnings / OOM risk | Whisper + SenseVoice concurrent load on 4GB RAM | 🟡 High |
| File-based JSON corruption risk | No file locking on multi-route concurrent writes | 🟡 High |
| SSE stream silent drops behind proxy | No heartbeat; no `Last-Event-ID` recovery | 🟡 High |
| Agent Chat Console symlink race | `ln -sf` without health check | 🟡 High |

---

## 2. Design Principles (derived from literature survey)

### 2.1 Stochastic-Deterministic Boundary (SDB)

From "A Methodology for Selecting and Composing Runtime Architecture Patterns for Production LLM Agents" (arXiv 2605.20173):

> Treat the LLM as a *proposer* that emits intents to a deterministic *governor*. The SDB gatekeeps all LLM-to-action call sites. 71% of agent failure post-mortems localize to weaknesses at this boundary.

**Spark Application**: The `cursor-agent.ts` → `tutor-harness.ts` boundary already implements sandboxed tools (banned API detection, timeout, output limits). We extend this with:
- A **run validator** that inspects `run.wait()` results before the agent reply is surfaced
- A **credential refresh layer** that detects stale sessions and transparently re-resumes

### 2.2 Runtime-Structured Task Decomposition (RSTD)

From "Runtime-Structured Task Decomposition for Agentic Coding Systems" (arXiv 2605.15425):

> Partitioning decisions governed by executable control flow rather than static prompt text; retry only the failed subtask. Achieves up to 51.7% retry cost reduction over monolithic.

**Spark Application**: The chat flow already has clear atomics — prompt assembly → agent.stream → result.wait → text filter → diagram repair. We make each step independently retryable with backoff.

### 2.3 Agent-as-State-Machine (LogAct)

From "LogAct: Enabling Agentic Reliability via Shared Logs" (arXiv 2604.07988):

> Model the agent as a deconstructed state machine playing a shared, durable append-only log. Agentic actions are visible in the log before execution; can be stopped by pluggable voters.

**Spark Application**: We add an **agent run log** (JSONL) that records every `agentId`, `runId`, `status`, `durationMs` — enabling crash recovery replay and audit.

### 2.4 LangGraph Fault Tolerance Primitives

From LangGraph v1.2 (langchain.com/docs):

> Three composable mechanisms: RetryPolicy (auto-retry with backoff/jitter), TimeoutPolicy (wall-clock or idle cap), ErrorHandler (runs after retry exhaustion, atomic transition).

**Spark Application**: We implement equivalent primitives in the agent lifecycle:
- **RetryPolicy**: 3 retries with exponential backoff (1s, 2s, 4s) + jitter on `CursorAgentError.isRetryable`
- **TimeoutPolicy**: Hard 120s wall-clock on `run.wait()`; 30s idle timeout on SSE stream
- **ErrorHandler**: Three-tier escalation (retry same agent → fresh agent → graceful user error)

---

## 3. Root Cause Analysis & Fix Design

### 3.1 🔴 Port Conflict on Restart (`start.sh`)

**Current State**:
```bash
exec npm run start  # Fails if port 3000/3001/8765 in use
```

No check for existing processes before launching.

**Fix Design** — Graceful pre-flight:

```bash
preflight_kill_port() {
  local port=$1
  local label=$2
  local pid
  pid=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    echo "[Spark] Killing existing ${label} on port ${port} (PID ${pid})..."
    kill -TERM "$pid" 2>/dev/null || true
    sleep 2
    # Force kill if still alive
    kill -KILL "$pid" 2>/dev/null || true
  fi
}

preflight_kill_port 3000 "Spark Tutor"
preflight_kill_port 3001 "Agent Chat Console"
preflight_kill_port 8765 "STT Server"
```

### 3.2 🔴 Cursor SDK Version & Unhandled Rejection

**Current State**: The project uses `@cursor/sdk` with potential version < 1.0.19. Known bug:
- After ~30min idle, internal gRPC `ConnectError [unauthenticated]` crashes the host process
- Bypasses `run.wait()` → `try/catch` at application layer can't catch it

**Fix Design**:

1. **Pin to SDK >= 1.0.19** (where the `unhandledRejection` crash is fixed)
2. **Global safety net** (belt-and-suspenders):

```typescript
process.on('unhandledRejection', (reason) => {
  console.error('[Spark] unhandledRejection caught as safety net:', reason);
  // Log and continue — do NOT crash
});
```

3. **Implement `isRetryable()` from CursorAgentError** in all agent call sites.

From the [Cursor Forum](https://forum.cursor.com/t/cursor-sdk-1-0-18-unhandled-promise-rejection-on-session-auth-error-crashes-host-process/163620):
> "The fix shipped in @cursor/sdk 1.0.19. Upgrading should resolve the crash."

### 3.3 🔴 Long-lived Agent Stale Session (bare `status: "error"`)

**Current State** (`cursor-agent.ts:207-210`):
```typescript
const result = await run.wait();
if (result.status === "error") {
  throw new Error(`Tutor run failed (${result.id}). Try again or start a new chat.`);
}
```

When `result.status === "error"` with no `error` field (bare error from stale session), we throw a generic error. The agent handle is closed (line 103) but the session mapping may persist.

**Fix Design** — Detect and recover stale sessions:

```typescript
async function getOrCreateAgent(sessionId, reset) {
  // ... existing logic ...
  const existing = getAgentId(sessionId);
  if (existing) {
    try {
      const agent = await Agent.resume(existing, { ... });
      return agent;
    } catch (err) {
      clearAgentId(sessionId);
      // DON'T return — fall through to create fresh
    }
  }
  // Create fresh
}
```

And in `streamTutorReply`, add **one retry on stale-session bare error**:

```typescript
const result = await run.wait();
if (result.status === "error" && !result.error) {
  // Likely stale session — dispose + retry once with fresh agent
  clearAgentId(params.sessionId);
  closeAgent();
  // Recurse once (with guard)
  if (!retried) {
    return streamTutorReply({ ...params, retried: true });
  }
  throw new Error(`Tutor run failed (${result.id}). Try starting a new chat.`);
}
```

From the [Cursor Forum](https://forum.cursor.com/t/cursor-sdk-1-0-22-local-agent-returns-bare-status-error-after-idle-process-restart-fixes-it-not-quota/164866):
> "Treat the bare wait() result {id, status: 'error', model, durationMs} combined with unhandledRejection's ConnectError as an auth failure; trigger a dispose handle + Agent.resume retry once before propagating."

### 3.4 🔴 STT Server Crash Loop

**Current State** (`scripts/stt_server.py` + `logs/stt.log`):
- Run directly as `python3 stt_server.py` (process tree is whoever started it)
- No restart backoff: 6 consecutive EADDRINUSE failures without delay
- Task queue depth warnings → potential OOM on 4GB RAM
- `waitress` with only 2 threads; `_infer_lock` serializes all Whisper/SenseVoice

**Fix Design**:

1. **systemd unit** for production process supervision with restart backoff:
```ini
[Unit]
Description=Spark STT Server (Whisper + SenseVoice + TTS)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/codes/ryan_learning
Environment="STT_PORT=8765"
Environment="STT_MODEL=small"
ExecStart=/usr/bin/python3 scripts/stt_server.py
Restart=on-failure
RestartSec=5
# Exponential backoff: 5s → 10s → 20s → 40s → 80s → cap at 120s
StartLimitInterval=300
StartLimitBurst=6
RestartPreventExitStatus=SIGKILL
MemoryMax=2G

[Install]
WantedBy=multi-user.target
```

2. **Graceful shutdown** on SIGTERM:
```python
import signal

def shutdown_handler(signum, frame):
    print("[stt] Received SIGTERM, shutting down gracefully...", flush=True)
    # Give waitress time to drain connections
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown_handler)
signal.signal(signal.SIGINT, shutdown_handler)
```

3. **Pre-flight port check** (in `start.sh` or the Python entry):
```python
import socket
def check_port(host, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((host, port))
    sock.close()
    return result != 0  # True if available
```

4. **Model load concurrency fix**: Load Whisper FIRST, then SenseVoice (sequential, not parallel). Current code does this (line 65-71 + 109-149 are sequential), but the log shows multiple processes loading simultaneously — likely because multiple `stt_server.py` instances are being started.

From "Deploy Whisper on a Dedicated GPU Server" (gigagpu.com, 2026):
> "Use systemd with `Restart=on-failure` and `RestartSec=5` for production reliability. Set `MemoryMax` to prevent OOM."
> "faster-whisper with CTranslate2 is 4x faster and uses half the VRAM."

### 3.5 🟡 File-based Persistence Race Conditions

**Current State** (`history-store.ts`, `learning-memory-store.ts`):
- `upsertServerConversation` → `fs.writeFile` — no locking
- `readServerLearningMemory` → `upsertServerLearningMemory` — read-modify-write without lock
- Concurrent PUT requests can interleave and corrupt JSON

**Fix Design** — Atomic write + in-process queue:

Adapt the pattern from [kilocode-1/safeWriteJson.ts](https://github.com/bernie43/kilocode-1) and the `atomically` npm package:

```typescript
import { promises as fs } from "node:fs";
import path from "node:path";

// In-process per-file lock queue
const writeQueues = new Map<string, Promise<void>>();

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = filePath + ".tmp." + Date.now();
  const json = JSON.stringify(data, null, 2);

  // 1. Write to temp file
  await fs.writeFile(tmpPath, json, "utf8");

  // 2. Atomic rename (POSIX: readers never see partial write)
  await fs.rename(tmpPath, filePath);
}

async function lockedWrite(filePath: string, data: unknown): Promise<void> {
  // Wait for any prior write to the same path to complete
  const prev = writeQueues.get(filePath) ?? Promise.resolve();
  const next = prev.then(() => atomicWriteJson(filePath, data)).catch(() => {});
  writeQueues.set(filePath, next);
  await next;
}
```

Apply to:
- `upsertServerConversation` / `upsertServerConversations`
- `upsertServerLearningMemory` (in `learning-memory-store.ts`)
- `enforceServerRetention`

### 3.6 🟡 SSE Stream Reliability

**Current State** (`chat/route.ts`):
- No heartbeat during long LLM thinking pauses
- No `id:` field on SSE events → browser can't send `Last-Event-ID` on reconnect
- No `X-Accel-Buffering: no` check (already set ✓) but missing heartbeat

**Fix Design**:

1. **Heartbeat interval** (every 15s during streaming):
```typescript
const heartbeatInterval = setInterval(() => {
  if (closed || req.signal.aborted) return;
  try {
    controller.enqueue(encoder.encode(":heartbeat\n\n"));
  } catch {
    // connection lost
  }
}, 15000);
```

2. **Event ID** for reconnect recovery:
```typescript
let eventId = 0;
const send = (event: string, data: unknown) => {
  eventId += 1;
  const payload = `id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(payload));
};
```

3. **Graceful shutdown signal**:
```typescript
const send = (event: string, data: unknown) => {
  // ...
};
// On server restart, send retry header to spread reconnects
send("shutdown", { retry: 5000 });
```

From "Server-Sent Events in Node.js: SSE Practical Guide" (nodewire.net):
> "Include an id: field in your events. On reconnect, the browser sends Last-Event-ID. Emit heartbeat comments every 15-20 seconds to prevent proxy idle timeouts."

From "Production AI Streaming with SSE and Node.js" (ezaiapi.com):
> "Node.js streams have built-in backpressure via write() return value. When it returns false, wait for drain."

### 3.7 🟡 Agent Chat Console Symlink Race

**Current State** (`start.sh:29`):
```bash
[[ -d ../node_modules ]] && [[ ! -e node_modules ]] && ln -sf ../node_modules node_modules
nohup npx next dev -H 0.0.0.0 -p "${ACC_PORT}" >../logs/agent-chat.log 2>&1 &
```

Race condition: if `ln -sf` fails silently, `next dev` starts but can't find dependencies.

**Fix Design** — Validate before launch:
```bash
if [[ -d "$ACC_DIR" ]]; then
  cd "$ACC_DIR"
  # Validate symlink
  if [[ ! -e node_modules/next ]]; then
    echo "[Spark] Fixing agent-chat node_modules..."
    rm -f node_modules
    ln -sf ../node_modules node_modules
    # Verify
    if [[ ! -e node_modules/next ]]; then
      echo "[Spark] ERROR: agent-chat node_modules setup failed" >&2
      cd ..
    else
      # Launch ACC ...
    fi
  fi
  cd ..
fi
```

---

## 4. Proposed Architecture: Resilient Agent Runtime

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (TutorShell.tsx)               │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐               │
│  │ Chat UI │  │Voice Rec │  │Photo Input│               │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘               │
│       └──────────┬──┴─────────────┘                     │
│                  │ SSE (retry:3000, hb:15s)              │
└──────────────────┼──────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────┐
│         Next.js 16 Server (process-managed)              │
│                  │                                       │
│  ┌───────────────▼──────────────────────────────────┐   │
│  │            Chat API Route (SSE + heartbeat)      │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │         Agent Lifecycle Manager           │    │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │    │   │
│  │  │  │ Retry   │  │ Timeout │  │ Error   │  │    │   │
│  │  │  │ Policy  │  │ Policy  │  │ Handler │  │    │   │
│  │  │  │ (3x+exp)│  │ (120s)  │  │ (3-tier)│  │    │   │
│  │  │  └─────────┘  └─────────┘  └─────────┘  │    │   │
│  │  └──────────────────────────────────────────┘    │   │
│  │  ┌──────────────┐  ┌────────────────────────┐   │   │
│  │  │ Cursor SDK   │  │   Tutor Harness        │   │   │
│  │  │ Agent.create │  │   (sandboxed tools)    │   │   │
│  │  │ .resume()    │  │   run_python/run_js    │   │   │
│  │  │ .send()      │  │   web_search/fetch     │   │   │
│  │  │ .stream()    │  │   draw_geometry        │   │   │
│  │  │ .wait()      │  └────────────────────────┘   │   │
│  │  └──────┬───────┘                               │   │
│  └─────────┼───────────────────────────────────────┘   │
│            │                                            │
│  ┌─────────▼─────────────┐  ┌──────────────────────┐   │
│  │    Agent Run Log      │  │  File Store (atomic) │   │
│  │  runs.jsonl           │  │  history-store.ts    │   │
│  │  {agentId,runId,      │  │  (lockedWrite)       │   │
│  │   status,durationMs}  │  │  learning-memory     │   │
│  └───────────────────────┘  │  (lockedWrite)       │   │
│                              └──────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────┐
│            External Services (systemd-managed)           │
│  ┌──────────────────────────┐  ┌───────────────────┐    │
│  │  STT/TTS Server (8765)   │  │  Cursor Cloud API │    │
│  │  whisper + SenseVoice    │  │  (external)       │    │
│  │  Restart=on-failure      │  │                   │    │
│  │  MemoryMax=2G            │  │                   │    │
│  └──────────────────────────┘  └───────────────────┘    │
│  ┌──────────────────────────┐                            │
│  │  Agent Chat Console(3001)│                            │
│  │  symlink-validated start │                            │
│  └──────────────────────────┘                            │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Phases

### Phase 1 — Critical Fixes (Immediate, ~6 hours)

| Task | File(s) | Effort |
|------|---------|--------|
| Pin `@cursor/sdk` >= 1.0.19 + add `unhandledRejection` safety net | `package.json`, `cursor-agent.ts` | 1h |
| Stale-session detection + one-retry on bare `status: "error"` | `cursor-agent.ts` | 2h |
| Pre-flight port check in `start.sh` | `start.sh` | 1h |
| systemd unit for STT server | `/etc/systemd/system/spark-stt.service` | 2h |

### Phase 2 — Resilience Improvements (~12 hours)

| Task | File(s) | Effort |
|------|---------|--------|
| Atomic file writes with in-process queuing | `history-store.ts`, `learning-memory-store.ts` | 4h |
| SSE heartbeat + event IDs | `chat/route.ts`, `agent-chat/src/app/api/chat/route.ts` | 3h |
| Agent run log (JSONL) | new `src/lib/run-log.ts` | 2h |
| Agent Chat Console launch validation | `start.sh` | 1h |
| Exponential-retry wrapper for SDK calls | `cursor-agent.ts` | 2h |

### Phase 3 — Observability & Recovery (~8 hours)

| Task | File(s) | Effort |
|------|---------|--------|
| Agent health metrics (agentId, runId, durationMs, status) | `cursor-agent.ts` | 2h |
| Crash recovery: replay last run from log | `run-log.ts` | 3h |
| Rate-limit / 429 handling with proper backoff | `cursor-agent.ts` | 1h |
| Memory usage monitoring + auto-session eviction | `session-store.ts` | 2h |

---

## 6. References

### Academic Papers

1. Corbett, A.T. & Anderson, J.R. (1995). "Knowledge tracing: Modeling the acquisition of procedural knowledge." *User Modeling and User-Adapted Interaction*, 4(4), 253–278. *(existing Spark reference)*

2. Gopi, A. et al. (2025). "A Methodology for Selecting and Composing Runtime Architecture Patterns for Production LLM Agents." arXiv:2605.20173. — Stochastic-Deterministic Boundary pattern; 71% of agent failures localize to SDB weaknesses.

3. Arbiter-K Team (2025). "From Craft to Kernel: A Governance-First Execution Architecture and Semantic ISA for Agentic Computers." arXiv:2604.18652. — Deterministic kernel encapsulates LLM; neuro-symbolic taint tracking for unsafe trajectory interception.

4. Arcus Team (2025). "Runtime-Structured Task Decomposition for Agentic Coding Systems." arXiv:2605.15425. — Selective subtask retry achieves 51.7% retry cost reduction over monolithic.

5. Six Sigma Agent Team (2025). "The Six Sigma Agent: Achieving Enterprise-Grade Reliability in LLM Systems Through Consensus-Driven Decomposed Execution." arXiv:2601.22290. — Micro-agent sampling for exponential reliability gains; 5 agents reduce error from 5% to 0.11%.

6. LogAct Team (2025). "LogAct: Enabling Agentic Reliability via Shared Logs." arXiv:2604.07988. — Agent as state machine over shared append-only log; provides failure atomicity and replay.

### Industry References

7. LangChain (2026). "Fault Tolerance in LangGraph: Retries, Timeouts and Error Handlers." [langchain.com/blog](https://www.langchain.com/blog/fault-tolerance-in-langgraph). — RetryPolicy, TimeoutPolicy, ErrorHandler primitives in LangGraph v1.2.

8. Cursor SDK Community (2025-2026). Forum posts on unhandledRejection crashes (v1.0.18→1.0.19 fix) and stale-session bare errors. [forum.cursor.com](https://forum.cursor.com).

9. "JSON File Update Operations in Node.js (2026): Practical, Safe Patterns." [thelinuxcode.com](https://thelinuxcode.com/json-file-update-operations-in-nodejs-2026-practical-safe-patterns-i-use-in-production/). — Atomic write-rename pattern for file-based storage.

10. "Server-Sent Events in Production." [letsbuildsolutions.com](https://letsbuildsolutions.com/blog/web-engineering/server-sent-events-in-production-real-time-dashboards-event-streaming-and-scaling-patterns-beyond-websockets/). — Heartbeat, event IDs, graceful shutdown for SSE.

11. "Production AI Streaming with SSE and Node.js." [ezaiapi.com](https://ezaiapi.com/blog/ai-streaming-sse-production-nodejs). — Backpressure handling, proxy buffering, SSE lifecycle.

12. "Deploy Whisper on a Dedicated GPU Server: Step-by-Step (2026)." [gigagpu.com](https://gigagpu.com/deploy-whisper-dedicated-server/). — systemd for Whisper, faster-whisper over reference implementation, MemoryMax for OOM prevention.

13. kilocode-1. `safeWriteJson.ts`. [github.com/bernie43/kilocode-1](https://github.com/bernie43/kilocode-1/blob/main/src/utils/safeWriteJson.ts). — Production-grade atomic JSON write with proper-lockfile.

14. `atomically` npm package. [npmjs.com/package/atomically](https://www.npmjs.com/package/atomically). — Atomic filesystem operations with queuing, retry, and tmp+rename safety.
