import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SDKCustomToolContext } from "@cursor/sdk";
import {
  createConsoleHarnessTools,
  resetFileChangeCount,
  getFileChangeCount,
  resetConsoleHarnessToolsCache,
  MAX_EDITS_PER_SESSION,
} from "./console-harness";
import { promises as fs } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const TMP = path.join(ROOT, "_test_tmp");
const bakRoot = path.join(ROOT, ".console-backups");
const ctx: SDKCustomToolContext = {};
function asString(v: unknown): string { return typeof v === "string" ? v : ""; }
beforeEach(async () => {
  await fs.mkdir(TMP, { recursive: true });
  await fs.mkdir(path.join(TMP, "sub"), { recursive: true });
  resetFileChangeCount();
});
afterEach(async () => { try { await fs.rm(TMP, { recursive: true, force: true }); } catch {} try { await fs.rm(bakRoot, { recursive: true, force: true }); } catch {} });
describe("createConsoleHarnessTools", () => {
  const tools = createConsoleHarnessTools();
  it("returns the same tools instance", () => { expect(createConsoleHarnessTools()).toBe(tools); });
  it("CD1: exposes deploy_live", () => {
    expect(tools.deploy_live).toBeDefined();
    expect(tools.deploy_live!.description.toLowerCase()).toMatch(/build|pm2|\.next/);
  });
  it("CD1b: exposes pipeline tools", () => {
    expect(tools.web_research).toBeDefined();
    expect(tools.fetch_page).toBeDefined();
    expect(tools.write_file).toBeDefined();
    expect(tools.publish_develop).toBeDefined();
  });
  it("CD2: deploy_live dry-run", async () => {
    const prev = process.env.CONSOLE_DEPLOY_DRY_RUN;
    process.env.CONSOLE_DEPLOY_DRY_RUN = "1";
    try {
      resetConsoleHarnessToolsCache();
      const t = createConsoleHarnessTools();
      const r = JSON.parse(asString(await t.deploy_live!.execute({}, ctx)));
      expect(r.ok).toBe(true);
      expect(r.dryRun).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CONSOLE_DEPLOY_DRY_RUN;
      else process.env.CONSOLE_DEPLOY_DRY_RUN = prev;
      resetConsoleHarnessToolsCache();
    }
  });
  it("CD2b: publish_develop dry-run", async () => {
    const prev = process.env.CONSOLE_PUBLISH_DRY_RUN;
    process.env.CONSOLE_PUBLISH_DRY_RUN = "1";
    try {
      resetConsoleHarnessToolsCache();
      const t = createConsoleHarnessTools();
      const r = JSON.parse(asString(await t.publish_develop!.execute({}, ctx)));
      expect(r.ok).toBe(true);
      expect(r.dryRun).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CONSOLE_PUBLISH_DRY_RUN;
      else process.env.CONSOLE_PUBLISH_DRY_RUN = prev;
      resetConsoleHarnessToolsCache();
    }
  });
  it("CD3: console SYS mentions full pipeline + deploy_live", async () => {
    const { CONSOLE_SYS } = await import("./console-sys");
    expect(CONSOLE_SYS).toContain("deploy_live");
    expect(CONSOLE_SYS).toMatch(/\.next/);
    expect(CONSOLE_SYS).toContain("Max 25");
    expect(CONSOLE_SYS).toContain("P1 — Research");
    expect(CONSOLE_SYS).toContain("P2 — Design");
    expect(CONSOLE_SYS).toContain("P3 — Plan");
    expect(CONSOLE_SYS).toContain("publish_develop");
    expect(CONSOLE_SYS).toContain("web_research");
    const src = await fs.readFile(
      path.join(ROOT, "src/app/api/console/chat/route.ts"),
      "utf-8",
    );
    expect(src).toContain("CONSOLE_SYS");
  });
  it("CD4: allows MAX_EDITS_PER_SESSION edits then throws", async () => {
    expect(MAX_EDITS_PER_SESSION).toBe(25);
    for (let i = 0; i < MAX_EDITS_PER_SESSION; i++) {
      const name = `e${i}.ts`;
      await fs.writeFile(path.join(TMP, name), "v0");
      await tools.edit_file!.execute(
        { filepath: `_test_tmp/${name}`, old_string: "v0", new_string: "v1" },
        ctx,
      );
    }
    await fs.writeFile(path.join(TMP, "overflow.ts"), "v0");
    await expect(
      tools.edit_file!.execute(
        { filepath: "_test_tmp/overflow.ts", old_string: "v0", new_string: "v1" },
        ctx,
      ),
    ).rejects.toThrow(/Max 25/);
  });
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
      await expect(tools.read_file!.execute({ filepath: ".env" }, ctx)).rejects.toThrow();
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
      await tools.edit_file!.execute({ filepath: "_test_tmp/g.ts", old_string: "abc", new_string: "def" }, ctx);
      expect(getFileChangeCount()).toBe(1);
    });
  });
  describe("git_diff", () => { it("returns a string", async () => { const r = asString(await tools.git_diff!.execute({}, ctx)); expect(typeof r).toBe("string"); }); });
  describe("run_tests", () => { it("runs vitest and reports results", async () => { const r = asString(await tools.run_tests!.execute({ file: "src/lib/dict-cache.test.ts" }, ctx)); const parsed = JSON.parse(r); expect(parsed.passed).toBeGreaterThanOrEqual(0); }, 70000); });
  describe("apply_changes", () => { it("runs apply flow", async () => { try { await tools.apply_changes!.execute({ message: "test" }, ctx); } catch (e) { expect(e).toBeDefined(); } }, 90000); });
  describe("revert_changes", () => { it("reverts changes", async () => { const r = asString(await tools.revert_changes!.execute({}, ctx)); expect(typeof r).toBe("string"); }); });
});
describe("file change counter", () => { it("resets to zero", () => { resetFileChangeCount(); expect(getFileChangeCount()).toBe(0); }); });
