import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  detectFileChanges,
  stageAndCommit,
  runTests,
  autoGitPipeline,
} from "../../agent-chat/src/lib/git-ops";

function makeCleanRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitops-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "a.txt"), "hello");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "init", "--no-verify"], { cwd: dir });
  return dir;
}

describe("git-ops", () => {
  it("detects file changes from tool_call events", () => {
    const events = [
      { tool: "Read", input: { path: "README.md" } },
      { tool: "Write", input: { path: "src/foo.ts" } },
      { tool: "StrReplace", input: { filePath: "src/foo.ts" } },
      { tool: "Bash", input: { command: "ls" } }, // not a file write
      { tool: "write_file", input: { file_path: "docs/x.md" } },
    ];
    const changes = detectFileChanges(events);
    expect(changes).toEqual(["docs/x.md", "src/foo.ts"]);
  });

  it("ignores non-write tools", () => {
    const changes = detectFileChanges([
      { tool: "Bash", input: { command: "git status" } },
      { tool: "WebSearch", input: { query: "x" } },
    ]);
    expect(changes).toEqual([]);
  });

  it("stageAndCommit guards empty diffs", async () => {
    const dir = makeCleanRepo();
    const res = await stageAndCommit(dir, "noop");
    expect(res.committed).toBe(false);
  });

  it("stageAndCommit commits staged changes", async () => {
    const dir = makeCleanRepo();
    fs.writeFileSync(path.join(dir, "b.txt"), "world");
    const res = await stageAndCommit(dir, "feat: add b");
    expect(res.committed).toBe(true);
    expect(res.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("runTests executes npm test with timeout", async () => {
    const res = await runTests("/root/codes/ryan_learning", {
      testCommand: "echo ok",
      testTimeoutMs: 10_000,
    });
    expect(res.pass).toBe(true);
    expect(res.exitCode).toBe(0);
  }, 30_000);

  it("autoGitPipeline skips when disabled", async () => {
    const res = await autoGitPipeline("/root/codes/ryan_learning", [
      { tool: "Write", input: { path: "a.ts" } },
    ], { enabled: false });
    expect(res.testResult).toBe("skipped");
  });

  it("autoGitPipeline skips when no changes", async () => {
    const res = await autoGitPipeline("/root/codes/ryan_learning", [], {
      enabled: true,
      testCommand: "echo ok",
    });
    expect(res.testResult).toBe("skipped");
  });
});
