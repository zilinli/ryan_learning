#!/usr/bin/env node
/**
 * Smart Build Orchestrator for low-RAM hosts (4 GB total, ~1 GB free).
 *
 * Strategy:
 *   1. Pre-clean .next to reclaim memory
 *   2. Check available memory
 *   3. Build with capped Node heap
 *   4. Auto-retry on failure with progressively safer flags
 *   5. Post-clean
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { freemem, totalmem, cpus } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOT_NEXT = resolve(ROOT, ".next");

// Heavy sidecar services to temporarily stop during build.
// These will be restarted after build (success or failure).
const PM2_SERVICES_TO_FREE = ["formospeech-tts"];

// ─── Helpers ────────────────────────────────────────────

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

/**
 * Spawn a child process and return exit code + stdout.
 * Streams stdout/stderr to parent in real time.
 */
function runSync(command, args, envOverride, timeoutMs = 300_000) {
  return new Promise((resolve) => {
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
      resolve(code);
    });

    child.on("error", (err) => {
      log(`Spawn error: ${err.message}`);
      resolve(1);
    });
  });
}

// ─── Phase 1: Pre-clean ─────────────────────────────────

function preClean() {
  log("Phase 1: Pre-clean");

  if (existsSync(DOT_NEXT)) {
    log(`Removing ${DOT_NEXT} (${freeMB()} MB free before)`);
    try {
      rmSync(DOT_NEXT, { recursive: true, force: true });
      log(`Removed .next, now ${freeMB()} MB free`);
    } catch (err) {
      log(`Warning: Could not fully remove .next: ${err.message}`);
    }
  }

  // Also clean any stale turbopack cache
  const turbopackCache = resolve(ROOT, ".turbopack");
  if (existsSync(turbopackCache)) {
    try {
      rmSync(turbopackCache, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  gc();
  log(`After pre-clean: ${freeMB()} MB free`);
}

// ─── Phase 2: Memory Check ──────────────────────────────

function memoryCheck() {
  log("Phase 2: Memory check");
  const free = freeMB();
  const warnings = [];

  if (free < 500) {
    warnings.push(`CRITICAL: Only ${free} MB free. Build may fail.`);
  } else if (free < 800) {
    warnings.push(`WARNING: Only ${free} MB free. Build may be tight.`);
  }

  if (warnings.length > 0) {
    for (const w of warnings) log(w);
    // Aggressive GC
    gc();
    log(`After aggressive GC: ${freeMB()} MB free`);
  }

  return freeMB() >= 400; // bare minimum
}

// ─── Phase 3: Build ─────────────────────────────────────

async function tryBuild(heapSize = 1024) {
  log(`Phase 3: Build with heap cap ${heapSize} MB`);

  const env = {
    NODE_OPTIONS: `--max-old-space-size=${heapSize}`,
    NEXT_TELEMETRY_DISABLED: "1",
  };

  const code = await runSync(
    "npx",
    ["next", "build", "--turbopack", "--no-mangling"],
    env,
  );

  return code === 0;
}

async function tryBuildWebpack(heapSize = 1024) {
  log(`Phase 3b: Build with webpack (lower memory), heap cap ${heapSize} MB`);

  const env = {
    NODE_OPTIONS: `--max-old-space-size=${heapSize}`,
    NEXT_TELEMETRY_DISABLED: "1",
  };

  const code = await runSync(
    "npx",
    ["next", "build", "--webpack", "--no-mangling"],
    env,
  );

  return code === 0;
}

// ─── Phase 0: PM2 Service Lifecycle ─────────────────────

function stopHeavyServices() {
  for (const svc of PM2_SERVICES_TO_FREE) {
    try {
      execSync(`pm2 stop ${svc}`, { cwd: ROOT, stdio: "pipe", timeout: 10000 });
      log(`Stopped PM2 service: ${svc}`);
    } catch {
      log(`Warning: could not stop ${svc} (may not be running)`);
    }
  }
  // Give kernel time to reclaim
  if (PM2_SERVICES_TO_FREE.length > 0) {
    execSync("sleep 2", { stdio: "ignore" });
  }
}

function restartHeavyServices() {
  for (const svc of PM2_SERVICES_TO_FREE) {
    try {
      execSync(`pm2 restart ${svc}`, { cwd: ROOT, stdio: "pipe", timeout: 30000 });
      log(`Restarted PM2 service: ${svc}`);
    } catch {
      log(`Warning: could not restart ${svc}`);
    }
  }
}

// ─── Phase 4: Post-clean ────────────────────────────────

function postClean() {
  log("Phase 4: Post-clean");
  gc();
  log(`Final memory: ${freeMB()} MB free`);

  // Remove large build-internal caches that aren't needed for runtime
  const cacheDirs = [
    resolve(DOT_NEXT, "cache"),
    resolve(DOT_NEXT, "server", "pages"),
  ];
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

// ─── Main ───────────────────────────────────────────────

async function main() {
  log("=== Smart Build for low-RAM host ===");
  log(`CPU cores: ${cpus().length}, Total RAM: ${totalMB()} MB`);

  // Free memory by temporarily stopping heavy sidecar services
  stopHeavyServices();

  preClean();

  if (!memoryCheck()) {
    log("FATAL: Insufficient memory to build. Restarting services and aborting.");
    restartHeavyServices();
    process.exit(1);
  }

  // Attempt 1: Turbopack at 1024 MB
  let ok = await tryBuild(1024);
  if (ok) {
    log("Build successful with Turbopack at 1024 MB!");
    postClean();
    restartHeavyServices();
    process.exit(0);
  }

  log("Build failed. Retrying with Turbopack at 768 MB...");
  preClean();

  // Attempt 2: Turbopack at 768 MB
  ok = await tryBuild(768);
  if (ok) {
    log("Build successful with Turbopack at 768 MB!");
    postClean();
    restartHeavyServices();
    process.exit(0);
  }

  log("Build failed. Retrying with webpack at 1024 MB...");
  preClean();

  // Attempt 3: Webpack at 1024 MB
  ok = await tryBuildWebpack(1024);
  if (ok) {
    log("Build successful with webpack at 1024 MB!");
    postClean();
    restartHeavyServices();
    process.exit(0);
  }

  log("Build failed. Retrying with webpack at 768 MB...");
  preClean();

  // Attempt 4: Webpack at 768 MB
  ok = await tryBuildWebpack(768);
  if (ok) {
    log("Build successful with webpack at 768 MB!");
    postClean();
    process.exit(0);
  }

  log("FATAL: All build attempts failed.");
  restartHeavyServices();
  process.exit(1);
}

main().catch((err) => {
  log(`Unhandled error: ${err.message}`);
  process.exit(1);
});
