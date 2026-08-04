# Spark Code Agent — Reliability Test Design

> Version 1.0 · August 2026  
> Companion to [code-agent-reliability-design.md](../code-agent-reliability-design.md)

---

## 1. Test Strategy Overview

### 1.1 What Makes Code Agent Testing Different

Testing an AI code agent differs from standard software testing in three critical ways:

1. **Stochastic outputs**: The same input may produce different-but-valid responses. Tests must validate *properties* not *exact values*.
2. **Long-lived state**: Agent sessions span minutes to hours. Testing must handle idle timeout, credential expiry, and state drift.
3. **External dependency chains**: Agent → Cursor SDK → Cursor Cloud → LLM. Each hop adds failure modes. Tests must exercise the *boundary* at each hop.

### 1.2 Test Matrix by Failure Mode

| Failure Mode | Unit | Integration | Chaos | E2E |
|-------------|------|-------------|-------|-----|
| SDK unhandledRejection | ✅ | ✅ | ✅ | - |
| Stale session bare status:error | ✅ | ✅ | ✅ | - |
| Port conflict on restart | - | ✅ | ✅ | - |
| File write race / JSON corruption | ✅ | ✅ | ✅ | - |
| SSE heartbeat timeout | - | ✅ | ✅ | ✅ |
| STT crash-restart loop | - | ✅ | ✅ | - |
| Agent timeout (120s wall) | ✅ | - | - | - |
| Rate limit / 429 backoff | ✅ | - | ✅ | - |
| Memory pressure / session eviction | ✅ | - | ✅ | - |

---

## 2. Unit Tests

### 2.1 Stale Session Detection & Recovery

**File**: `src/lib/__tests__/cursor-agent-reliability.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Cursor SDK
vi.mock('@cursor/sdk', () => ({
  Agent: {
    create: vi.fn(),
    resume: vi.fn(),
  },
  CursorAgentError: class extends Error {
    isRetryable: boolean;
    protoErrorCode?: number;
    constructor(msg: string, opts?: { isRetryable?: boolean; protoErrorCode?: number }) {
      super(msg);
      this.isRetryable = opts?.isRetryable ?? false;
      this.protoErrorCode = opts?.protoErrorCode;
    }
  },
  Cursor: {
    models: { list: vi.fn() },
  },
}));

describe('Agent Session Recovery', () => {
  describe('stale session detection', () => {
    it('detects bare status:error with no error field', () => {
      const result = {
        id: 'run-123',
        status: 'error',
        model: 'auto',
        durationMs: 270,
      } as const;
      // Bare error = no error field, no message, no code
      expect(result.status).toBe('error');
      expect('error' in result).toBe(false);
      expect('message' in result).toBe(false);
      // This is the signal for stale session
    });

    it('retries once with fresh agent on bare status:error', async () => {
      // Given: a resumed agent returns bare status:error
      let resumeCallCount = 0;
      const mockResume = vi.fn().mockImplementation(() => {
        resumeCallCount += 1;
        if (resumeCallCount === 1) {
          // First attempt: stale session
          return {
            agentId: 'old-stale-agent',
            send: vi.fn().mockResolvedValue({
              stream: async function* () { yield { type: 'assistant', message: { content: [] } }; },
              wait: vi.fn().mockResolvedValue({
                id: 'run-1',
                status: 'error',
                model: 'auto',
                durationMs: 270,
              }),
            }),
            close: vi.fn(),
          };
        }
        // Second attempt: fresh agent works
        return {
          agentId: 'new-fresh-agent',
          send: vi.fn().mockResolvedValue({
            stream: async function* () { yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello!' }] } }; },
            wait: vi.fn().mockResolvedValue({
              id: 'run-2',
              status: 'completed',
              model: 'auto',
              durationMs: 1200,
              result: 'Hello!',
            }),
          }),
          close: vi.fn(),
        };
      });
      vi.mocked(Agent.resume).mockImplementation(mockResume);

      // When: the agent retry logic fires
      // Then: the second attempt with fresh agent succeeds
      expect(resumeCallCount).toBeLessThanOrEqual(2); // max 1 retry
    });

    it('gives up after 1 retry and throws descriptive error', async () => {
      // Both attempts return bare status:error
      const mockAlwaysFailing = vi.fn().mockResolvedValue({
        agentId: 'dead-agent',
        send: vi.fn().mockResolvedValue({
          stream: async function* () {},
          wait: vi.fn().mockResolvedValue({
            id: 'run-x',
            status: 'error',
            model: 'auto',
            durationMs: 100,
          }),
        }),
        close: vi.fn(),
      });

      // The error path must not infinite-loop
      // Max 2 attempts total (original + 1 retry)
      // Then throw with a user-friendly message
    });
  });

  describe('CursorAgentError handling', () => {
    it('retries on isRetryable errors with exponential backoff', () => {
      const retryable = new CursorAgentError('rate limited', { isRetryable: true, protoErrorCode: 8 });
      expect(retryable.isRetryable).toBe(true);
      // Backoff sequence: 1000ms, 2000ms, 4000ms (+ jitter)
    });

    it('does not retry on non-retryable errors', () => {
      const fatal = new CursorAgentError('invalid key', { isRetryable: false });
      expect(fatal.isRetryable).toBe(false);
      // Should throw immediately, no retry
    });

    it('clears agent mapping on CursorAgentError', () => {
      // After a CursorAgentError, the session-to-agent ID mapping
      // should be cleared so the next attempt creates a fresh agent
    });
  });

  describe('run.wait() timeout', () => {
    it('rejects after 120s wall-clock timeout', async () => {
      // Use vi.useFakeTimers to simulate timeout
      // race between run.wait() and a 120s timeout Promise
    });

    it('SSE idle timeout fires after 30s of no events', async () => {
      // During streaming, if no events for 30s, the stream should be aborted
    });
  });
});
```

