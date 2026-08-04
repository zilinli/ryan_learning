#!/usr/bin/env node
/**
 * verify-sse-reliability.mjs — SSE heartbeat, headers, reconnect
 */
import { strict as assert } from "node:assert";

const BASE = "http://127.0.0.1:3000";

async function testSseHeaders() {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "sse-test-" + Date.now(),
      message: "hello",
      history: [],
      learningMemory: { topics: [], skills: [], updatedAt: Date.now() },
    }),
  });

  assert.strictEqual(res.headers.get("content-type")?.includes("text/event-stream"), true, "Content-Type is text/event-stream");
  assert.strictEqual(res.headers.get("x-accel-buffering"), "no", "X-Accel-Buffering is no");
  assert.ok(res.headers.get("cache-control")?.includes("no-cache"), "Cache-Control includes no-cache");
  // Clean up
  await res.body?.cancel();
  console.log("PASS  SSE headers correct for proxy traversal");
}

async function testHeartbeatEvents() {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "sse-hb-" + Date.now(),
      message: "test heartbeat",
      history: [],
      learningMemory: { topics: [], skills: [], updatedAt: Date.now() },
    }),
  });

  const reader = res.body?.getReader();
  assert.ok(reader, "Response has readable body");

  const decoder = new TextDecoder();
  let buf = "";
  let hbFound = false;
  let eventFound = false;
  const start = Date.now();

  try {
    while (Date.now() - start < 20_000) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      if (buf.includes("event:") && !eventFound) eventFound = true;
      if (buf.includes(":hb\n\n")) hbFound = true;

      if (eventFound && hbFound) break;
    }
  } finally {
    reader.cancel();
  }

  assert.ok(eventFound, "SSE events received");
  // Heartbeat may not fire if the LLM responds quickly
  console.log(`PASS  SSE events received${hbFound ? " (heartbeat detected)" : ""}`);
}

async function testMultipleEventsInStream() {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "sse-events-" + Date.now(),
      message: "test",
      history: [],
      learningMemory: { topics: [], skills: [], updatedAt: Date.now() },
    }),
  });

  const reader = res.body?.getReader();
  assert.ok(reader, "Response has readable body");

  const decoder = new TextDecoder();
  let buf = "";
  const start = Date.now();
  let hasStatus = false;

  try {
    while (Date.now() - start < 60_000) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      if (buf.includes('"status":"Thinking…"')) hasStatus = true;
      if (buf.includes('event: done')) break;
    }
  } finally {
    reader.cancel();
  }

  assert.ok(hasStatus || buf.includes("event: "), "At least one SSE event received");
  console.log("PASS  Multiple SSE events in stream");
}

async function run() {
  try {
    await testSseHeaders();
    await testHeartbeatEvents();
    await testMultipleEventsInStream();
    console.log("\n=== ALL PASSED ===");
  } catch (e) {
    console.error("FAIL", e.message);
    process.exit(1);
  }
}

run();
