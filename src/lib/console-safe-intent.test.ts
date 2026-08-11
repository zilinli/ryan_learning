import { describe, expect, it } from "vitest";
import {
  SAFE_SUGGESTIONS,
  looksDestructive,
  needsParentPinForConsole,
} from "./console-safe-intent";

describe("console-safe-intent", () => {
  it("CS1: safe suggestions are non-destructive", () => {
    expect(SAFE_SUGGESTIONS.length).toBeGreaterThanOrEqual(3);
    for (const s of SAFE_SUGGESTIONS) {
      expect(looksDestructive(s)).toBe(false);
    }
  });

  it("CS2: detects EN destructive ops", () => {
    expect(looksDestructive("please publish_develop now")).toBe(true);
    expect(looksDestructive("run deploy_live after build")).toBe(true);
    expect(looksDestructive("revert_changes and start over")).toBe(true);
    expect(looksDestructive("git push to origin")).toBe(true);
    expect(looksDestructive("Make the text bigger")).toBe(false);
  });

  it("CS3: detects 中文 destructive ops", () => {
    expect(looksDestructive("帮我部署上线")).toBe(true);
    expect(looksDestructive("推送到 develop")).toBe(true);
    expect(looksDestructive("把字体调大一点")).toBe(false);
  });

  it("CS4: unlocked session skips PIN", () => {
    expect(needsParentPinForConsole("deploy_live", true)).toBe(false);
    expect(needsParentPinForConsole("deploy_live", false)).toBe(true);
    expect(needsParentPinForConsole("bigger text", false)).toBe(false);
  });
});