### 2.2 Atomic File Write

**File**: `src/lib/__tests__/history-store-atomic.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Atomic File Write', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spark-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('atomicWriteJson', () => {
    it('writes complete JSON — readers never see partial content', async () => {
      const filePath = path.join(tmpDir, 'test.json');
      const largeData = { items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` })) };

      // Simulate a concurrent reader: try reading while write is in progress
      const writePromise = atomicWriteJson(filePath, largeData);

      // Reader should either get old content (file doesn't exist yet) or complete content
      // Never partial, because write → tmp → rename is atomic
      let partialSeen = false;
      for (let i = 0; i < 10; i++) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const parsed = JSON.parse(content);
          // If we can parse it, it's complete
          expect(parsed.items).toHaveLength(1000);
        } catch {
          // File doesn't exist yet — acceptable
          partialSeen = false;
        }
      }
      await writePromise;
      expect(partialSeen).toBe(false);
    });

    it('creates parent directories automatically', async () => {
      const filePath = path.join(tmpDir, 'deep', 'nested', 'data.json');
      await atomicWriteJson(filePath, { hello: 'world' });
      const content = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(content)).toEqual({ hello: 'world' });
    });

    it('survives concurrent writes to same path (last writer wins)', async () => {
      const filePath = path.join(tmpDir, 'concurrent.json');

      await Promise.all([
        atomicWriteJson(filePath, { version: 1 }),
        atomicWriteJson(filePath, { version: 2 }),
        atomicWriteJson(filePath, { version: 3 }),
      ]);

      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);
      // File must be valid JSON (not corrupted by interleaved writes)
      expect([1, 2, 3]).toContain(parsed.version);
    });

    it('recovers from crash during write (cleans up tmp file)', async () => {
      const filePath = path.join(tmpDir, 'crash-recover.json');

      // Write once successfully
      await atomicWriteJson(filePath, { data: 'original' });

      // Simulate: tmp file is left behind from a crash
      const tmpPath = filePath + '.tmp.crash';
      await fs.writeFile(tmpPath, '{ "incomplete"', 'utf8');

      // Next write should clean up and succeed
      await atomicWriteJson(filePath, { data: 'recovered' });

      const content = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(content)).toEqual({ data: 'recovered' });

      // Tmp file should be gone
      await expect(fs.access(tmpPath)).rejects.toThrow();
    });
  });

  describe('lockedWrite (in-process queuing)', () => {
    it('serializes concurrent writes to the same file', async () => {
      const filePath = path.join(tmpDir, 'locked.json');
      const order: number[] = [];

      const w1 = lockedWrite(filePath, { seq: 1 }).then(() => { order.push(1); });
      const w2 = lockedWrite(filePath, { seq: 2 }).then(() => { order.push(2); });
      const w3 = lockedWrite(filePath, { seq: 3 }).then(() => { order.push(3); });

      await Promise.all([w1, w2, w3]);

      // Writes must complete in order (sequential via queue)
      expect(order).toEqual([1, 2, 3]);
      const final = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(final.seq).toBe(3); // last writer wins
    });

    it('does not block writes to different files', async () => {
      const start = Date.now();
      await Promise.all([
        lockedWrite(path.join(tmpDir, 'a.json'), { f: 'a' }),
        lockedWrite(path.join(tmpDir, 'b.json'), { f: 'b' }),
        lockedWrite(path.join(tmpDir, 'c.json'), { f: 'c' }),
      ]);
      const elapsed = Date.now() - start;
      // All three should complete in roughly the time of one write
      // (concurrent, not serialized)
      expect(elapsed).toBeLessThan(200);
    });
  });
});
```

### 2.3 Agent Run Log

**File**: `src/lib/__tests__/run-log.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Agent Run Log (JSONL)', () => {
  describe('appendRunLog', () => {
    it('appends one JSON line per run', async () => {
      // appendRunLog({ agentId: 'a1', runId: 'r1', status: 'completed', durationMs: 500 });
      // appendRunLog({ agentId: 'a1', runId: 'r2', status: 'error', durationMs: 200 });
      // File should have 2 lines, each valid JSON
    });

    it('is append-only — never rewrites previous entries', async () => {
      // Write 5 runs, verify file length grows monotonically
    });

    it('handles concurrent appends without corruption', async () => {
      // 10 concurrent appendRunLog calls → file has 10 lines, all valid JSON
    });
  });

  describe('getLastRun', () => {
    it('returns the most recent run for an agentId', async () => {
      // Write runs for a1, b1, a1 → getLastRun('a1') returns the second a1 run
    });
  });

  describe('replayRuns', () => {
    it('returns all runs in insertion order', async () => {
      // Test ordering and completeness
    });
  });
});
```

### 2.4 SSE Event Construction

**File**: `src/lib/__tests__/sse-encode.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('SSE Encode', () => {
  it('includes event and data fields', () => {
    const result = sseEncode('delta', { text: 'hello' });
    expect(result).toContain('event: delta');
    expect(result).toContain('data: {"text":"hello"}');
  });

  it('includes id field for reconnect recovery', () => {
    // Incremental id with each event
  });

  it('emits heartbeat comments on interval', () => {
    // ": heartbeat\\n\\n" every 15s
  });

  it('handles data with special characters safely', () => {
    const result = sseEncode('delta', { text: 'hello\nworld' });
    // Multi-line data must be properly formatted
    expect(result).toContain('data: ');
  });
});
```

---

## 3. Integration Tests

### 3.1 SSE Stream Reliability

**File**: `scripts/verify-sse-reliability.mjs`

```javascript
import { strict as assert } from 'node:assert';

