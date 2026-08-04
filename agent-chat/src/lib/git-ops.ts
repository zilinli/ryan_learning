import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface TestRunResult {
  pass: boolean;
  exitCode: number;
  stderr: string;
  durationMs: number;
}

export interface CommitResult {
  committed: boolean;
  sha?: string;
  message?: string;
  skippedReason?: string;
  testResult?: "pass" | "fail" | "skipped";
  testDetail?: string;
}

export interface GitOpsOptions {
  /** Branch to push to. Default: process.env.AUTO_GIT_BRANCH || "develop" */
  branch?: string;
  /** Test command executed in workspace. Default: process.env.AUTO_GIT_TEST_CMD || "npm test" */
  testCommand?: string;
  /** Timeout for the test command in ms. Default 120_000 */
  testTimeoutMs?: number;
  /** Auto-git master switch. Default: process.env.AUTO_GIT_ENABLED === "1" */
  enabled?: boolean;
}

const FILE_TOOL_RE =
  /^(Write|StrReplace|Edit|createFile|create_file|writeFile|write_file|editFile|edit_file|applyEdit|apply_edit|updateFile|update_file)$/i;
const PATH_KEYS = ["path", "filePath", "file_path", "file", "filename"];

/** Extract a file path from a tool-call input object if it looks like a file edit. */
function pathFromInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  for (const key of PATH_KEYS) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0 && v.length < 512) return v;
  }
  return null;
}

/**
 * 11C.4 — Detect which files the agent touched from the tool_call stream.
 * Returns a sorted unique list of workspace-relative paths.
 */
export function detectFileChanges(
  events: Array<{ tool?: string; input?: unknown }>,
): string[] {
  const seen = new Set<string>();
  for (const ev of events) {
    const tool = ev.tool || "";
    if (!FILE_TOOL_RE.test(tool)) continue;
    const p = pathFromInput(ev.input);
    if (p) seen.add(p.replace(/\\/g, "/"));
  }
  return [...seen].sort();
}

/** 11C.1 — Run the workspace test suite with a hard timeout. */
export async function runTests(
  workspace: string,
  opts: GitOpsOptions = {},
): Promise<TestRunResult> {
  const cmd = opts.testCommand ?? process.env.AUTO_GIT_TEST_CMD ?? "npm test";
  const timeout = opts.testTimeoutMs ?? 120_000;
  const startedAt = Date.now();
  try {
    const { stderr } = await execFileAsync("bash", ["-lc", cmd], {
      cwd: workspace,
      timeout,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, CI: "1" },
    });
    return {
      pass: true,
      exitCode: 0,
      stderr: (stderr || "").slice(0, 2000),
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; killed?: boolean };
    return {
      pass: false,
      exitCode: typeof e.code === "number" ? e.code : 1,
      stderr: (e.stderr || e.stdout || String(err)).slice(0, 2000),
      durationMs: Date.now() - startedAt,
    };
  }
}

/** 11C.2 — Stage everything and commit. Guards against empty diffs. */
export async function stageAndCommit(
  workspace: string,
  message: string,
): Promise<{ committed: boolean; sha?: string }> {
  const { stdout: statusOut } = await execFileAsync("git", ["status", "--porcelain"], {
    cwd: workspace,
    timeout: 15_000,
  });
  if (!statusOut.trim()) {
    return { committed: false };
  }

  await execFileAsync("git", ["add", "-A"], { cwd: workspace, timeout: 30_000 });

  await execFileAsync(
    "git",
    ["commit", "-m", message, "--no-verify"],
    { cwd: workspace, timeout: 30_000 },
  );

  const { stdout: shaOut } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: workspace,
    timeout: 10_000,
  });
  return { committed: true, sha: shaOut.trim() };
}

/** 11C.3 — Push to a branch; surface auth failures so callers can report them. */
export async function pushBranch(
  workspace: string,
  branch: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await execFileAsync("git", ["push", "origin", branch], {
      cwd: workspace,
      timeout: 120_000,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const authHints = [
      "Authentication failed",
      "Permission denied",
      "could not read Username",
      "could not read Password",
      "401",
      "403",
      "not authorized",
    ];
    const isAuth = authHints.some((h) => msg.toLowerCase().includes(h.toLowerCase()));
    return { ok: false, error: isAuth ? "AUTH_FAILED" : msg.slice(0, 500) };
  }
}

/**
 * 11C.5 — Full auto-git pipeline: detect changes → test gate → commit → push.
 * Returns a CommitResult suitable for the SSE "done" event.
 */
export async function autoGitPipeline(
  workspace: string,
  events: Array<{ tool?: string; input?: unknown }>,
  opts: GitOpsOptions = {},
): Promise<CommitResult> {
  const enabled = opts.enabled ?? process.env.AUTO_GIT_ENABLED === "1";
  if (!enabled) {
    return {
      committed: false,
      testResult: "skipped",
      skippedReason: "auto-git disabled (AUTO_GIT_ENABLED != 1)",
    };
  }

  const changed = detectFileChanges(events);
  if (changed.length === 0) {
    return {
      committed: false,
      testResult: "skipped",
      skippedReason: "no file changes detected",
    };
  }

  const branch = opts.branch ?? process.env.AUTO_GIT_BRANCH ?? "develop";

  const test = await runTests(workspace, opts);
  if (!test.pass) {
    return {
      committed: false,
      testResult: "fail",
      testDetail: `exit ${test.exitCode} after ${Math.round(test.durationMs / 1000)}s`,
      skippedReason: "test gate failed — not committing",
    };
  }

  const summary = changed
    .slice(0, 8)
    .map((p) => p.split("/").pop())
    .join(", ");
  const message = `auto-git: ${summary}${changed.length > 8 ? " +more" : ""}`;

  const commit = await stageAndCommit(workspace, message);
  if (!commit.committed) {
    return {
      committed: false,
      testResult: "pass",
      testDetail: "tests passed, nothing to commit",
      skippedReason: "no diff after tests",
    };
  }

  const push = await pushBranch(workspace, branch);
  if (!push.ok) {
    return {
      committed: true,
      sha: commit.sha,
      message,
      testResult: "pass",
      testDetail: `commit ok; push ${branch} ${push.error === "AUTH_FAILED" ? "auth failed" : "failed"}`,
    };
  }

  return {
    committed: true,
    sha: commit.sha,
    message,
    testResult: "pass",
    testDetail: `pushed to ${branch}`,
  };
}
