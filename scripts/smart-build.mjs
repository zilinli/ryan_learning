#!/usr/bin/env node
/**
 * Smart Build Orchestrator for low-RAM hosts (4 GB total, ~1 GB free).
 *
 * Strategy:
 *   1. Stop heavy sidecars to free RAM
 *   2. Memory check (abort WITHOUT touching live `.next` if too low)
 *   3. Stash live `.next` → `.next.prev` (never leave site without a fallback)
 *   4. Build with capped Node heap + retries
 *   5. On success: discard stash; on failure/signal: restore stash
 *   6. Post-clean caches; restart sidecars
 *
 * Why: Code Agent `deploy_live` and IDE `npm run build` share the same tree as
 * PM2 `npm start`. A plain `rm -rf .next` before build left production dead
 * whenever the build OOMed, timed out, or failed the memory gate.
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { freemem, totalmem, cpus } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearIncompleteNext,
  discardStashedNext,
  hasProdBuild,
  restoreNextArtifact,
  stashNextArtifact,
} from "./lib/next-artifact-guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOT_NEXT = resolve(ROOT, ".next");
const DOT_NEXT_PREV = resolve(ROOT, ".next.prev");

/** Sidecars stopped to free RAM during the build itself. */
const PM2_SERVICES_TO_FREE = ["formospeech-tts"];
/**
 * App must stop BEFORE `.next` is stashed — otherwise live traffic hits a
 * missing BUILD_ID and Next returns plain "Internal Server Error" (not JSON),
 * which Studio labs surface as `Unexpected token 'I'...`.
 */
const PM2_APP = "spark-tutor";

let stashed = false;
let finished = false;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stderr.write(`[build ${ts}] ${msg}\n`);
}

function freeMB() {
  return Math.round(freemem() / 1024 / 1024);
}

function totalMB() {
  return Math.round(totalmem() / 1024 / 1024);
}

function gc() {
  if (global.gc) {
    global.gc();
    log("Forced GC completed");
  }
}

function runSync(command, args, envOverride, timeoutMs = 300_000) {
  return new Promise((resolvePromise) => {
    log(`Running: ${command} ${args.join(" ")}`);
    log(`Available memory: ${freeMB()} MB / ${totalMB()} MB`);

    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...envOverride },
      stdio: ["ignore", "inherit", "inherit"],
      timeout: timeoutMs,
    });

    child.on("close", (code) => {
      log(`Process exited with code ${code}`);
      resolvePromise(code);
    });

    child.on("error", (err) => {
      log(`Spawn error: ${err.message}`);
      resolvePromise(1);
    });
  });
}

function memoryCheck() {
  log("Phase 2: Memory check");
  const free = freeMB();
  if (free < 500) {
    log(`CRITICAL: Only ${free} MB free. Build may fail.`);
  } else if (free < 800) {
    log(`WARNING: Only ${free} MB free. Build may be tight.`);
  }
  gc();
  log(`After GC: ${freeMB()} MB free`);
  return freeMB() >= 400;
}

function stashLiveNext() {
  log("Phase 3: Stash live .next → .next.prev (keep fallback for PM2)");
  stashed = stashNextArtifact(DOT_NEXT, DOT_NEXT_PREV);
  log(stashed ? "Stashed previous production build" : "No prior .next to stash");
  gc();
  log(`After stash: ${freeMB()} MB free`);
}

function restoreLiveNext(reason) {
  if (!stashed && !existsSync(DOT_NEXT_PREV)) return false;
  log(`Restoring previous .next (${reason})`);
  const ok = restoreNextArtifact(DOT_NEXT, DOT_NEXT_PREV);
  stashed = false;
  if (ok) log("Restored .next from .next.prev — live site artifact preserved");
  else log("Warning: restore skipped (no .next.prev)");
  return ok;
}

function commitNewNext() {
  if (!hasProdBuild(DOT_NEXT)) {
    log("ERROR: build reported success but BUILD_ID missing");
    return false;
  }
  discardStashedNext(DOT_NEXT_PREV);
  stashed = false;
  log("Discarded .next.prev after successful build");
  return true;
}

async function tryBuild(heapSize = 1024) {
  log(`Phase 4: Build with heap cap ${heapSize} MB`);
  const env = {
    NODE_OPTIONS: `--max-old-space-size=${heapSize}`,
    NEXT_TELEMETRY_DISABLED: "1",
  };
  return (
    (await runSync("npx", ["next", "build", "--turbopack", "--no-mangling"], env)) ===
    0
  );
}

