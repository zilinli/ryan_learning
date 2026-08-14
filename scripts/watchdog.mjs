#!/usr/bin/env node
/**
 * spark-watchdog.mjs — Spark 系统守护进程（开机自启 + 自我修复）
 *
 * 职责：
 *   1. 周期性健康检查：spark-tutor(:3000)、spark-acc(:3001)、spark-stt(:8765)、.next 生产构建
 *   2. 确定性自愈（不依赖 LLM，快速恢复已知故障）：
 *      - 服务无响应 → systemctl/pm2 拉起
 *      - .next/BUILD_ID 缺失 → 触发 npm run build（smart-build，安全 stash）
 *      - PM2 无限 crash-loop 检测（restart 计数暴涨）→ 修复或升级 LLM
 *      - 磁盘空间不足 → 清理 PM2 日志
 *   3. LLM 升级修复（确定性方案失败时）：通过 Cursor SDK Agent.prompt 把诊断上下文
 *      发给大模型，由模型分析根因并返回修复动作，守护进程按白名单执行。
 *   4. 开机自启：由 spark-watchdog.service (systemd, multi-user.target) 拉起。
 *
 * 安全边界：
 *   - LLM 只读诊断；修复动作必须命中 ACTION_WHITELIST，否则拒绝执行并告警。
 *   - 每个修复动作带冷却时间，避免故障风暴下无限重启。
 *   - 日志写 logs/watchdog.log，滚动保留最近 N 条。
 *
 * 用法：
 *   node scripts/watchdog.mjs            # 前台运行（systemd Type=simple 使用）
 *   node scripts/watchdog.mjs --once     # 单次检查（诊断/手动测试用）
 */

import { execFileSync, spawn } from "node:child_process";
import { promises as fs, statSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "watchdog.log");
const STATE_FILE = path.join(LOG_DIR, "watchdog-state.json");
const BUILD_ID_FILE = path.join(ROOT, ".next", "BUILD_ID");

const INTERVAL_MS = Number(process.env.WATCHDOG_INTERVAL_MS || 30_000);
const CHECK_TIMEOUT_MS = Number(process.env.WATCHDOG_CHECK_TIMEOUT_MS || 8_000);
const RECOVERY_COOLDOWN_MS = Number(process.env.WATCHDOG_RECOVERY_COOLDOWN_MS || 60_000);
const LLM_COOLDOWN_MS = Number(process.env.WATCHDOG_LLM_COOLDOWN_MS || 15 * 60_000);
const MAX_LOG_LINES = 5000;
const DISK_MIN_MB = Number(process.env.WATCHDOG_DISK_MIN_MB || 2048);
const MAX_CRASH_RESTARTS = Number(process.env.WATCHDOG_MAX_CRASH_RESTARTS || 10);

const API_KEY = process.env.CURSOR_API_KEY?.trim() || "";
const CURSOR_MODEL = process.env.WATCHDOG_CURSOR_MODEL || "composer-2.5";

/** 尝试从 agent-chat/.env.local 加载 CURSOR_API_KEY（systemd 用 EnvironmentFile，这里兜底）。 */
function loadApiKey() {
  if (API_KEY) return API_KEY;
  try {
    const envFile = path.join(ROOT, "agent-chat", ".env.local");
    const raw = fs.readFileSync(envFile, "utf8");
    for (const line of raw.split("\n")) {
      const m = /^CURSOR_API_KEY\s*=\s*(.+)\s*$/.exec(line.trim());
      if (m) return m[1].trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

const SERVICES = [
  { name: "spark", port: 3000, unit: null, pm2: "spark-tutor", url: "http://127.0.0.1:3000/api/setup", check: (d) => d?.configured === true || d?.status === "ok" || d?.ok === true },
  { name: "acc", port: 3001, unit: "spark-acc.service", pm2: null, url: "http://127.0.0.1:3001/api/setup", check: (d) => d?.ok === true },
  { name: "stt", port: 8765, unit: "spark-stt.service", pm2: null, url: "http://127.0.0.1:8765/health", check: (d) => d?.ok === true },
];

/** 只有这些动作允许 LLM 建议并被执行。 */
const ACTION_WHITELIST = new Set([
  "restart_service",   // systemctl restart <unit>
  "restart_pm2",       // pm2 restart <app>
  "rebuild_next",      // npm run build（smart-build 安全重建）
  "trim_pm2_logs",     // 截断超大 PM2 日志
  "purge_tmp",         // 清理 /tmp 下的 Spark 临时文件
  "notify_admin",      // 仅记录，不执行（标记需人工介入）
]);

function log(...parts) {
  const line = `[watchdog ${new Date().toISOString()}] ${parts.join(" ")}`;
  console.log(line);
  try {
    fs.appendFile(LOG_FILE, line + "\n");
  } catch {
    /* ignore */
  }
}

function truncateLog() {
  try {
    const lines = readFileSync(LOG_FILE, "utf8").split("\n");
    if (lines.length > MAX_LOG_LINES) {
      writeFileSync(LOG_FILE, lines.slice(lines.length - MAX_LOG_LINES).join("\n") + "\n");
    }
  } catch {
    /* ignore */
  }
}

async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { lastRecovery: {}, lastLlm: 0, llmCount: 0 };
  }
}

async function writeState(state) {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    log(`state write failed: ${err.message}`);
  }
}

