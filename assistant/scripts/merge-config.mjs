#!/usr/bin/env node
/**
 * Merge openclaw.base.json + overlays/{platform}.json → openclaw.json
 * Substitutes ${OPENCLAW_DIR}, ${TASKS_DIR}, etc.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSISTANT_ROOT = path.resolve(__dirname, "..");
const CONFIG_DIR = path.join(ASSISTANT_ROOT, "openclaw-config");

function deepMerge(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return b;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = k in out ? deepMerge(out[k], v) : v;
    }
    return out;
  }
  return b !== undefined ? b : a;
}

function platformKey() {
  const p = process.platform;
  if (p === "darwin") return "darwin";
  if (p === "win32") return "win32";
  throw new Error(`unsupported platform: ${p}`);
}

function homeDir() {
  return os.homedir();
}

function openclawDir() {
  return path.join(homeDir(), ".openclaw");
}

function tasksDir() {
  return path.join(homeDir(), "tasks");
}

function documentsDir() {
  const home = homeDir();
  if (process.platform === "win32") {
    const userProfile = process.env.USERPROFILE || home;
    return path.join(userProfile, "Documents");
  }
  return path.join(home, "Documents");
}

function mcpFilesystemJs() {
  if (process.platform === "win32") return "";
  const candidates = [
    "/usr/local/lib/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js",
    path.join(homeDir(), ".npm-global/lib/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

function npxCmd() {
  if (process.platform !== "win32") return "npx";
  const nodeRoot = path.dirname(process.execPath);
  const npx = path.join(nodeRoot, "npx.cmd");
  return existsSync(npx) ? npx.replace(/\\/g, "/") : "npx.cmd";
}

function cliclickPath() {
  return path.join(homeDir(), "bin", "cliclick");
}

function substitute(obj, vars) {
  if (typeof obj === "string") {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] ?? `\${${key}}`);
  }
  if (Array.isArray(obj)) return obj.map((x) => substitute(x, vars));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = substitute(v, vars);
    return out;
  }
  return obj;
}

export function buildConfig(platform = platformKey(), outPath) {
  const base = JSON.parse(readFileSync(path.join(CONFIG_DIR, "openclaw.base.json"), "utf8"));
  const overlayPath = path.join(CONFIG_DIR, "overlays", `${platform}.json`);
  const overlay = existsSync(overlayPath)
    ? JSON.parse(readFileSync(overlayPath, "utf8"))
    : {};
  const merged = deepMerge(base, overlay);

  const oc = openclawDir().replace(/\\/g, process.platform === "win32" ? "/" : "/");
  const vars = {
    OPENCLAW_DIR: oc,
    TASKS_DIR: tasksDir().replace(/\\/g, "/"),
    DOCUMENTS_DIR: documentsDir().replace(/\\/g, "/"),
    MCP_FILESYSTEM_JS: mcpFilesystemJs(),
    NPX_CMD: npxCmd(),
    CLICLICK_PATH: cliclickPath().replace(/\\/g, "/"),
    HOME: homeDir().replace(/\\/g, "/"),
  };

  const cfg = substitute(merged, vars);
  const dest = outPath || path.join(openclawDir(), "openclaw.json");
  writeFileSync(dest, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  return dest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  const platform = process.argv[3] || platformKey();
  const dest = buildConfig(platform, out);
  console.log(`Wrote ${dest}`);
}