async function tryBuildWebpack(heapSize = 1024) {
  log(`Phase 4b: Build with webpack (lower memory), heap cap ${heapSize} MB`);
  const env = {
    NODE_OPTIONS: `--max-old-space-size=${heapSize}`,
    NEXT_TELEMETRY_DISABLED: "1",
  };
  return (
    (await runSync(
      "npx",
      ["next", "build", "--webpack", "--no-mangling"],
      env,
    )) === 0
  );
}

function stopHeavyServices() {
  for (const svc of PM2_SERVICES_TO_FREE) {
    try {
      execSync(`pm2 stop ${svc}`, { cwd: ROOT, stdio: "pipe", timeout: 10000 });
      log(`Stopped PM2 service: ${svc}`);
    } catch {
      log(`Warning: could not stop ${svc} (may not be running)`);
    }
  }
  if (PM2_SERVICES_TO_FREE.length > 0) {
    execSync("sleep 2", { stdio: "ignore" });
  }
}

function stopAppForBuild() {
  try {
    execSync(`pm2 stop ${PM2_APP}`, { cwd: ROOT, stdio: "pipe", timeout: 15000 });
    log(`Stopped PM2 app: ${PM2_APP} (avoid serving stashed/incomplete .next)`);
    execSync("sleep 1", { stdio: "ignore" });
  } catch {
    log(`Warning: could not stop ${PM2_APP}`);
  }
}

function restartAppAfterBuild() {
  try {
    execSync(`pm2 restart ${PM2_APP}`, {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 60000,
    });
    log(`Restarted PM2 app: ${PM2_APP}`);
  } catch {
    log(`Warning: could not restart ${PM2_APP}`);
  }
}

function restartHeavyServices() {
  for (const svc of PM2_SERVICES_TO_FREE) {
    try {
      execSync(`pm2 restart ${svc}`, {
        cwd: ROOT,
        stdio: "pipe",
        timeout: 30000,
      });
      log(`Restarted PM2 service: ${svc}`);
    } catch {
      log(`Warning: could not restart ${svc}`);
    }
  }
}

function postClean() {
  log("Phase 5: Post-clean");
  gc();
  log(`Final memory: ${freeMB()} MB free`);
  // Only drop webpack/turbopack cache. Keep `.next/server/pages` (incl. 500.html)
  // — deleting it made Next return plain "Internal Server Error" text on failures.
  const cacheDirs = [resolve(DOT_NEXT, "cache")];
  for (const dir of cacheDirs) {
    if (existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true });
        log(`Removed ${dir}`);
      } catch {
        // ignore
      }
    }
  }
}

function emergencyRestore(signal) {
  if (finished) return;
  finished = true;
  try {
    restoreLiveNext(signal || "exit");
  } catch (err) {
    log(`Emergency restore failed: ${err.message}`);
  }
}

process.on("SIGINT", () => {
  emergencyRestore("SIGINT");
  restartAppAfterBuild();
  process.exit(1);
});
process.on("SIGTERM", () => {
  emergencyRestore("SIGTERM");
  restartAppAfterBuild();
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${err.message}`);
  emergencyRestore("uncaughtException");
  restartAppAfterBuild();
  process.exit(1);
});

async function main() {
  log("=== Smart Build for low-RAM host (safe .next stash) ===");
  log(`CPU cores: ${cpus().length}, Total RAM: ${totalMB()} MB`);

  stopHeavyServices();

  // Abort BEFORE touching live .next
  if (!memoryCheck()) {
    log("FATAL: Insufficient memory to build. Live .next left intact.");
    restartHeavyServices();
    finished = true;
    process.exit(1);
  }

  stopAppForBuild();
  stashLiveNext();

  const attempts = [
    () => tryBuild(1024),
    () => tryBuild(768),
    () => tryBuildWebpack(1024),
    () => tryBuildWebpack(768),
  ];

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) {
      log(`Retry ${i}: clearing incomplete .next (stash kept)`);
      clearIncompleteNext(DOT_NEXT);
    }
    const ok = await attempts[i]();
    if (ok && commitNewNext()) {
      log(`Build successful (attempt ${i + 1})`);
      postClean();
      restartAppAfterBuild();
      restartHeavyServices();
      finished = true;
      process.exit(0);
    }
    if (ok) {
      log("Success flag but no BUILD_ID — treating as failure");
      clearIncompleteNext(DOT_NEXT);
    }
  }

  log("FATAL: All build attempts failed — restoring previous .next");
  restoreLiveNext("all attempts failed");
  restartAppAfterBuild();
  restartHeavyServices();
  finished = true;
  process.exit(1);
}

main().catch((err) => {
  log(`Unhandled error: ${err.message}`);
  emergencyRestore("unhandledRejection");
  restartAppAfterBuild();
  restartHeavyServices();
  process.exit(1);
});