async function probe(svc) {
  const started = Date.now();
  try {
    const res = await fetch(svc.url, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 120) };
    }
    const healthy = res.ok && svc.check(data);
    return { name: svc.name, healthy, status: res.status, latencyMs: Date.now() - started };
  } catch (err) {
    return { name: svc.name, healthy: false, status: 0, latencyMs: Date.now() - started, detail: err.name === "TimeoutError" ? "timeout" : err.message };
  }
}

function buildIdPresent() {
  try {
    const s = statSync(BUILD_ID_FILE);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

function runCmd(bin, args, opts = {}) {
  try {
    const out = execFileSync(bin, args, {
      encoding: "utf8",
      timeout: opts.timeout || 30_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...(opts.env || {}) },
    });
    return { ok: true, stdout: (out || "").trim(), stderr: "" };
  } catch (err) {
    return {
      ok: false,
      stdout: (err.stdout || "").toString().trim(),
      stderr: (err.stderr || err.message || "").toString().slice(0, 500).trim(),
    };
  }
}

/** 读取 spark-tutor 的 PM2 restart 计数。 */
function pm2RestartCount(appName) {
  const r = runCmd("npx", ["pm2", "jlist", "--silent"], { timeout: 10_000 });
  if (!r.ok) return -1;
  try {
    const list = JSON.parse(r.stdout);
    const app = list.find((a) => a.name === appName);
    return app?.pm2_env?.restart_time ?? -1;
  } catch {
    return -1;
  }
}

/** 磁盘剩余 MB。 */
function diskFreeMb(dir = ROOT) {
  try {
    const out = execFileSync("df", ["-k", "--output=avail", dir], { encoding: "utf8" });
    const mb = Number(out.trim().split("\n").pop()) / 1024;
    return Math.round(mb);
  } catch {
    return Infinity;
  }
}

/** 可用内存 MB。 */
function memAvailableMb() {
  try {
    const out = execFileSync("free", ["-m"], { encoding: "utf8" });
    const line = out.split("\n").find((l) => l.startsWith("Mem:"));
    const cols = line ? line.trim().split(/\s+/) : [];
    return Number(cols[6] ?? Infinity);
  } catch {
    return Infinity;
  }
}

function restartSystemd(unit) {
  log(`deterministic: systemctl restart ${unit}`);
  const r = runCmd("systemctl", ["restart", unit], { timeout: 30_000 });
  if (!r.ok) log(`systemctl restart ${unit} failed: ${r.stderr}`);
  return r.ok;
}

function restartPm2(app) {
  log(`deterministic: pm2 restart ${app}`);
  const r = runCmd("npx", ["pm2", "restart", app], { timeout: 20_000 });
  if (!r.ok) log(`pm2 restart ${app} failed: ${r.stderr}`);
  return r.ok;
}

/** 触发重建（smart-build，安全 stash/restore）。完成后延迟确认 BUILD_ID。 */
function rebuildNext() {
  log("deterministic: rebuild .next via npm run build");
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", "build"], {
      cwd: ROOT,
      stdio: "ignore",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
    child.on("close", async (code) => {
      // smart-build 成功退出后文件系统才完全落盘，稍等再确认 BUILD_ID。
      await new Promise((r) => setTimeout(r, 3000));
      const ok = code === 0 && buildIdPresent();
      log(ok ? "rebuild succeeded" : `rebuild failed (exit ${code}, buildIdPresent=${buildIdPresent()})`);
      resolve(ok);
    });
    child.on("error", (err) => {
      log(`rebuild spawn error: ${err.message}`);
      resolve(false);
    });
  });
}

function trimPm2Logs() {
  const r = runCmd("npx", ["pm2", "flush"], { timeout: 20_000 });
  log(r.ok ? "pm2 logs flushed" : `pm2 flush failed: ${r.stderr}`);
  return r.ok;
}

