#!/usr/bin/env node
/**
 * health-check.mjs — check all Spark services and report JSON.
 * Exit 0 = all healthy, 1 = any failed, 2 = usage error.
 *
 * Services:
 *   - stt    http://127.0.0.1:8765/health      (60s timeout)
 *   - spark  http://127.0.0.1:3000/api/setup   (30s timeout)
 *   - page   http://127.0.0.1:3000/            (15s timeout)
 *   - acc    http://127.0.0.1:3001/api/setup   (15s timeout)
 *
 * Usage: node scripts/health-check.mjs [--json] [--timeout=<ms>]
 */
import { setTimeout as sleep } from "node:timers/promises";

const SERVICES = [
  { name: "stt", url: "http://127.0.0.1:8765/health", timeoutMs: 60_000, check: (d) => d.ok === true },
  { name: "spark", url: "http://127.0.0.1:3000/api/setup", timeoutMs: 30_000, check: (d) => d.configured === true || d.status === "ok" || d.ok === true },
  { name: "page", url: "http://127.0.0.1:3000/", timeoutMs: 15_000, check: () => true },
  { name: "acc", url: "http://127.0.0.1:3001/api/setup", timeoutMs: 15_000, check: (d) => d.ok === true },
];

function parseArgs(argv) {
  const args = { json: false, timeoutMs: null, only: null };
  for (const a of argv) {
    if (a === "--json") args.json = true;
    else if (a.startsWith("--timeout=")) {
      const ms = Number(a.slice("--timeout=".length));
      if (Number.isFinite(ms) && ms > 0) args.timeoutMs = ms;
    } else if (a.startsWith("--service=")) {
      args.only = a.slice("--service=".length);
    }
  }
  return args;
}

async function probe(svc, overrides) {
  const timeoutMs = overrides.timeoutMs ?? svc.timeoutMs;
  const startedAt = Date.now();
  try {
    const res = await fetch(svc.url, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
    const healthy = res.ok && svc.check(data);
    return {
      name: svc.name,
      url: svc.url,
      healthy,
      status: res.status,
      latencyMs: Date.now() - startedAt,
      detail: healthy ? "" : JSON.stringify(data).slice(0, 200),
    };
  } catch (err) {
    return {
      name: svc.name,
      url: svc.url,
      healthy: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      detail: err.name === "TimeoutError" ? "timeout" : String(err).slice(0, 200),
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = args.only
    ? SERVICES.filter((s) => s.name === args.only)
    : SERVICES;
  if (!targets.length) {
    console.error(`Unknown service: ${args.only}. Valid: ${SERVICES.map((s) => s.name).join(", ")}`);
    process.exit(2);
  }
  const results = await Promise.all(targets.map((s) => probe(s, args)));
  const allHealthy = results.every((r) => r.healthy);
  const summary = { ok: allHealthy, time: new Date().toISOString(), services: results };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const r of results) {
      console.log(
        `${r.healthy ? "PASS" : "FAIL"}  ${r.name.padEnd(6)} ${r.status || "-"} ${String(r.latencyMs).padStart(5)}ms${r.detail ? "  " + r.detail : ""}`
      );
    }
    console.log(allHealthy ? "ALL HEALTHY" : "SOME SERVICES DOWN");
  }
  process.exit(allHealthy ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
