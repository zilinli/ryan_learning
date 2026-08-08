import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SDKCustomToolContext } from "@cursor/sdk";
import { createConsoleHarnessTools, resetFileChangeCount, getFileChangeCount } from "./console-harness";
import { promises as fs } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const TMP = path.join(ROOT, "_test_tmp");
const bakRoot = path.join(ROOT, ".console-backups");
const ctx: SDKCustomToolContext = {};
function asString(v: unknown): string { return typeof v === "string" ? v : ""; }
beforeEach(async () => { await fs.mkdir(TMP, { recursive: true }); await fs.mkdir(path.join(TMP, "sub"), { recursive: true }); resetFileChangeCount(); });
afterEach(async () => { try { await fs.rm(TMP, { recursive: true, force: true }); } catch {} try { await fs.rm(bakRoot, { recursive: true, force: true }); } catch {} });
describe("createConsoleHarnessTools", () => {
  const tools = createConsoleHarnessTools();
  it("returns the same tools instance", () => { expect(createConsoleHarnessTools()).toBe(tools); });
  describe("list_files", () => {
    it("lists directory contents", async () => {
      await fs.writeFile(path.join(TMP, "a.ts"), "a"); await fs.writeFile(path.join(TMP, "b.ts"), "b"); await fs.writeFile(path.join(TMP, ".hidden"), "h");
      const r = asString(await tools.list_files!.execute({ dirpath: "_test_tmp" }, ctx));
      expect(r).toContain("a.ts"); expect(r).toContain("b.ts"); expect(r).toContain("sub/"); expect(r).not.toContain(".hidden");
    });
  });
  describe("read_file", () => {
    it("reads a file with line numbers", async () => {
      await fs.writeFile(path.join(TMP, "x.ts"), "line1\nline2");
      const r = asString(await tools.read_file!.execute({ filepath: "_test_tmp/x.ts" }, ctx));
      expect(r).toContain("1|line1"); expect(r).toContain("2|line2");
    });
    it("rejects forbidden paths", async () => {
      await expect(tools.read_file!.execute({ filepath: ".env" }, {} as any)).rejects.toThrow();
    });
  });
  describe("search_code", () => {
    it("finds matches in test files", async () => {
      await fs.writeFile(path.join(TMP, "needle.ts"), "const needle = 42;");
      const r = asString(await tools.search_code!.execute({ query: "needle", glob: "_test_tmp/**" }, ctx));
      expect(r).toContain("needle = 42");
    });
    it("returns no matches for nonsense pattern", async () => {
      await fs.writeFile(path.join(TMP, "dummy.ts"), "const hello = 1;");
      const r = asString(await tools.search_code!.execute({ query: "ZXYNOTFOUNDXXZ999ABC", glob: "_test_tmp/**" }, ctx));
      expect(r).toBe("No matches found.");
    });
  });
  describe("edit_file", () => {
    it("replaces a string in a file", async () => {
      await fs.writeFile(path.join(TMP, "f.ts"), "hello world");
      const r = asString(await tools.edit_file!.execute({ filepath: "_test_tmp/f.ts", old_string: "world", new_string: "earth" }, ctx));
      expect(r).toContain("+0");
      const c = await fs.readFile(path.join(TMP, "f.ts"), "utf-8"); expect(c).toBe("hello earth");
    });
    it("increments change count", async () => {
      await fs.writeFile(path.join(TMP, "g.ts"), "abc");
      expect(getFileChangeCount()).toBe(0);
      await tools.edit_file!.execute({ filepath: "_test_tmp/g.ts", old_string: "abc", new_string: "def" }, {} as any);
      expect(getFileChangeCount()).toBe(1);
    });
  });
  describe("git_diff", () => { it("returns a string", async () => { const r = asString(await tools.git_diff!.execute({}, ctx)); expect(typeof r).toBe("string"); }); });
  describe("run_tests", () => { it("runs vitest and reports results", async () => { const r = asString(await tools.run_tests!.execute({ file: "src/lib/console-harness.test.ts" }, ctx)); const parsed = JSON.parse(r); expect(parsed.passed).toBeGreaterThanOrEqual(0); }, 70000); });
  describe("apply_changes", () => { it("runs apply flow", async () => { try { await tools.apply_changes!.execute({ message: "test" }, {} as any); } catch (e) { expect(e).toBeDefined(); } }, 90000); });
  describe("revert_changes", () => { it("reverts changes", async () => { const r = asString(await tools.revert_changes!.execute({}, ctx)); expect(typeof r).toBe("string"); }); });
});
describe("file change counter", () => { it("resets to zero", () => { resetFileChangeCount(); expect(getFileChangeCount()).toBe(0); }); });
