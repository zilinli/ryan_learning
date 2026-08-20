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
import { fileURLToPath } from "node:url";

export const SPARK_BRIDGE_VERSION = "2026.8.20-6";
/** Client must abort hung polls (proxy 502 / half-open TCP); server wait is ~25s. */
const POLL_TIMEOUT_MS = 45_000;
/** Keep /control SSE alive while OpenClaw runs long tool loops. */
const PROGRESS_EVERY_MS = 25_000;

const HOME = process.env.USERPROFILE || process.env.HOME || ".";
const STATE_DIR = path.join(HOME, ".openclaw", "bridge");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const HEALTH_FILE = path.join(STATE_DIR, "health.json");
const INBOX_DIR = path.join(STATE_DIR, "inbox");
const LOG_FILE = path.join(STATE_DIR, "bridge.log");
const SPARK_URL = (process.env.SPARK_URL || "https://spark-tutor-for-ryan.duckdns.org").replace(/\/$/, "");

let busyRequestId = null;

async function touchHealth(extra = {}) {
  const payload = {
    ts: Date.now(),
    pid: process.pid,
    version: SPARK_BRIDGE_VERSION,
    busy: Boolean(busyRequestId),
    busyRequestId,
    ...extra,
  };
  try {
    await fs.mkdir(STATE_DIR, { recursive: true });
    await fs.writeFile(HEALTH_FILE, JSON.stringify(payload), "utf8");
  } catch {
    /* ignore */
  }
}

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFile(LOG_FILE, line).catch(() => {});
  console.error(msg);
}

