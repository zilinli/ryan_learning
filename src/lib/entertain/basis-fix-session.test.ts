import { describe, expect, it } from "vitest";
import { buildBasisCoachLocal } from "./basis-writing";
import {
  applyWritingFix,
  buildWritingFixIssues,
  mergeRevision,
  nextOpenFix,
  remainingFixCount,
  type WritingFixIssue,
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

  describe("mergeRevision", () => {
    function issueOf(
      draft: string,
      span: string,
      revisionType: WritingFixIssue["revisionType"],
    ): WritingFixIssue {
      const start = draft.indexOf(span);
      expect(start).toBeGreaterThanOrEqual(0);
      return {
        id: "fix_test",
        dimension: "vocab",
        severity: 2,
        span,
        start,
        end: start + span.length,
        question: "q",
        tip: "tip",
        placeholder: "p",
        revisionType,
        status: "open",
      };
    }

    it("word merge keeps single spaces and dedupes punctuation", () => {
      const draft = "The thing and the rain.";
      const issue = issueOf(draft, "thing", "word");
      const next = mergeRevision(draft, issue, "door");
      expect(next).toBe("The door and the rain.");
    });

    it("word merge preserves trailing punctuation without duplication", () => {
      const draft = "I felt good about the thing.";
      const issue = issueOf(draft, "thing", "word");
      const next = mergeRevision(draft, issue, "door.");
      expect(next).toBe("I felt good about the door.");
    });

    it("phrase merge trims and keeps surrounding sentence intact", () => {
      const draft = "It happens everywhere, doing stuff.";
      const issue = issueOf(draft, "doing stuff", "phrase");
      const next = mergeRevision(draft, issue, "washing dishes at the sink");
      expect(next).toBe("It happens everywhere, washing dishes at the sink.");
    });

    it("sentence merge replaces the whole sentence and adds a period", () => {
      const draft = "Things keep happening until the end.";
      const issue = issueOf(draft, "Things keep happening until the end.", "sentence");
      const next = mergeRevision(draft, issue, "The bus pulls away as I run");
      expect(next).toBe("The bus pulls away as I run.");
    });

    it("append adds a new line when no span is present", () => {
      const draft = "First line.";
      const issue = issueOf(draft, "First line.", "append");
      const next = mergeRevision(draft, issue, "Second line");
      expect(next).toBe("First line.\nSecond line");
    });

    it("falls back to append when the span has drifted after edits", () => {
      const draft = "A very different draft now.";
      const issue = issueOf("Things keep happening.", "Things keep happening.", "sentence");
      const next = mergeRevision(draft, issue, "Nothing to see here");
      expect(next).toBe("A very different draft now.\nNothing to see here");
    });

    it("returns draft unchanged for a blank answer", () => {
      const draft = "The thing and the rain.";
      const issue = issueOf(draft, "thing", "word");
      expect(mergeRevision(draft, issue, "   ")).toBe(draft);
    });
  });
});
