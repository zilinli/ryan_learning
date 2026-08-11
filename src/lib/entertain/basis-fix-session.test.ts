import { describe, expect, it } from "vitest";
import { buildBasisCoachLocal } from "./basis-writing";
import {
  applyWritingFix,
  buildWritingFixIssues,
  nextOpenFix,
  remainingFixCount,
} from "./basis-fix-session";

const VAGUE = [
  "Life is full of things and stuff.",
  "Things make me feel things again.",
  "Stuff happens and life goes on.",
  "Things keep happening until the end.",
].join("\n");

const ZH = [
  "第一节",
  "它会发生，到处做事情。",
  "副歌",
  "我不知道那个样子是什么。",
].join("\n");

describe("basis-fix-session", () => {
  it("ranks issues by severity and finds vague spans", () => {
    const report = buildBasisCoachLocal(VAGUE);
    const issues = buildWritingFixIssues(VAGUE, report, 8);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.severity).toBeLessThanOrEqual(issues.at(-1)!.severity);
    expect(issues.some((i) => /thing|stuff|life/i.test(i.span))).toBe(true);
    expect(remainingFixCount(issues)).toBe(issues.length);
    expect(nextOpenFix(issues)?.status).toBe("open");
  });

  it("detects Chinese vague phrases", () => {
    const report = buildBasisCoachLocal(ZH);
    const issues = buildWritingFixIssues(ZH, report, 8);
    expect(issues.some((i) => /事情|样子|发生|到处/.test(i.span))).toBe(true);
  });

  it("applyWritingFix replaces the span in the pad", () => {
    const report = buildBasisCoachLocal(VAGUE);
    const issues = buildWritingFixIssues(VAGUE, report, 8);
    const issue = issues.find((i) => i.span.toLowerCase().includes("thing"))!;
    expect(issue).toBeTruthy();
    const next = applyWritingFix(VAGUE, issue, "cracked phone screen");
    expect(next).toContain("cracked phone screen");
    expect(next).not.toBe(VAGUE);
  });
});