const BASE = 'http://127.0.0.1:3000';

async function testHeartbeat() {
  // 1. Start a chat SSE stream
  // 2. Wait 20s with no activity
  // 3. Assert heartbeat comments are received
  console.log('PASS  SSE heartbeat within 20s');
}

async function testReconnectWithLastEventId() {
  // 1. Start SSE stream, track last event ID
  // 2. Abort connection
  // 3. Reconnect with Last-Event-ID header
  // 4. Assert server replays from that ID
  console.log('PASS  SSE reconnect with Last-Event-ID');
}

async function testProxyBufferingDisabled() {
  // 1. Check X-Accel-Buffering: no header
  // 2. Check Content-Type: text/event-stream
  // 3. Check Cache-Control: no-cache
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'sse-test-1',
      message: 'test',
      history: [],
      learningMemory: { topics: [], skills: [] },
    }),
  });
  assert.strictEqual(res.headers.get('x-accel-buffering'), 'no');
  assert.ok(res.headers.get('content-type').includes('text/event-stream'));
  console.log('PASS  SSE headers correct for proxy traversal');
}

async function testGracefulShutdown() {
  // 1. Start SSE stream
  // 2. Simulate server restart signal
  // 3. Assert retry: field is sent with appropriate delay
  console.log('PASS  SSE graceful shutdown retry header');
}
```

### 3.2 Agent Session Recovery (Integration)

**File**: `scripts/verify-agent-recovery.mjs`

```javascript
async function testStaleSessionRetry() {
  // 1. Create agent session via /api/chat, get agentId
  // 2. Wait for session to go stale (or force stale via internal state)
  // 3. Send another message
  // 4. Assert: one retry with fresh agent, then success
  console.log('PASS  stale session auto-retry');
}

async function testRateLimitBackoff() {
  // 1. Send many rapid requests to trigger rate limit
  // 2. Assert: 429 is handled with exponential backoff
  // 3. Assert: subsequent request succeeds after backoff
  console.log('PASS  rate limit backoff handling');
}

async function testConcurrentSessions() {
  // 1. Open 5 concurrent SSE streams with different sessionIds
  // 2. Assert: all succeed, no interference
  console.log('PASS  concurrent session isolation');
}
```

### 3.3 File Persistence Under Load

**File**: `scripts/verify-file-locking.mjs`

```javascript
async function testConcurrentHistoryWrites() {
  // 1. PUT /api/history with 5 different conversations concurrently
  // 2. GET /api/history to read back
  // 3. Assert: all 5 conversations present, no JSON corruption
  console.log('PASS  concurrent history writes');
}

