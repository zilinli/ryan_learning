import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discardStashedNext,
  hasProdBuild,
  restoreNextArtifact,
  stashNextArtifact,
  writeFakeProdBuild,
} from "../../scripts/lib/next-artifact-guard.mjs";

describe("next-artifact-guard", () => {
  const dirs = [];

  afterEach(() => {
    while (dirs.length) {
      try {
        rmSync(dirs.pop(), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function tmp() {
    const d = mkdtempSync(join(tmpdir(), "next-guard-"));
    dirs.push(d);
    return d;
  }

  it("stashes and restores a production BUILD_ID", () => {
    const root = tmp();
    const nextDir = join(root, ".next");
    const prevDir = join(root, ".next.prev");
    writeFakeProdBuild(nextDir, "live-v1");

    expect(stashNextArtifact(nextDir, prevDir)).toBe(true);
    expect(hasProdBuild(nextDir)).toBe(false);
    expect(hasProdBuild(prevDir)).toBe(true);

    writeFakeProdBuild(nextDir, "broken");
    expect(restoreNextArtifact(nextDir, prevDir)).toBe(true);
    expect(readFileSync(join(nextDir, "BUILD_ID"), "utf8")).toBe("live-v1");
    expect(hasProdBuild(prevDir)).toBe(false);
  });

  it("discards stash after successful build", () => {
    const root = tmp();
    const nextDir = join(root, ".next");
    const prevDir = join(root, ".next.prev");
    writeFakeProdBuild(nextDir, "old");
    stashNextArtifact(nextDir, prevDir);
    writeFakeProdBuild(nextDir, "new");
    expect(discardStashedNext(prevDir)).toBe(true);
    expect(hasProdBuild(prevDir)).toBe(false);
    expect(readFileSync(join(nextDir, "BUILD_ID"), "utf8")).toBe("new");
  });

  it("restore is a no-op when nothing was stashed", () => {
    const root = tmp();
    expect(restoreNextArtifact(join(root, ".next"), join(root, ".next.prev"))).toBe(
      false,
    );
  });
});