/** 构建诊断上下文，用于 LLM 咨询。 */
async function buildDiagnostics() {
  const diag = {
    time: new Date().toISOString(),
    buildIdPresent: buildIdPresent(),
    memAvailableMb: memAvailableMb(),
    diskFreeMb: diskFreeMb(),
    services: await Promise.all(SERVICES.map((s) => probe(s))),
    pm2: {
      sparkTutorRestarts: pm2RestartCount("spark-tutor"),
    },
    systemd: {
      acc: runCmd("systemctl", ["is-active", "spark-acc.service"], { timeout: 5_000 }).stdout,
      stt: runCmd("systemctl", ["is-active", "spark-stt.service"], { timeout: 5_000 }).stdout,
      watchdog: runCmd("systemctl", ["is-active", "spark-watchdog.service"], { timeout: 5_000 }).stdout,
    },
    recentTutorErrors: tailFile(path.join(process.env.HOME || "/root", ".pm2/logs/spark-tutor-error.log"), 30),
    recentTutorOut: tailFile(path.join(process.env.HOME || "/root", ".pm2/logs/spark-tutor-out.log"), 15),
    recentAccLog: tailFile(path.join(ROOT, "logs/agent-chat.log"), 15),
    recentWatchdog: tailFile(LOG_FILE, 10),
  };
  return diag;
}

function tailFile(file, n) {
  try {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(Math.max(0, lines.length - n)).join("\n");
  } catch {
    return "";
  }
}

/**
 * LLM 升级修复：把诊断上下文发给大模型，模型返回建议动作（JSON）。
 * 动作必须命中 ACTION_WHITELIST 才会被执行。
 */
async function llmConsult(diag) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    log("llm: no CURSOR_API_KEY — skipping consultation");
    return [];
  }
  log("llm: consulting large model for diagnosis...");
  const prompt = [
    "You are the on-call SRE for the Spark learning platform running on a 4GB QEMU VM.",
    "The system watchdog detected a service failure that deterministic recovery could not resolve.",
    "Analyze the diagnostics below, find the root cause, and return a JSON object (and only JSON):",
    '{"summary":"one-sentence root cause","actions":[{"action":"<whitelisted action>","target":"<target>","reason":"why"}],"note":"optional extra explanation"}',
    "",
    "Whitelisted actions (use ONLY these exact strings):",
    '  "restart_service"  -> target: a systemd unit name (e.g. spark-acc.service)',
    '  "restart_pm2"      -> target: a pm2 app name (e.g. spark-tutor)',
    '  "rebuild_next"     -> target: "" (rebuild .next production bundle)',
    '  "trim_pm2_logs"    -> target: ""',
    '  "purge_tmp"        -> target: ""',
    '  "notify_admin"     -> target: "" (no action, human needed)',
    "",
    "Remember this host only has ~4GB RAM. If memory is critically low, prefer trim_pm2_logs / restart_pm2 over rebuild_next.",
    "DIAGNOSTICS (JSON):",
    JSON.stringify(diag, null, 2),
  ].join("\n");

  try {
    const sdk = await import("@cursor/sdk");
    const { Agent } = sdk;
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: CURSOR_MODEL },
      local: { cwd: ROOT, settingSources: [] },
    });

    if (result.status !== "finished") {
      log(`llm: run not finished (status=${result.status})`);
      return [];
    }
    const text = typeof result.result === "string" ? result.result : JSON.stringify(result.result || "");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log(`llm: no JSON in model output: ${text.slice(0, 300)}`);
      return [];
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    log(`llm: model verdict — ${parsed.summary || "no summary"} (${actions.length} actions)`);
    return actions
      .filter((a) => ACTION_WHITELIST.has(a.action))
      .map((a) => ({ action: a.action, target: String(a.target || ""), reason: String(a.reason || "") }));
  } catch (err) {
    log(`llm: consultation failed: ${err.message}`);
    return [];
  }
}

/** 执行单个白名单动作。返回是否成功。 */
async function executeAction(action, state) {
  const key = `${action.action}:${action.target}`;
  const cooldownKey = action.action;
  const now = Date.now();
  const last = state.lastRecovery[cooldownKey] || 0;
  if (now - last < RECOVERY_COOLDOWN_MS) {
    log(`action ${key} skipped (in cooldown)`);
    return true;
  }
  log(`action: ${key} — ${action.reason || ""}`);

  let ok = false;
  switch (action.action) {
    case "restart_service":
      ok = restartSystemd(action.target);
      break;
    case "restart_pm2":
      ok = restartPm2(action.target);
      break;
    case "rebuild_next":
      ok = await rebuildNext();
      break;
    case "trim_pm2_logs":
      ok = trimPm2Logs();
      break;
    case "purge_tmp":
      ok = purgeTmp();
      break;
    case "notify_admin":
      ok = true;
      break;
    default:
      log(`action ${key} not in whitelist — rejected`);
      ok = false;
  }
  state.lastRecovery[cooldownKey] = now;
  return ok;
}