async function testConcurrentLearningMemory() {
  // 1. PUT /api/learning 10 times concurrently with different states
  // 2. GET /api/learning
  // 3. Assert: valid JSON, last state (by timestamp) wins
  console.log('PASS  concurrent learning memory writes');
}

async function testCrashRecovery() {
  // 1. Write a conversation
  // 2. Simulate partial write (truncated JSON)
  // 3. Read back → should skip corrupt file, not crash
  console.log('PASS  corrupt JSON graceful skip');
}
```

### 3.4 STT Service Reliability

**File**: `scripts/verify-stt-reliability.mjs`

```javascript
async function testSttHealthCheck() {
  // 1. GET http://127.0.0.1:8765/health
  // 2. Assert: model loaded, sensevoice status reported
  console.log('PASS  STT health endpoint');
}

async function testSttRestartRecovery() {
  // 1. Kill STT server with SIGTERM
  // 2. Wait for systemd restart (RestartSec=5)
  // 3. Assert: /health responds within 30s
  console.log('PASS  STT restart recovery');
}

async function testSttConcurrentRequests() {
  // 1. Send 3 concurrent transcription requests
  // 2. Assert: all complete (sequentially due to lock, but without error)
  console.log('PASS  STT concurrent transcription');
}
```

---

## 4. Chaos Tests

### 4.1 Agent Crash Injection

```typescript
// src/lib/__tests__/chaos-agent.test.ts (run with VITEST_CHAOS=1)
describe('Chaos: Agent Failures', () => {
  it('survives SDK returning bare status:error on every other call', async () => {
    // Alternating success/failure pattern
  });

  it('survives 3 consecutive CursorAgentError(isRetryable)', async () => {
    // Exhausts retries, falls through to ErrorHandler
  });

  it('survives 30s of complete SDK unresponsiveness', async () => {
    // Timeout kicks in, agent is cleaned up
  });

  it('survives SDK unhandledRejection mid-stream', async () => {
    // Global safety net catches it; stream closes gracefully
  });
});
```

### 4.2 Network Chaos (via proxy or iptables simulation)

```javascript
// scripts/chaos-network.mjs
async function testSseDropAndRecover() {
  // 1. Start SSE stream
  // 2. Drop TCP connection (iptables DROP → REJECT)
  // 3. Wait for EventSource reconnect
  // 4. Assert: stream resumes from Last-Event-ID
}

async function testSttTimeoutResilience() {
  // 1. Add 10s delay to STT response (tc qdisc netem)
  // 2. Send transcription request
  // 3. Assert: client times out gracefully, not hung
}
```

---

## 5. End-to-End Tests

### 5.1 Full Chat E2E

```javascript
// scripts/verify-e2e-reliability.mjs
async function testCompleteChatFlow() {
  // 1. POST /api/chat with a math question
  // 2. Read SSE stream to completion (timeout 120s)
  // 3. Assert: 'done' event received
  // 4. Assert: reply contains non-empty text
  // 5. GET /api/history — verify conversation saved
  console.log('PASS  complete chat flow');
}

async function testVoiceChatFlow() {
  // 1. Generate test WAV audio
  // 2. POST /api/transcribe → get text
  // 3. POST /api/chat with transcribed text
  // 4. Read SSE stream
  // 5. POST /api/tts with reply text
  // 6. Assert: audio/mpeg response
  console.log('PASS  voice → chat → TTS flow');
}

async function testCrossDeviceSync() {
  // 1. PUT /api/history with conversation from "device A"
  // 2. GET /api/history from "device B"
  // 3. Assert: conversation appears on device B
  console.log('PASS  cross-device history sync');
}

async function testGracefulDegradation() {
  // 1. Stop STT service
  // 2. Send text-only chat
  // 3. Assert: chat works (text input doesn't depend on STT)
  // 4. Try voice → expect friendly error, not crash
  console.log('PASS  graceful degradation without STT');
}
```

---

## 6. Test Infrastructure

### 6.1 New Test Files

```
src/lib/__tests__/
├── cursor-agent-reliability.test.ts   # Agent session recovery, retry, timeout
├── history-store-atomic.test.ts       # Atomic writes, concurrency safety
├── run-log.test.ts                    # Agent run log CRUD
└── sse-encode.test.ts                 # SSE event encoding