const DEBUG_LINE =
  /^\s*(\[agents\/|\[provider-|\[openclaw|tool policy removed|stopReason=|model-fetch|elapsedMs)/i;

export function stripAgentDebug(text) {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (DEBUG_LINE.test(t)) return false;
      if (/^\[agents\//.test(t)) return false;
      if (/ended with\s+stopReason=/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

function openclawEnv() {
  const extra =
    process.platform === "win32"
      ? []
      : ["/usr/local/bin", "/opt/homebrew/bin", `${HOME}/.npm-global/bin`, `${HOME}/.local/bin`];
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const cur = process.env[pathKey] || process.env.PATH || "";
  const parts = [...extra, ...cur.split(path.delimiter)].filter(Boolean);
  const seen = new Set();
  const merged = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    merged.push(p);
  }
  return { ...process.env, [pathKey]: merged.join(path.delimiter), PATH: merged.join(path.delimiter) };
}

function spawnOpenclaw(args) {
  const bin = process.platform === "win32" ? "openclaw.cmd" : "openclaw";
  return spawn(bin, args, {
    env: openclawEnv(),
    windowsHide: true,
  });
}

async function openclawVersion() {
  return await new Promise((resolve) => {
    const p = spawnOpenclaw(["--version"]);
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
      bridgeVersion: SPARK_BRIDGE_VERSION,
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
  await touchHealth({ openclawVersion: ver });
  await fetch(`${SPARK_URL}/api/nodes/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      hostname: os.hostname(),
      openclawVersion: ver,
      bridgeVersion: SPARK_BRIDGE_VERSION,
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

function runOnce(args) {
  return new Promise((resolve) => {
    const p = spawnOpenclaw(args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) => resolve({ code: 1, out, err: String(e.message || e) }));
    p.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

async function runOpenClaw(message) {
  // Correct CLI: https://docs.openclaw.ai/cli/agent
  //   openclaw agent --agent main --message "…"
  // NEVER use positional agent id (openclaw agent main …) — causes
  // "Too many arguments for this command. Try: openclaw agent main --help".
  // Prefer Gateway (no --local) when gateway is already running.
  const msgFile = path.join(STATE_DIR, `msg-${Date.now()}.txt`);
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(msgFile, message, "utf8");
  const attempts = [
    ["agent", "--agent", "main", "--message-file", msgFile],
    ["agent", "--agent", "main", "--message", message],
    ["agent", "--agent", "main", "--local", "--message-file", msgFile],
    ["agent", "exec", "--message-file", msgFile],
  ];
  let last = { code: 1, out: "", err: "openclaw not run" };
  try {
    for (const args of attempts) {
      last = await runOnce(args);
      const combined = `${last.out}\n${last.err}`;
      if (/Too many arguments/i.test(combined)) {
        logLine(`openclaw skip (too many args): ${args.slice(0, 5).join(" ")}`);
        continue;
      }
      const cleaned = stripAgentDebug(last.out) || stripAgentDebug(last.err);
      if (last.err) logLine(last.err.slice(0, 4000));
      if (last.code === 0 || cleaned) {
        return cleaned || (last.code === 0 ? "" : last.err.trim());
      }
      logLine(`openclaw ${args.slice(0, 5).join(" ")} failed: ${(last.err || last.out).slice(0, 500)}`);
    }
  } finally {
    await fs.unlink(msgFile).catch(() => {});
  }
  const cleaned = stripAgentDebug(last.out) || stripAgentDebug(last.err);
  if (last.code !== 0 && !cleaned) {
    throw new Error(stripAgentDebug(last.err) || last.err.trim() || `openclaw exit ${last.code}`);
  }
  return cleaned;
}

function safeName(name) {
  return String(name || "file")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .slice(0, 120);
}

async function writeAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  await fs.mkdir(INBOX_DIR, { recursive: true });
  const stamp = Date.now();
  const paths = [];
  for (let i = 0; i < attachments.length; i += 1) {
    const a = attachments[i];
    const name = `${stamp}-${i}-${safeName(a.name || "file")}`;
    const dest = path.join(INBOX_DIR, name);
    const b64 = String(a.dataBase64 || "").replace(/^data:[^;]+;base64,/, "");
    if (!b64) continue;
    await fs.writeFile(dest, Buffer.from(b64, "base64"));
    paths.push(dest);
  }
  return paths;
}

async function handleChat(token, cmd) {
  busyRequestId = cmd.requestId;
  await touchHealth({ phase: "chat-start" });
  const started = Date.now();
  const progress = setInterval(() => {
    const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
    reply(token, {
      requestId: cmd.requestId,
      type: "chunk",
      text: `…still working on Mac (${mins} min)…\n`,
    }).catch(() => {});
    touchHealth({ phase: "chat-progress" }).catch(() => {});
  }, PROGRESS_EVERY_MS);
  try {
    await reply(token, { requestId: cmd.requestId, type: "chunk", text: "Running on PC…\n" });
    const files = await writeAttachments(cmd.attachments);
    let message = String(cmd.message || "").trim();
    if (files.length) {
      message +=
        "\n\nThe user attached these local files. Read them with your tools:\n" +
        files.map((p) => `- ${p}`).join("\n");
    }
    if (!message) message = files.length ? "Please review the attached files." : "";
    const text = await runOpenClaw(message);
    await reply(token, { requestId: cmd.requestId, type: "done", text: text || "(empty)" });
  } catch (e) {
    await reply(token, {
      requestId: cmd.requestId,
      type: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    clearInterval(progress);
    busyRequestId = null;
    await touchHealth({ phase: "chat-done" });
  }
}

async function downloadTo(url, dest) {
  const r = await fetch(url);
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) throw new Error(`download ${url} → ${r.status}`);
  if (ct.includes("text/html")) {
    throw new Error(`download ${url} returned HTML (check nginx /install routing)`);
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(dest, buf);
}

function restartSelf() {
  if (process.platform === "darwin") {
    spawn("launchctl", ["kickstart", "-k", `gui/${process.getuid?.() || 501}/org.spark.bridge`], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return;
  }
  if (process.platform === "linux") {
    spawn("systemctl", ["--user", "restart", "spark-bridge.service"], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return;
  }
  const startCmd = path.join(STATE_DIR, "start.cmd");
  spawn(process.env.ComSpec || "cmd.exe", ["/c", startCmd], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

async function handleUpgrade(token, cmd) {
  try {
    await reply(token, { requestId: cmd.requestId, type: "chunk", text: "Upgrading from Spark server…\n" });
    const tmp = path.join(os.tmpdir(), `spark-assistant-${Date.now()}`);
    await fs.mkdir(tmp, { recursive: true });
    const tarPath = path.join(os.tmpdir(), "spark-assistant.tar.gz");
    await downloadTo(`${SPARK_URL}/install/assistant.tar.gz`, tarPath);
    await downloadTo(`${SPARK_URL}/install/spark-bridge.mjs`, path.join(STATE_DIR, "index.mjs"));
    await new Promise((resolve, reject) => {
      const p = spawn("tar", ["xzf", tarPath, "-C", tmp], { stdio: "inherit" });
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`tar exit ${c}`))));
      p.on("error", reject);
    });
    const installJs = path.join(tmp, "assistant", "install.mjs");
    await new Promise((resolve, reject) => {
      const p = spawn(process.execPath, [installJs], { stdio: "inherit" });
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`install.mjs exit ${c}`))));
      p.on("error", reject);
    });
    await reply(token, {
      requestId: cmd.requestId,
      type: "done",
      text: `Upgrade complete (bridge ${SPARK_BRIDGE_VERSION}). Restarting Bridge…`,
    });
    setTimeout(() => {
      restartSelf();
      process.exit(0);
    }, 800);
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
  console.log(`[spark-bridge] polling ${SPARK_URL} as ${st.nodeId} v${SPARK_BRIDGE_VERSION}`);
  await touchHealth({ phase: "start", nodeId: st.nodeId });
  setInterval(() => {
    heartbeat(st.token).catch(() => {});
  }, 15000);
  await heartbeat(st.token).catch(() => {});
  for (;;) {
    try {
      await touchHealth({ phase: "poll" });
      const r = await fetch(`${SPARK_URL}/api/nodes/poll?token=${encodeURIComponent(st.token)}`, {
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
      if (r.status === 401) {
        console.error("[spark-bridge] token rejected; delete state.json and re-pair");
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const raw = await r.text();
      let j;
      try {
        j = JSON.parse(raw);
      } catch {
        logLine(`poll non-JSON (${r.status}): ${raw.slice(0, 120)}`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (j.command?.type === "chat") {
        await handleChat(st.token, j.command);
      } else if (j.command?.type === "upgrade") {
        await handleUpgrade(st.token, j.command);
      } else if (j.command?.type) {
        await reply(st.token, {
          requestId: j.command.requestId,
          type: "error",
          error: `unsupported command: ${j.command.type} (bridge ${SPARK_BRIDGE_VERSION})`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // TimeoutAbort / undici: name TimeoutError; keep polling without noisy spam
      if (!/aborted|timeout/i.test(msg) && e?.name !== "TimeoutError") {
        console.error("[spark-bridge]", msg);
      }
      await touchHealth({ phase: "poll-error", error: msg.slice(0, 200) });
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  loop().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
