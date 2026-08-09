import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SDKCustomTool, SDKJsonValue } from "@cursor/sdk";

const GIT_TO = 15000;
const RUN_TO = 30000;
const TEST_TO = 60000;
const BUILD_TO = 240000;

/** Raised from 5 — complex design/implement prompts need more edits. */
export const MAX_EDITS_PER_SESSION = 15;

let _root: string | undefined;
function root(): string {
  return _root ?? (_root = path.resolve(process.cwd()));
}

let _bak: string | undefined;
function bakDir(): string {
  return _bak ?? (_bak = path.join(root(), ".console-backups"));
}

function forbidden(): string[] {
  const r = root();
  return [
    path.join(r, ".git"),
    path.join(r, "node_modules"),
    path.join(r, ".env"),
    path.join(r, ".env.local"),
    path.join(r, ".console-backups"),
    path.join(r, "data"),
    path.join(r, "config", "secret"),
  ];
}

function as(v: SDKJsonValue | undefined, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

function safe(fp: string): string {
  const r = root();
  const rp = path.resolve(r, fp);
  if (!rp.startsWith(r + path.sep) && rp !== r) throw new Error("Forbidden: " + fp);
  for (const f of forbidden()) {
    if (rp.startsWith(f + path.sep) || rp === f) throw new Error("Forbidden: " + fp);
  }
  if (path.basename(rp).startsWith(".env")) throw new Error("Forbidden: " + fp);
  return rp;
}

function exe(
  cmd: string,
  args: string[],
  opts: { timeout?: number; cwd?: string } = {},
) {
  const to = opts.timeout ?? RUN_TO;
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const c = spawn(cmd, args, {
      cwd: opts.cwd ?? root(),
      timeout: to,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let o = "";
    let e = "";
    c.stdout.on("data", (d: Buffer) => {
      o += d.toString();
    });
    c.stderr.on("data", (d: Buffer) => {
      e += d.toString();
    });
    c.on("close", (code) =>
      resolve({ stdout: o.slice(0, 100000), stderr: e.slice(0, 100000), exitCode: code ?? 1 }),
    );
    c.on("error", () => resolve({ stdout: o, stderr: e, exitCode: 1 }));
  });
}

let chg = 0;
export function resetFileChangeCount() {
  chg = 0;
}
export function getFileChangeCount() {
  return chg;
}

function inc() {
  chg++;
  if (chg > MAX_EDITS_PER_SESSION) {
    throw new Error(`Max ${MAX_EDITS_PER_SESSION} edits/session`);
  }
}

async function ensureBak() {
  await fs.mkdir(bakDir(), { recursive: true });
}

function bok(fp: string) {
  return path.join(
    bakDir(),
    createHash("sha256").update(path.relative(root(), fp)).digest("hex").slice(0, 12) +
      "_" +
      Date.now() +
      "_" +
      path.basename(fp),
  );
}

async function readFile(args: Record<string, SDKJsonValue>): Promise<string> {
  const fp = safe(as(args.filepath));
  const c = await fs.readFile(fp, "utf-8");
  const ls = c.split("\n");
  if (ls.length > 5000) {
    const h = 2500;
    return [...ls.slice(0, h), "...[truncated]", ...ls.slice(-h)].join("\n");
  }
  return ls.map((l, i) => String(i + 1).padStart(6) + "|" + l).join("\n");
}

async function searchCode(args: Record<string, SDKJsonValue>): Promise<string> {
  const a = ["-n", "--no-heading", "--hidden", "--no-ignore"];
  const g = as(args.glob || "");
  if (g) a.push("--glob", g);
  a.push("--", as(args.query), root());
  const { stdout, exitCode } = await exe("rg", a, { timeout: 10000 });
  if (exitCode !== 0 && !stdout.trim()) return "No matches found.";
  return stdout.trim().split("\n").slice(0, 30).join("\n") || "No matches found.";
}

async function editFile(args: Record<string, SDKJsonValue>): Promise<string> {
  inc();
  const fp = safe(as(args.filepath));
  const old = as(args.old_string);
  const nw = as(args.new_string);
  if (!old) throw new Error("old_string required");
  if (old === nw) throw new Error("must differ");
  if ((await fs.stat(fp)).size > 400000) throw new Error("Too large");
  const c = await fs.readFile(fp, "utf-8");
  const n = c.split(old).length - 1;
  if (n === 0) throw new Error("not found");
  if (n > 1) throw new Error("appears " + n + " times");
  await ensureBak();
  await fs.writeFile(bok(fp), c, "utf-8");
  const up = c.replace(old, nw);
  await fs.writeFile(fp, up, "utf-8");
  const rel = path.relative(root(), fp);
  await exe("git", ["add", "--", rel], { timeout: GIT_TO });
  const ad = (up.match(/\n/g) || []).length - (c.match(/\n/g) || []).length;
  const rm = (c.match(/\n/g) || []).length - (up.match(/\n/g) || []).length;
  return "Edited " + rel + " (+" + Math.max(0, ad) + " -" + Math.max(0, rm) + ")";
}

async function runTests(args: Record<string, SDKJsonValue>): Promise<string> {
  const a = [
    "vitest",
    "run",
    "--reporter=verbose",
    "--exclude",
    "src/lib/console-harness.test.ts",
  ];
  const f = as(args.file || "");
  if (f) a.push(f);
  const { stdout, stderr } = await exe("npx", a, { timeout: TEST_TO });
  const o = stdout + stderr;
  let p = 0;
  let fl = 0;
  const pm = o.match(/(\d+)\s+tests?\s+passed/);
  if (pm) p = Number(pm[1]);
  const fm = o.match(/(\d+)\s+tests?\s+failed/);
  if (fm) fl = Number(fm[1]);
  return JSON.stringify({ passed: p, failed: fl, total: p + fl, output: o.slice(-4000) });
}

async function gitDiff(): Promise<string> {
  const { stdout: c } = await exe("git", ["diff", "--cached", "--unified=3"], {
    timeout: GIT_TO,
  });
  const { stdout: s } = await exe("git", ["diff", "--unified=3"], { timeout: GIT_TO });
  return (c + "\n" + s).trim() || "No uncommitted changes.";
}

async function applyChanges(args: Record<string, SDKJsonValue>): Promise<string> {
  const tr = await runTests({});
  const td = JSON.parse(tr) as { failed: number };
  if (td.failed > 0) throw new Error("Tests failed (" + td.failed + ")");
  const { stdout: st } = await exe("git", ["status", "--porcelain"], { timeout: GIT_TO });
  if (!st.trim()) return "No changes.";
  await exe(
    "git",
    [
      "add",
      "-A",
      "--",
      ":(exclude).git",
      ":(exclude)node_modules",
      ":(exclude).env*",
      ":(exclude).console-backups",
    ],
    { timeout: GIT_TO },
  );
  const { stdout: co, stderr: ce } = await exe(
    "git",
    ["commit", "-m", as(args.message) || "Console: apply"],
    { timeout: GIT_TO },
  );
  resetFileChangeCount();
  return (
    (co + ce || "Applied.") +
    "\nNote: commit does NOT update the live site — call deploy_live after src/ changes."
  );
}

/**
 * Rebuild Next.js production bundle and restart PM2 spark-tutor.
 * Required for live UX: npm start serves .next, not raw TypeScript sources.
 */
async function deployLive(_args: Record<string, SDKJsonValue>): Promise<string> {
  if (process.env.CONSOLE_DEPLOY_DRY_RUN === "1") {
    return JSON.stringify({
      ok: true,
      dryRun: true,
      steps: ["npm run build", "pm2 restart spark-tutor", "GET /"],
    });
  }

  const build = await exe("npm", ["run", "build"], { timeout: BUILD_TO });
  if (build.exitCode !== 0) {
    return JSON.stringify({
      ok: false,
      phase: "build",
      exitCode: build.exitCode,
      log: (build.stdout + build.stderr).slice(-6000),
    });
  }

  const restart = await exe("pm2", ["restart", "spark-tutor"], { timeout: 30000 });
  if (restart.exitCode !== 0) {
    return JSON.stringify({
      ok: false,
      phase: "restart",
      exitCode: restart.exitCode,
      log: (restart.stdout + restart.stderr).slice(-2000),
    });
  }

  await new Promise((r) => setTimeout(r, 2500));
  const health = await exe(
    "curl",
    ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:3000/"],
    { timeout: 15000 },
  );
  const http = health.stdout.trim();
  return JSON.stringify({
    ok: http === "200",
    phase: "done",
    http,
    buildTail: (build.stdout + build.stderr).slice(-1500),
    restartTail: (restart.stdout + restart.stderr).slice(-800),
  });
}

async function revertChanges(): Promise<string> {
  await exe("git", ["checkout", "--", "."], { timeout: GIT_TO });
  await exe(
    "git",
    ["clean", "-fd", "--", ":(exclude).git", ":(exclude)node_modules", ":(exclude).env*"],
    { timeout: GIT_TO },
  );
  resetFileChangeCount();
  try {
    await fs.rm(bakDir(), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return "Reverted.";
}

async function listFiles(args: Record<string, SDKJsonValue>): Promise<string> {
  const d = safe(as(args.dirpath) || ".");
  const e = await fs.readdir(d, { withFileTypes: true });
  return (
    e
      .filter((x) => !x.name.startsWith(".") || x.name === ".gitignore")
      .sort((a, b) =>
        a.isDirectory() && !b.isDirectory()
          ? -1
          : !a.isDirectory() && b.isDirectory()
            ? 1
            : a.name.localeCompare(b.name),
      )
      .map((x) => (x.isDirectory() ? x.name + "/" : x.name))
      .join("\n") || "(empty)"
  );
}

function tool(
  desc: string,
  schema: Record<string, SDKJsonValue>,
  fn: (a: Record<string, SDKJsonValue>) => Promise<string>,
): SDKCustomTool {
  return { description: desc, inputSchema: schema, execute: (a) => fn(a) };
}

let _c: Record<string, SDKCustomTool> | null = null;

/** Test helper — clear cached tool map after harness changes. */
export function resetConsoleHarnessToolsCache() {
  _c = null;
}

export function createConsoleHarnessTools(): Record<string, SDKCustomTool> {
  if (_c) return _c;
  return (_c = {
    read_file: tool(
      "Read file with line numbers.",
      { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] },
      readFile,
    ),
    search_code: tool(
      "Search codebase with ripgrep.",
      {
        type: "object",
        properties: { query: { type: "string" }, glob: { type: "string" } },
        required: ["query"],
      },
      searchCode,
    ),
    edit_file: tool(
      "String replacement in a file.",
      {
        type: "object",
        properties: {
          filepath: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
        },
        required: ["filepath", "old_string", "new_string"],
      },
      editFile,
    ),
    run_tests: tool(
      "Run vitest tests.",
      { type: "object", properties: { file: { type: "string" } }, required: [] },
      runTests,
    ),
    git_diff: tool("Show uncommitted diff.", { type: "object", properties: {}, required: [] }, gitDiff),
    apply_changes: tool(
      "Commit changes (tests must pass first). Does NOT update live site — use deploy_live.",
      { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
      applyChanges,
    ),
    deploy_live: tool(
      "Rebuild production .next (npm run build) and pm2 restart spark-tutor, then health-check. REQUIRED after src/ changes so the live site updates. Dry-run when CONSOLE_DEPLOY_DRY_RUN=1.",
      { type: "object", properties: {}, required: [] },
      deployLive,
    ),
    revert_changes: tool(
      "Undo all uncommitted changes.",
      { type: "object", properties: {}, required: [] },
      revertChanges,
    ),
    list_files: tool(
      "List directory contents.",
      { type: "object", properties: { dirpath: { type: "string" } }, required: ["dirpath"] },
      listFiles,
    ),
  });
}
