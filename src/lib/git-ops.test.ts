import { describe, it, expect } from "vitest";
import {
  detectFileChanges,
  stageAndCommit,
  runTests,
  autoGitPipeline,
} from "../../agent-chat/src/lib/git-ops";

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
    const res = await stageAndCommit("/root/codes/ryan_learning", "noop");
    expect(res.committed).toBe(false);
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
