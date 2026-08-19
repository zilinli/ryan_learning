#!/usr/bin/env node
/**
 * Spark OpenClaw control plane (standalone) — avoids rebuilding Next on low-RAM VPS.
 * Port 3010. Serves /deploy /control /install/* /api/nodes/* /api/control/*
 */
import http from "node:http";
import { EventEmitter } from "node:events";
import { promises as fs, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.SPARK_CONTROL_PORT || 3010);
const DATA_DIR = path.join(ROOT, "data", "nodes");
const PAIR_TTL_MS = 15 * 60 * 1000;
const ONLINE_MS = 45_000;

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
async function load() {
  if (hub._loaded) return;
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
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-spark-admin",
  });
  res.end(body);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function checkAdmin(req) {
  const expected = (fileEnv.SPARK_ADMIN_TOKEN || "").trim();
  if (!expected) return true;
  const got = (req.headers["x-spark-admin"] || "").trim();
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

const deployHtml = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Deploy OpenClaw</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.45}pre{background:#111;color:#b6f7c1;padding:1rem;border-radius:12px;overflow:auto;white-space:pre-wrap}button{background:#0d9488;color:#fff;border:0;border-radius:999px;padding:.6rem 1.2rem;font-weight:600;cursor:pointer}.muted{color:#666}</style></head><body>
<p><a href="/">Spark</a> · <a href="/control">Control</a></p>
<h1>Deploy OpenClaw on this PC</h1>
<p class=muted>Generate a pair code, run the PowerShell command on Windows. PC installs OpenClaw and connects back here.</p>
<label class=muted>Optional admin token <input id=admin style="width:100%;padding:.5rem;margin:.4rem 0 1rem" placeholder="if SPARK_ADMIN_TOKEN set"></label>
<button id=gen>Generate pair code</button>
<div id=box style="display:none;margin-top:1rem"><div id=code style="font:2rem monospace;letter-spacing:.2em"></div><div id=ttl class=muted></div><pre id=cmd></pre><button id=copy>Copy command</button></div>
<p id=err style="color:#c00"></p>
<h2>Nodes</h2><ul id=nodes></ul>
<script>
const h=()=>{const t=localStorage.getItem('spark.admin')||''; const o={'content-type':'application/json'}; if(t) o['x-spark-admin']=t; return o};
document.getElementById('admin').value=localStorage.getItem('spark.admin')||'';
document.getElementById('admin').onchange=e=>localStorage.setItem('spark.admin',e.target.value.trim());
async function refresh(){const r=await fetch('/api/nodes',{headers:h()}); const j=await r.json(); if(!r.ok){document.getElementById('err').textContent=j.error||r.statusText;return} document.getElementById('err').textContent=''; document.getElementById('nodes').innerHTML=(j.nodes||[]).map(n=>'<li>'+(n.online?'online':'offline')+' · '+n.hostname+' · '+(n.openclawVersion||'')+'</li>').join('')||'<li class=muted>None yet</li>'}
document.getElementById('gen').onclick=async()=>{const r=await fetch('/api/nodes/pair',{method:'POST',headers:h()}); const j=await r.json(); if(!r.ok){document.getElementById('err').textContent=j.error;return} document.getElementById('box').style.display='block'; document.getElementById('code').textContent=j.code; const origin=location.origin; const cmd="$env:SPARK_PAIR_CODE='"+j.code+"'; $env:SPARK_URL='"+origin+"'; iwr -useb "+origin+"/install/windows.ps1 | iex"; document.getElementById('cmd').textContent=cmd; document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(cmd); const end=j.expiresAt; setInterval(()=>{document.getElementById('ttl').textContent='expires in '+Math.max(0,Math.floor((end-Date.now())/1000))+'s'},1000); refresh()};
setInterval(refresh,4000); refresh();
</script></body></html>`;

const controlHtml = `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Control OpenClaw</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:1rem;display:flex;flex-direction:column;min-height:100vh}#log{flex:1;border:1px solid #ddd;border-radius:12px;padding:1rem;overflow:auto;background:#fafafa}.me{text-align:right}.bubble{display:inline-block;max-width:90%;padding:.6rem .9rem;border-radius:16px;margin:.3rem 0;white-space:pre-wrap}.me .bubble{background:#0d9488;color:#fff}.bot .bubble{background:#eee}form{display:flex;gap:.5rem;margin-top:1rem}input,select{flex:1;padding:.6rem;border-radius:999px;border:1px solid #ccc}button{background:#0d9488;color:#fff;border:0;border-radius:999px;padding:.6rem 1.2rem;font-weight:600}</style></head><body>
<p><a href="/">Spark</a> · <a href="/deploy">Deploy</a></p>
<h1>Remote OpenClaw</h1>
<select id=node></select>
<div id=log></div>
<form id=f><input id=m placeholder="Command for the PC…"><button>Send</button></form>
<script>
const h=()=>{const t=localStorage.getItem('spark.admin')||''; const o={'content-type':'application/json'}; if(t) o['x-spark-admin']=t; return o};
const log=document.getElementById('log');
function add(role,text){const d=document.createElement('div'); d.className=role; d.innerHTML='<div class=bubble></div>'; d.firstChild.textContent=text; log.appendChild(d); log.scrollTop=log.scrollHeight; return d.firstChild}
async function refresh(){const r=await fetch('/api/nodes',{headers:h()}); const j=await r.json(); const s=document.getElementById('node'); const cur=s.value; s.innerHTML=(j.nodes||[]).map(n=>'<option value="'+n.nodeId+'">'+(n.online?'●':'○')+' '+n.hostname+'</option>').join('')||'<option value="">(none)</option>'; if(cur) s.value=cur}
document.getElementById('f').onsubmit=async e=>{e.preventDefault(); const message=document.getElementById('m').value.trim(); if(!message) return; document.getElementById('m').value=''; add('me',message); let bubble=add('bot','…'); let acc=''; const r=await fetch('/api/control/chat',{method:'POST',headers:h(),body:JSON.stringify({message,nodeId:document.getElementById('node').value||undefined})}); if(!r.ok){const j=await r.json().catch(()=>({})); bubble.textContent='Error: '+(j.error||r.status); return} const reader=r.body.getReader(); const dec=new TextDecoder(); let buf=''; while(true){const {done,value}=await reader.read(); if(done) break; buf+=dec.decode(value,{stream:true}); const parts=buf.split('\\n\\n'); buf=parts.pop()||''; for(const block of parts){const ev=(block.match(/^event: (\\w+)/m)||[])[1]; const dataLine=block.split('\\n').find(l=>l.startsWith('data: ')); if(!ev||!dataLine) continue; const data=JSON.parse(dataLine.slice(6)); if(ev==='delta') acc+=data.text||''; if(ev==='done') acc=data.text||acc; if(ev==='error') acc='Error: '+(data.error||''); bubble.textContent=acc||'…'}}};
setInterval(refresh,4000); refresh();
</script></body></html>`;

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-spark-admin",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === "/deploy" || p === "/deploy/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(deployHtml);
  }
  if (p === "/control" || p === "/control/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(controlHtml);
  }
  if (p.startsWith("/install/")) {
    const name = p.slice("/install/".length);
    const file = path.join(ROOT, "public", "install", name);
    if (!file.startsWith(path.join(ROOT, "public", "install"))) return json(res, 403, { error: "bad path" });
    try {
      const data = await fs.readFile(file);
      const type = name.endsWith(".ps1") ? "text/plain" : "application/javascript";
      res.writeHead(200, { "content-type": type });
      return res.end(data);
    } catch {
      return json(res, 404, { error: "not found" });
    }
  }

  await load();
  const now = Date.now();

  if (p === "/api/nodes/pair" && req.method === "POST") {
    if (!checkAdmin(req)) return json(res, 401, { error: "unauthorized" });
    const code = randomBytes(4).toString("hex").slice(0, 8).toUpperCase();
    const rec = { code, createdAt: now, expiresAt: now + PAIR_TTL_MS, used: false };
    hub.pairs = hub.pairs.filter((x) => x.expiresAt > now && !x.used);
    hub.pairs.push(rec);
    await savePairs();
    return json(res, 200, { code, expiresAt: rec.expiresAt, ttlMs: PAIR_TTL_MS });
  }

  if (p === "/api/nodes" && req.method === "GET") {
    if (!checkAdmin(req)) return json(res, 401, { error: "unauthorized" });
    return json(res, 200, {
      nodes: hub.nodes.map((n) => ({
        nodeId: n.nodeId,
        hostname: n.hostname,
        platform: n.platform,
        openclawVersion: n.openclawVersion,
        lastSeen: n.lastSeen,
        online: now - n.lastSeen < ONLINE_MS,
      })),
    });
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
    if (!checkAdmin(req)) return json(res, 401, { error: "unauthorized" });
    const body = await readBody(req);
    const message = (body.message || "").trim();
    if (!message) return json(res, 400, { error: "missing message" });
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
    send("status", { status: "thinking", nodeId: node.nodeId, hostname: node.hostname });
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
    const cmd = { requestId, type: "chat", message };
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
        send("error", { error: "node timeout (3 min). Is Spark Bridge running?" });
        hub.bus.off(`reply:${requestId}`, onReply);
        res.end();
      }
    }, 180000);
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
