#!/usr/bin/env node
/**
 * Spark OpenClaw control plane (standalone) — avoids rebuilding Next on low-RAM VPS.
 * Port 3010. Serves /deploy /control /ui/* /install/* /api/nodes/* /api/control/*
 */
import http from "node:http";
import { EventEmitter } from "node:events";
import { promises as fs, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UI_DIR = path.join(__dirname, "ui");
const PORT = Number(process.env.SPARK_CONTROL_PORT || 3010);
const DATA_DIR = path.join(ROOT, "data", "nodes");
const PAIR_TTL_MS = 15 * 60 * 1000;
const ONLINE_MS = 180_000;
/** Absolute ceiling for /control chat SSE (OpenClaw tool loops can be long). */
const CHAT_ABS_TIMEOUT_MS = 20 * 60 * 1000;
/** Fail sooner if Bridge stops sending progress chunks. */
const CHAT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const CURRENT_BRIDGE_VERSION = "2026.8.20-6";

function loadEnvFile(filePath) {
  try {
    if (!existsSync(filePath)) return {};
    const env = {};
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      let v = t.slice(i + 1).trim();
      if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
      env[t.slice(0, i).trim()] = v;
    }
    return env;
  } catch {
    return {};
  }
}
const fileEnv = {
  ...loadEnvFile(path.join(ROOT, ".env.local")),
  ...process.env,
};

const hub = {
  pairs: [],
  nodes: [],
  queues: new Map(),
  waiters: new Map(),
  bus: new EventEmitter(),
};
hub.bus.setMaxListeners(200);

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
async function refreshNodesFromDisk() {
  try {
    const disk = JSON.parse(await fs.readFile(path.join(DATA_DIR, "nodes.json"), "utf8"));
    const mem = new Map(hub.nodes.map((n) => [n.nodeId, n]));
    for (const d of disk) {
      const m = mem.get(d.nodeId);
      if (!m) {
        hub.nodes.push(d);
        continue;
      }
      if ((d.lastSeen || 0) > (m.lastSeen || 0)) m.lastSeen = d.lastSeen;
      if (d.alias) m.alias = d.alias;
      if (d.hostname) m.hostname = d.hostname;
      if (d.openclawVersion) m.openclawVersion = d.openclawVersion;
      if (d.platform) m.platform = d.platform;
    }
  } catch {
    /* keep memory */
  }
}
async function load() {
  if (hub._loaded) {
    await refreshNodesFromDisk();
    return;
  }
  await ensureDir();
  try {
    hub.pairs = JSON.parse(await fs.readFile(path.join(DATA_DIR, "pairs.json"), "utf8"));
  } catch {
    hub.pairs = [];
  }
  try {
    hub.nodes = JSON.parse(await fs.readFile(path.join(DATA_DIR, "nodes.json"), "utf8"));
  } catch {
    hub.nodes = [];
  }
  hub._loaded = true;
}
async function savePairs() {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, "pairs.json"), JSON.stringify(hub.pairs, null, 2));
}
async function saveNodes() {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, "nodes.json"), JSON.stringify(hub.nodes, null, 2));
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-spark-admin",
    "access-control-allow-credentials": "true",
  });
  res.end(body);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function cookieValue(req, name) {
  const raw = req.headers.cookie || "";
  const parts = String(raw).split(";");
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return part.slice(i + 1).trim();
    }
  }
  return "";
}
function checkAdmin(req, url) {
  const expected = (fileEnv.SPARK_ADMIN_TOKEN || "").trim();
  if (!expected) return true;
  const got =
    (req.headers["x-spark-admin"] || "").trim() ||
    (url?.searchParams.get("admin") || "").trim() ||
    cookieValue(req, "spark_admin");
  return got === expected;
}
function installKeys() {
  return {
    DEEPSEEK_API_KEY: fileEnv.DEEPSEEK_API_KEY || "",
    DASHSCOPE_API_KEY:
      fileEnv.DASHSCOPE_API_KEY || fileEnv.BAILIAN_API_KEY || fileEnv.ALIYUN_DASHSCOPE_API_KEY || "",
    CURSOR_API_KEY: fileEnv.CURSOR_API_KEY || "",
    DEAPI_API_KEY: fileEnv.DEAPI_API_KEY || "",
  };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".sh": "text/plain; charset=utf-8",
  ".ps1": "text/plain; charset=utf-8",
  ".tar.gz": "application/gzip",
};