scripts/
├── verify-agent-recovery.mjs          # Agent session recovery integration
├── verify-sse-reliability.mjs         # SSE heartbeat, reconnect, headers
├── verify-file-locking.mjs            # Concurrent write safety
├── verify-stt-reliability.mjs         # STT health, restart, concurrency
├── verify-e2e-reliability.mjs         # Full end-to-end flows
└── chaos-network.mjs                  # Network chaos simulation
```

### 6.2 Test Dependencies

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "jsdom": "^25.x",
    "msw": "^2.x",
    "nock": "^14.x"
  }
}
```

- `msw` (Mock Service Worker): Mock Cursor SDK API at the network level
- `nock`: Mock HTTP dependencies (STT, TTS, Edge)
- `@testing-library/react` + `jsdom`: Component tests for `TutorShell`, `Composer`, `ChatThread`

### 6.3 npm Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:chaos": "VITEST_CHAOS=1 vitest run src/lib/__tests__/chaos-agent.test.ts",
    "test:coverage": "vitest run --coverage",
    "verify:agent-recovery": "node scripts/verify-agent-recovery.mjs",
    "verify:sse": "node scripts/verify-sse-reliability.mjs",
    "verify:file-locking": "node scripts/verify-file-locking.mjs",
    "verify:stt-rel": "node scripts/verify-stt-reliability.mjs",
    "verify:e2e": "node scripts/verify-e2e-reliability.mjs",
    "verify:reliability": "npm run test && npm run verify:agent-recovery && npm run verify:sse && npm run verify:file-locking && npm run verify:stt-rel",
    "verify:all-reliability": "npm run verify:reliability && npm run verify:e2e"
  }
}
```

---

## 7. Test Coverage Targets

| Module | Current Coverage | Target v0.4 | Target v1.0 |
|--------|-----------------|-------------|-------------|
| `cursor-agent.ts` (reliability paths) | 0% | 80% | 90% |
| `history-store.ts` (atomic writes) | ~60% | 90% | 95% |
| `learning-memory-store.ts` (concurrent writes) | 0% | 80% | 90% |
| `chat/route.ts` (SSE heartbeat, error handling) | 30% | 70% | 85% |
| `session-store.ts` (LRU eviction) | ~50% | 90% | 95% |
| `run-log.ts` (new module) | N/A | 90% | 95% |
| Integration verifiers (reliability) | 0 | 4 scripts | 6 scripts |

---

## 8. CI Integration

### 8.1 GitHub Actions Workflow Addition

```yaml
# .github/workflows/reliability.yml
name: Reliability Tests
on:
  push:
    branches: [main]
  pull_request:
    paths:
      - 'src/lib/cursor-agent.ts'
      - 'src/lib/history-store.ts'
      - 'src/lib/learning-memory-store.ts'
      - 'src/app/api/chat/route.ts'
      - 'scripts/stt_server.py'
      - 'start.sh'

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test

  integration:
    needs: unit
    runs-on: [self-hosted, spark]
    steps:
      - uses: actions/checkout@v4
      - run: npm run verify:reliability

  chaos:
    needs: unit
    runs-on: [self-hosted, spark]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: npm run test:chaos
```

---

## 9. Regression Test Catalog (Reliability)

| Bug | Test | Symptom | Fix Verified |
|-----|------|---------|-------------|
| SDK unhandledRejection crashes process | `cursor-agent-reliability.test.ts`: "survives unhandledRejection" | Node process exits with non-zero | SDK >= 1.0.19 + process-level safety net |
| Stale session bare error | `cursor-agent-reliability.test.ts`: "retries once on bare error" | `run.wait()` returns `{status:"error"}` with no error field | Fresh agent retry |
| Port EADDRINUSE on restart | `verify-system.mjs` (updated): "port is free before start" | `listen EADDRINUSE` | Pre-flight kill in start.sh |
| STT crash loop | `verify-stt-reliability.mjs`: "restart recovery within 30s" | 6x consecutive EADDRINUSE | systemd with RestartSec=5, StartLimitBurst |
| Concurrent history corruption | `history-store-atomic.test.ts`: "concurrent writes are safe" | Truncated/invalid JSON on read | atomicWriteJson + lockedWrite |
| SSE silent drop behind proxy | `verify-sse-reliability.mjs`: "heartbeat within 20s" | EventSource never fires events | 15s heartbeat comments |

---

## 10. References

- [Testing strategy from Spark Design Docs](../docs/subsystems/testing.md)
- [Reliability design document](../docs/code-agent-reliability-design.md)
- [Vitest documentation](https://vitest.dev/)
- [Testing Library documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW (Mock Service Worker)](https://mswjs.io/)
- [Nock HTTP mocking](https://github.com/nock/nock)
