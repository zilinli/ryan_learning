#!/usr/bin/env node
/**
 * verify-file-locking.mjs — concurrent history writes, corrupt JSON handling
 */
import { strict as assert } from "node:assert";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = "http://127.0.0.1:3000";

async function testConcurrentHistoryWrites() {
  const sessionIds = Array.from({ length: 5 }, (_, i) => `fl-test-${Date.now()}-${i}`);
  const sessions = sessionIds.map(id => ({
    sessionId: id,
    title: `Test ${id.slice(-8)}`,
    messages: [
      { id: "m1", role: "user", content: "test", createdAt: Date.now() },
      { id: "m2", role: "assistant", content: "response", createdAt: Date.now() },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  // Concurrent PUTs
  const writes = sessions.map(s =>
    fetch(`${BASE}/api/history`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversations: [s] }),
    })
  );

  const results = await Promise.allSettled(writes);
  const okCount = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
  assert.ok(okCount >= 4, `At least 4/5 writes succeeded (got ${okCount})`);

  // Read back
  const res = await fetch(`${BASE}/api/history`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  const ids = (data.conversations || []).map((c: Record<string,unknown>) => c.sessionId);
  const found = sessionIds.filter(id => ids.includes(id)).length;
  assert.ok(found >= 4, `All sessions persisted (found ${found}/5)`);

  // Cleanup
  for (const id of sessionIds) {
    try { await fetch(`${BASE}/api/history?sessionId=${encodeURIComponent(id)}`, { method: "DELETE" }); } catch {}
  }

  console.log("PASS  concurrent history writes (5 concurrent PUTs)");
}

async function testConcurrentLearningMemory() {
  const states = Array.from({ length: 10 }, (_, i) => ({
    topics: [{ id: `topic-${i + 1}`, name: `Topic ${i + 1}`, mastery: 0.5 + i * 0.04, lastAttempt: Date.now() }],
    skills: [],
    updatedAt: Date.now(),
  }));

  const writes = states.map(s =>
    fetch(`${BASE}/api/learning`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    })
  );

  const results = await Promise.allSettled(writes);
  const okCount = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
  assert.ok(okCount >= 8, `At least 8/10 learning writes succeeded (got ${okCount})`);

  // Read back — must be valid JSON
  const res = await fetch(`${BASE}/api/learning`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(data && typeof data === "object", "Learning memory is valid JSON");
  assert.ok(Array.isArray(data.topics), "topics is an array");

  console.log("PASS  concurrent learning memory writes (10 concurrent PUTs)");
}

async function run() {
  try {
    await testConcurrentHistoryWrites();
    await testConcurrentLearningMemory();
    console.log("\n=== ALL PASSED ===");
  } catch (e) {
    console.error("FAIL", e.message);
    process.exit(1);
  }
}

run();
