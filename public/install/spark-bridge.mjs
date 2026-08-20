#!/usr/bin/env node
/**
 * Spark Bridge — outbound long-poll to spark-tutor; runs local `openclaw agent`.
 * Env: SPARK_URL, SPARK_NODE_TOKEN (or SPARK_PAIR_CODE for first register)
 * State: ~/.openclaw/bridge/state.json (USERPROFILE on Windows)
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = process.env.USERPROFILE || process.env.HOME || ".";
const STATE_DIR = path.join(HOME, ".openclaw", "bridge");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const SPARK_URL = (process.env.SPARK_URL || "https://spark-tutor-for-ryan.duckdns.org").replace(/\/$/, "");

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeState(s) {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(s, null, 2), "utf8");
}

async function openclawVersion() {
  return await new Promise((resolve) => {
    const p = spawn("openclaw", ["--version"], { shell: true });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => resolve(out.trim().split(/\s+/)[1] || out.trim() || ""));
    p.on("error", () => resolve(""));
  });
}

async function ensureToken() {
  const st = await readState();
  if (st.token) return st;
  const pairCode = process.env.SPARK_PAIR_CODE;
  if (!pairCode) throw new Error("Need SPARK_NODE_TOKEN in state or SPARK_PAIR_CODE");
  const ver = await openclawVersion();
  const r = await fetch(`${SPARK_URL}/api/nodes/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pairCode,
      hostname: os.hostname(),
      platform: process.platform,
      openclawVersion: ver,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `register ${r.status}`);
  const next = { token: j.token, nodeId: j.nodeId, sparkUrl: SPARK_URL };
  await writeState(next);
  console.log(`[spark-bridge] registered nodeId=${j.nodeId}`);
  return next;
}

async function heartbeat(token) {
  const ver = await openclawVersion();
  await fetch(`${SPARK_URL}/api/nodes/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      hostname: os.hostname(),
      openclawVersion: ver,
    }),
  }).catch(() => {});
}

async function reply(token, payload) {
  await fetch(`${SPARK_URL}/api/nodes/reply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
  });
}

function runOpenClaw(message) {
  return new Promise((resolve, reject) => {
    const args = ["agent", "--agent", "main", "--local", "-m", message];
    const p = spawn("openclaw", args, { shell: true, env: process.env });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0 && !out.trim()) reject(new Error(err.trim() || `exit ${code}`));
      else resolve(out.trim() || err.trim());
    });
  });
}

async function handleChat(token, cmd) {
  try {
    await reply(token, { requestId: cmd.requestId, type: "chunk", text: "Running on PC…\n" });
    const text = await runOpenClaw(cmd.message);
    await reply(token, { requestId: cmd.requestId, type: "done", text });
  } catch (e) {
    await reply(token, {
      requestId: cmd.requestId,
      type: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function loop() {
  const st = await ensureToken();
  console.log(`[spark-bridge] polling ${SPARK_URL} as ${st.nodeId}`);
  for (;;) {
    try {
      await heartbeat(st.token);
      const r = await fetch(`${SPARK_URL}/api/nodes/poll?token=${encodeURIComponent(st.token)}`);
      if (r.status === 401) {
        console.error("[spark-bridge] token rejected; delete state.json and re-pair");
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const j = await r.json();
      if (j.command?.type === "chat") {
        await handleChat(st.token, j.command);
      }
    } catch (e) {
      console.error("[spark-bridge]", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