async function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || (filePath.endsWith(".tar.gz") ? MIME[".tar.gz"] : "application/octet-stream");
  const data = await fs.readFile(filePath);
  const headers = { "content-type": type };
  if (ext === ".html" || ext === ".js" || ext === ".css") headers["cache-control"] = "no-store";
  res.writeHead(200, headers);
  res.end(data);
}

async function serveStatic(res, baseDir, relPath) {
  const file = path.normalize(path.join(baseDir, relPath));
  if (!file.startsWith(baseDir)) return json(res, 403, { error: "bad path" });
  try {
    await fs.access(file);
    return serveFile(res, file);
  } catch {
    return json(res, 404, { error: "not found" });
  }
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-spark-admin",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === "/deploy" || p === "/deploy/") {
    return serveStatic(res, UI_DIR, "deploy.html");
  }
  if (p === "/control" || p === "/control/") {
    return serveStatic(res, UI_DIR, "control.html");
  }
  if (p.startsWith("/ui/")) {
    return serveStatic(res, UI_DIR, p.slice("/ui/".length));
  }
  if (p.startsWith("/install/assistant/")) {
    const name = p.slice("/install/assistant/".length);
    const file = path.join(ROOT, "assistant", name);
    const base = path.join(ROOT, "assistant");
    if (!path.normalize(file).startsWith(base)) return json(res, 403, { error: "bad path" });
    try {
      await fs.access(file);
      return serveFile(res, file);
    } catch {
      return json(res, 404, { error: "not found" });
    }
  }
  if (p.startsWith("/install/spark-deploy.command") && req.method === "GET") {
    const code = (url.searchParams.get("code") || "PAIRCODE").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
    const origin = fileEnv.SPARK_PUBLIC_URL || "https://spark-tutor-for-ryan.duckdns.org";
    const script = `#!/bin/bash
# Spark one-click OpenClaw deploy — double-click in Finder (or: bash this file)
export SPARK_PAIR_CODE='${code}'
export SPARK_URL='${origin}'
export SPARK_INSECURE=1
curl -kfsSL "$SPARK_URL/install/macos.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh
`;
    res.writeHead(200, {
      "content-type": "application/x-sh; charset=utf-8",
      "content-disposition": `attachment; filename="Spark-Deploy-${code}.command"`,
      "cache-control": "no-store",
    });
    return res.end(script);
  }
  if (p.startsWith("/install/spark-deploy.bat") && req.method === "GET") {
    const code = (url.searchParams.get("code") || "PAIRCODE").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
    const origin = fileEnv.SPARK_PUBLIC_URL || "https://spark-tutor-for-ryan.duckdns.org";
    const script = `@echo off
set SPARK_PAIR_CODE=${code}
set SPARK_URL=${origin}
powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb $env:SPARK_URL/install/windows.ps1 | iex"
pause
`;
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="Spark-Deploy-${code}.bat"`,
      "cache-control": "no-store",
    });
    return res.end(script);
  }

  if (p.startsWith("/install/")) {
    const name = p.slice("/install/".length);
    const file = path.join(ROOT, "public", "install", name);
    if (!file.startsWith(path.join(ROOT, "public", "install"))) return json(res, 403, { error: "bad path" });
    try {
      await fs.access(file);
      return serveFile(res, file);
    } catch {
      return json(res, 404, { error: "not found" });
    }
  }

  await load();
  const now = Date.now();

  if (p === "/api/nodes/pair" && req.method === "POST") {
    if (!checkAdmin(req, url)) return json(res, 401, { error: "unauthorized" });
    const code = randomBytes(4).toString("hex").slice(0, 8).toUpperCase();
    const rec = { code, createdAt: now, expiresAt: now + PAIR_TTL_MS, used: false };
    hub.pairs = hub.pairs.filter((x) => x.expiresAt > now && !x.used);
    hub.pairs.push(rec);
    await savePairs();
    return json(res, 200, { code, expiresAt: rec.expiresAt, ttlMs: PAIR_TTL_MS });
  }

  if (p === "/api/nodes" && req.method === "GET") {
    await refreshNodesFromDisk();
    return json(res, 200, {
      nodes: hub.nodes.map((n) => ({
        nodeId: n.nodeId,
        hostname: n.hostname,
        alias: n.alias || "",
        platform: n.platform,
        openclawVersion: n.openclawVersion,
        lastSeen: n.lastSeen,
        online: now - n.lastSeen < ONLINE_MS,
        bridgeVersion: n.bridgeVersion || "",
        upgradeAvailable: (n.bridgeVersion || "") !== CURRENT_BRIDGE_VERSION,
      })),
    });
  }

  const nodePatch = p.match(/^\/api\/nodes\/([^/]+)$/);
  if (nodePatch && req.method === "PATCH") {
    if (!checkAdmin(req, url)) return json(res, 401, { error: "unauthorized" });
    const nodeId = decodeURIComponent(nodePatch[1]);
    const body = await readBody(req);
    const n = hub.nodes.find((x) => x.nodeId === nodeId);
    if (!n) return json(res, 404, { error: "node not found" });
    const trimmed = String(body.alias ?? "").trim();
    if (trimmed) n.alias = trimmed;
    else delete n.alias;
    await saveNodes();
    return json(res, 200, { ok: true, nodeId, alias: trimmed });
  }

  if (p === "/api/nodes/install-ticket" && req.method === "POST") {
    const body = await readBody(req);
    const pair = hub.pairs.find((x) => x.code === String(body.pairCode || "").toUpperCase());
    if (!pair || pair.used || pair.expiresAt < now) return json(res, 400, { error: "invalid or expired pair code" });
    return json(res, 200, {
      pairCode: pair.code,
      expiresAt: pair.expiresAt,
      keys: installKeys(),
      sparkUrl: fileEnv.SPARK_PUBLIC_URL || "https://spark-tutor-for-ryan.duckdns.org",
    });
  }

  if (p === "/api/nodes/register" && req.method === "POST") {
    const body = await readBody(req);
    const pair = hub.pairs.find((x) => x.code === String(body.pairCode || "").toUpperCase());
    if (!pair || pair.used || pair.expiresAt < now) return json(res, 400, { error: "invalid or expired pair code" });
    pair.used = true;
    await savePairs();
    const rec = {
      nodeId: randomBytes(8).toString("hex"),
      token: randomBytes(24).toString("hex"),
      hostname: body.hostname || "pc",
      platform: body.platform || "win32",
      openclawVersion: body.openclawVersion || "",
      lastSeen: now,
      createdAt: now,
      bridgeVersion: body.bridgeVersion || "",
    };
    hub.nodes.push(rec);
    await saveNodes();
    return json(res, 200, { nodeId: rec.nodeId, token: rec.token });
  }

  if (p === "/api/nodes/heartbeat" && req.method === "POST") {
    const body = await readBody(req);
    const n = hub.nodes.find((x) => x.token === body.token);
    if (!n) return json(res, 401, { error: "unknown node" });
    n.lastSeen = now;
    if (body.openclawVersion) n.openclawVersion = body.openclawVersion;
    if (body.hostname) n.hostname = body.hostname;
    if (body.bridgeVersion) n.bridgeVersion = body.bridgeVersion;
    await saveNodes();
    return json(res, 200, { ok: true, nodeId: n.nodeId });
  }

  if (p === "/api/nodes/poll" && req.method === "GET") {
    const token = url.searchParams.get("token") || "";
    const n = hub.nodes.find((x) => x.token === token);
    if (!n) return json(res, 401, { error: "unknown node" });
    n.lastSeen = now;
    const q = hub.queues.get(n.nodeId) || [];
    if (q.length) {
      const cmd = q.shift();
      hub.queues.set(n.nodeId, q);
      return json(res, 200, { command: cmd });
    }
    const cmd = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        hub.waiters.delete(n.nodeId);
        resolve(null);
      }, 25000);
      hub.waiters.set(n.nodeId, (c) => {
        clearTimeout(timer);
        resolve(c);
      });
    });
    return json(res, 200, { command: cmd });
  }

  if (p === "/api/nodes/reply" && req.method === "POST") {
    const body = await readBody(req);
    const n = hub.nodes.find((x) => x.token === body.token);
    if (!n) return json(res, 401, { error: "unknown node" });
    n.lastSeen = now;
    hub.bus.emit(`reply:${body.requestId}`, body);
    return json(res, 200, { ok: true });
  }

  if (p === "/api/control/chat" && req.method === "POST") {
    if (!checkAdmin(req, url)) return json(res, 401, { error: "unauthorized" });
    const body = await readBody(req);
    const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 9) : [];
    const message = (body.message || "").trim();
    if (!message && !attachments.length) return json(res, 400, { error: "missing message" });
    const online = hub.nodes.filter((n) => now - n.lastSeen < ONLINE_MS);
    const node = (body.nodeId && online.find((n) => n.nodeId === body.nodeId)) || online[0];
    if (!node) return json(res, 503, { error: "no online OpenClaw node. Open /deploy and pair a PC first." });
    const requestId = randomBytes(8).toString("hex");
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("status", {
      status: "thinking",
      nodeId: node.nodeId,
      hostname: node.alias || node.hostname,
    });
    let idleTimer;
    let absTimer;
    const fail = (msg) => {
      if (res.writableEnded) return;
      clearTimeout(idleTimer);
      clearTimeout(absTimer);
      send("error", { error: msg });
      hub.bus.off(`reply:${requestId}`, onReply);
      res.end();
    };
    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        fail(
          "node idle timeout (5 min, no progress). OpenClaw may be stuck — check Spark Bridge on the Mac.",
        );
      }, CHAT_IDLE_TIMEOUT_MS);
    };
    absTimer = setTimeout(() => {
      fail("node timeout (20 min absolute). Task still running on Mac may finish later.");
    }, CHAT_ABS_TIMEOUT_MS);
    armIdle();
    const onReply = (ev) => {
      armIdle();
      if (ev.type === "chunk") send("delta", { text: ev.text });
      if (ev.type === "done") {
        clearTimeout(idleTimer);
        clearTimeout(absTimer);
        send("done", { text: ev.text, nodeId: node.nodeId });
        hub.bus.off(`reply:${requestId}`, onReply);
        res.end();
      }
      if (ev.type === "error") {
        clearTimeout(idleTimer);
        clearTimeout(absTimer);
        send("error", { error: ev.error });
        hub.bus.off(`reply:${requestId}`, onReply);
        res.end();
      }
    };
    hub.bus.on(`reply:${requestId}`, onReply);
    const waiter = hub.waiters.get(node.nodeId);
    const cmd = { requestId, type: "chat", message, attachments };
    if (waiter) {
      hub.waiters.delete(node.nodeId);
      waiter(cmd);
    } else {
      const q = hub.queues.get(node.nodeId) || [];
      q.push(cmd);
      hub.queues.set(node.nodeId, q);
    }
    return;
  }

  if (p === "/api/control/upgrade" && req.method === "POST") {
    if (!checkAdmin(req, url)) return json(res, 401, { error: "unauthorized" });
    const body = await readBody(req);
    const online = hub.nodes.filter((n) => now - n.lastSeen < ONLINE_MS);
    const node = (body.nodeId && online.find((n) => n.nodeId === body.nodeId)) || online[0];
    if (!node) return json(res, 503, { error: "no online OpenClaw node" });
    // Pre-version bridges silently drop upgrade commands → UI hangs until timeout.
    if (!node.bridgeVersion) {
      return json(
        res,
        409,
        {
          error:
            "This PC runs an old Spark Bridge that cannot online-upgrade. On /deploy generate a pair code and download the installer again (or re-run macos.sh / windows.ps1).",
          code: "bridge_too_old",
          nodeId: node.nodeId,
        },
      );
    }
    const requestId = randomBytes(8).toString("hex");
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("status", { status: "upgrading", nodeId: node.nodeId });
    const onReply = (ev) => {
      if (ev.type === "chunk") send("delta", { text: ev.text });
      if (ev.type === "done") {
        send("done", { text: ev.text, nodeId: node.nodeId });
        hub.bus.off(`reply:${requestId}`, onReply);
        res.end();
      }
      if (ev.type === "error") {
        send("error", { error: ev.error });
        hub.bus.off(`reply:${requestId}`, onReply);
        res.end();
      }
    };
    hub.bus.on(`reply:${requestId}`, onReply);
    const waiter = hub.waiters.get(node.nodeId);
    const cmd = { requestId, type: "upgrade" };
    if (waiter) {
      hub.waiters.delete(node.nodeId);
      waiter(cmd);
    } else {
      const q = hub.queues.get(node.nodeId) || [];
      q.push(cmd);
      hub.queues.set(node.nodeId, q);
    }
    setTimeout(() => {
      if (!res.writableEnded) {
        send("error", { error: "upgrade timeout (5 min)" });
        hub.bus.off(`reply:${requestId}`, onReply);
        res.end();
      }
    }, 300000);
    return;
  }

  json(res, 404, { error: "not found", path: p });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: String(e.message || e) });
  });
});
server.listen(PORT, "127.0.0.1", () => console.log(`[spark-control] http://127.0.0.1:${PORT}`));