function purgeTmp() {
  const r = runCmd("bash", ["-lc", "find /tmp -maxdepth 1 -user root -name 'spark-*' -mtime +1 -delete 2>/dev/null; echo done"], { timeout: 15_000 });
  return r.ok;
}

/**
 * 一轮检查：探测所有服务，对异常项做确定性修复；失败的升级给 LLM。
 */
async function tick(state) {
  const results = await Promise.all(SERVICES.map((s) => probe(s)));
  const buildOk = buildIdPresent();
  const diskMb = diskFreeMb();
  const memMb = memAvailableMb();

  const problems = [];
  for (const r of results) {
    if (!r.healthy) problems.push(`service ${r.name} DOWN (${r.detail || r.status})`);
  }
  if (!buildOk) problems.push(".next/BUILD_ID missing");
  if (diskMb < DISK_MIN_MB) problems.push(`disk low ${diskMb}MB`);
  if (memMb < 300) problems.push(`memory critically low ${memMb}MB`);

  if (problems.length === 0) {
    state.pm2Restarts = pm2RestartCount("spark-tutor");
    log(`all healthy (mem ${memMb}MB, disk ${diskMb}MB)`);
    return;
  }
  log(`problems: ${problems.join("; ")}`);

  // crash-loop 判定：restart 计数相对上一轮的增量暴涨 → 真崩溃循环。
  // 绝对计数可能是历史遗留（比如之前 3315 次循环），不应用作判定。
  const sparkRestarts = pm2RestartCount("spark-tutor");
  const restartDelta = sparkRestarts >= 0 && state.pm2Restarts != null
    ? sparkRestarts - state.pm2Restarts
    : 0;
  const isCrashLoop = sparkRestarts > 0 && restartDelta >= MAX_CRASH_RESTARTS;
  state.pm2Restarts = sparkRestarts;

  // ---- deterministic fixes ----
  const fixed = [];
  for (const r of results) {
    if (r.healthy) continue;
    if (r.name === "spark") {
      if (isCrashLoop) {
        fixed.push(`spark crash-loop (Δ${restartDelta} restarts since last check)`);
      } else {
        fixed.push(restartPm2("spark-tutor") ? "spark pm2 restart ok" : "spark pm2 restart failed");
      }
    } else if (r.name === "acc") {
      fixed.push(restartSystemd("spark-acc.service") ? "acc systemd restart ok" : "acc systemd restart failed");
    } else if (r.name === "stt") {
      fixed.push(restartSystemd("spark-stt.service") ? "stt systemd restart ok" : "stt systemd restart failed");
    }
  }
  if (!buildOk) {
    const rebuilt = await rebuildNext();
    fixed.push(rebuilt ? "build ok" : "build failed");
  }
  if (diskMb < DISK_MIN_MB) {
    fixed.push(trimPm2Logs() ? "logs trimmed" : "log trim failed");
  }

  const anyFailed = fixed.some((f) => f.includes("failed") || f.includes("crash-loop") || f.includes("failed"));
  const notFixed = fixed.length === 0 || anyFailed;

  // ---- LLM escalation ----
  if (notFixed) {
    const now = Date.now();
    if (now - state.lastLlm > LLM_COOLDOWN_MS && state.llmCount < 30) {
      const diag = await buildDiagnostics();
      const actions = await llmConsult(diag);
      if (actions.length === 0) {
        log("llm: no actionable suggestions");
      }
      let anyOk = false;
      for (const a of actions) {
        const ok = await executeAction(a, state);
        if (ok && a.action !== "notify_admin") anyOk = true;
      }
      if (!anyOk) {
        log("llm: no action succeeded — human intervention required (see logs/watchdog.log)");
      }
      state.lastLlm = now;
      state.llmCount += 1;
    } else {
      log(`llm: skipping (cooldown ${(now - state.lastLlm) / 1000}s / count ${state.llmCount})`);
    }
  }
}

async function main() {
  await fs.mkdir(LOG_DIR, { recursive: true }).catch(() => {});
  log(`=== watchdog starting (interval ${INTERVAL_MS}ms, model ${CURSOR_MODEL}) ===`);

  const once = process.argv.includes("--once");
  const state = await readState();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick(state);
      await writeState(state);
      truncateLog();
    } catch (err) {
      log(`tick error: ${err.stack || err.message}`);
    }
    if (once) {
      log("single check complete (--once)");
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((err) => {
  log(`fatal: ${err.stack || err.message}`);
  process.exit(1);
});
