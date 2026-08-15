#!/usr/bin/env node
/**
 * Minimal China-egress relay for Volc OpenAPI (GenSong).
 *
 * Deploy on a 国内 VPS (阿里云/腾讯云/华为云 lightest instance). Free public
 * proxy lists are NOT recommended — they expose VOLC AK/SK and rarely have
 * stable China mainland egress.
 *
 * Usage on China VPS:
 *   RELAY_TOKEN=change-me node scripts/volc-cn-relay.mjs
 *   # listens 127.0.0.1:8787 — put nginx/caddy TLS in front if exposing publicly
 *
 * On Spark (US host) .env.local:
 *   VOLC_MUSIC_RELAY_URL=https://your-cn-host.example/volc-relay
 *   VOLC_MUSIC_RELAY_TOKEN=change-me
 *
 * Only forwards to https://open.volcengineapi.com (Host + signed headers unchanged).
 */

import http from "node:http";

const PORT = Number(process.env.RELAY_PORT || 8787);
const BIND = process.env.RELAY_BIND || "127.0.0.1";
const TOKEN = process.env.RELAY_TOKEN?.trim() || "";
const ALLOW_HOST = "open.volcengineapi.com";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    return json(res, 200, { ok: true, service: "volc-cn-relay", allowHost: ALLOW_HOST });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }

  if (TOKEN) {
    const got = String(req.headers["x-relay-token"] || "");
    if (got !== TOKEN) {
      return json(res, 401, { ok: false, error: "Invalid X-Relay-Token" });
    }
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON" });
  }

  const url = String(payload.url || "");
  const method = String(payload.method || "POST").toUpperCase();
  const headers = payload.headers && typeof payload.headers === "object"
    ? { ...payload.headers }
    : {};
  const body = typeof payload.body === "string" ? payload.body : "";

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return json(res, 400, { ok: false, error: "Bad url" });
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== ALLOW_HOST) {
    return json(res, 403, {
      ok: false,
      error: `Only https://${ALLOW_HOST} allowed`,
    });
  }

  // Preserve signed Host; drop hop-by-hop
  delete headers.connection;
  delete headers["content-length"];
  headers.Host = ALLOW_HOST;

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      signal: AbortSignal.timeout(90_000),
    });
    const text = await upstream.text();
    const outHeaders = {};
    const ct = upstream.headers.get("content-type");
    if (ct) outHeaders["Content-Type"] = ct;
    return json(res, 200, {
      ok: true,
      status: upstream.status,
      headers: outHeaders,
      body: text,
    });
  } catch (err) {
    return json(res, 502, {
      ok: false,
      error: err instanceof Error ? err.message : "Upstream failed",
    });
  }
});

server.listen(PORT, BIND, () => {
  console.log(
    `[volc-cn-relay] listening http://${BIND}:${PORT} allow=${ALLOW_HOST} token=${TOKEN ? "on" : "off"}`,
  );
});
