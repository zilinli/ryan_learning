#!/usr/bin/env node
/**
 * Cross-platform OpenClaw assistant install entry.
 * Syncs openclaw-config, skills, workbench to ~/.openclaw
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { execSync } from "node:child_process";
import { buildConfig } from "./scripts/merge-config.mjs";
import { mergeSkills } from "./scripts/merge-skills.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_SRC = path.join(__dirname, "openclaw-config");

function home() {
  return os.homedir();
}

function openclawDir() {
  return path.join(home(), ".openclaw");
}

function platformKey() {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  throw new Error(`unsupported platform: ${process.platform}`);
}

function copyDir(src, dst, skip = []) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(name.name)) continue;
    const s = path.join(src, name.name);
    const d = path.join(dst, name.name);
    if (name.isDirectory()) copyDir(s, d, skip);
    else cpSync(s, d);
  }
}

function syncWorkspaceDocs() {
  const wsSrc = path.join(CONFIG_SRC, "workspace");
  const wsDst = path.join(openclawDir(), "workspace");
  mkdirSync(wsDst, { recursive: true });
  for (const f of ["AGENTS.md", "WEIXIN_COMMANDS.md", "HEARTBEAT.md", "IDENTITY.md", "SOUL.md", "TOOLS.md", "USER.md"]) {
    const p = path.join(wsSrc, f);
    if (existsSync(p)) cpSync(p, path.join(wsDst, f));
  }
  const memSrc = path.join(wsSrc, "memory");
  const memDst = path.join(wsDst, "memory");
  if (existsSync(memSrc)) {
    mkdirSync(memDst, { recursive: true });
    copyDir(memSrc, memDst);
  }
  mergeSkills(path.join(wsDst, "skills"));
}

function syncCursor() {
  const src = path.join(CONFIG_SRC, "cursor");
  const dst = path.join(openclawDir(), "cursor");
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  copyDir(src, dst);
}

function syncWorkbench() {
  const src = path.join(CONFIG_SRC, "workbench");
  const dst = path.join(home(), "openclaw-workbench");
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  if (existsSync(dst)) {
    for (const name of readdirSync(dst)) {
      if (["history.json", "workbench.log", "sessions.json", "workbench.pid"].includes(name)) continue;
      const p = path.join(dst, name);
      rmSync(p, { recursive: true, force: true });
    }
  }
  copyDir(src, dst, ["start.sh", "stop.sh", "start.ps1", "stop.ps1"]);
}

function ensureDirs() {
  const oc = openclawDir();
  const dirs = [
    oc,
    path.join(oc, "workspace"),
    path.join(oc, "cursor"),
    path.join(oc, "agents", "coder", "workspace"),
    path.join(oc, "agents", "coder", "agent"),
    path.join(oc, "agents", "office", "workspace"),
    path.join(oc, "agents", "office", "agent"),
    path.join(home(), "tasks"),
    path.join(home(), "openclaw-costs"),
    path.join(home(), "openclaw-workbench"),
  ];
  for (const d of dirs) mkdirSync(d, { recursive: true });
}

function runPlatformExtras() {
  const plat = platformKey();
  const scriptDir = path.join(__dirname, "platforms", plat);
  if (process.platform === "win32") {
    const ps1 = path.join(scriptDir, "install.ps1");
    if (existsSync(ps1)) {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, { stdio: "inherit" });
    }
    return;
  }
  const sh = path.join(scriptDir, "install.sh");
  if (existsSync(sh)) {
    execSync(`bash "${sh}"`, { stdio: "inherit" });
  }
}

export function installAssistant() {
  console.log("[assistant] platform:", platformKey());
  ensureDirs();
  console.log("[assistant] merging openclaw.json...");
  buildConfig(platformKey());
  for (const extra of ["openclaw.json.bak", "openclaw.json.last-good"]) {
    const p = path.join(CONFIG_SRC, extra);
    if (existsSync(p)) cpSync(p, path.join(openclawDir(), extra));
  }
  console.log("[assistant] syncing workspace + skills...");
  syncWorkspaceDocs();
  console.log("[assistant] syncing cursor...");
  syncCursor();
  console.log("[assistant] syncing workbench...");
  syncWorkbench();
  console.log("[assistant] platform extras...");
  runPlatformExtras();
  console.log("[assistant] done.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  installAssistant();
}
