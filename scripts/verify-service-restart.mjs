#!/usr/bin/env node
/**
 * verify-service-restart.mjs — integration test for the restart flow.
 * 1. Confirms services are up (if down, tries restart first).
 * 2. Stops all Spark services.
 * 3. Runs scripts/restart-services.sh full.
 * 4. Verifies every health check passes.
 *
 * Exit 0 = pass, 1 = fail.
 * Usage: node scripts/verify-service-restart.mjs [--keep-running]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVICES = ["spark-stt", "spark-tutor", "spark-acc"];

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function sh(cmd, opts = {}) {
  const r = spawnSync(cmd, { shell: true, cwd: ROOT, encoding: "utf8", timeout: 60_000, ...opts });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
}

function healthJson(service) {
  const r = sh(`node scripts/health-check.mjs --service=${service} --json`);
  if (r.code !== 0) return null;
  try { return JSON.parse(r.out); } catch { return null; }
}

async function main() {
  const keepRunning = process.argv.includes("--keep-running");
  console.log("=== Service restart integration test ===\n");

  // Preflight: do systemd units exist?
  for (const s of SERVICES) {
    const unit = `/etc/systemd/system/${s}.service`;
    ok(`${s} unit installed`, existsSync(unit), unit);
  }

  // Ensure ACC unit is registered/startable
  sh("systemctl daemon-reload");
  sh("systemctl enable spark-acc.service >/dev/null 2>&1");

  // Initial health baseline (don't fail if first boot — try restart)
  const baseline = healthJson("acc");
  if (!baseline) {
    console.log("\nServices not running — will attempt restart via script...\n");
    const rr = sh("bash scripts/restart-services.sh full", { timeout: 15 * 60_000 });
    ok("restart script ran", rr.code === 0, rr.err ? rr.err.slice(-200) : "");
  }

  const before = healthJson("stt");
  if (before?.healthy !== true) {
    console.log("WARN  pre-test stt not healthy — restart will recover it");
  } else {
    ok("pre-test stt healthy", true);
  }

  // 1. Stop everything
  console.log("\nStopping all services...");
  for (const s of SERVICES) sh(`systemctl stop ${s}.service`);
  await new Promise((r) => setTimeout(r, 2000));

  const downStt = healthJson("stt");
  ok("stopped — stt down", downStt === null || downStt.healthy !== true);

  // 2. Run restart script
  console.log("\nRunning restart-services.sh full...");
  const r = sh("bash scripts/restart-services.sh full", { timeout: 20 * 60_000 });
  ok("restart script exit 0", r.code === 0, r.err ? r.err.slice(-200) : "");
  if (r.code !== 0) {
    console.error("\n--- restart output (last 80 lines) ---\n" + r.out.split("\n").slice(-80).join("\n"));
  }

  // 3. Verify all health checks
  console.log("\nPost-restart health:");
  const full = sh("node scripts/health-check.mjs", { timeout: 90_000 });
  ok("all services healthy", full.code === 0, "");
  console.log(full.out);

  if (!keepRunning) {
    console.log("\n(services left running; --keep-running not passed → services still up)");
  }

  console.log(failed === 0 ? "\n=== ALL PASS ===" : `\n=== ${failed} FAILED ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
