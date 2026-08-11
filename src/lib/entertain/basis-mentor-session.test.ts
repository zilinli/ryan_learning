import { describe, expect, it } from "vitest";
import { buildBasisCoachLocal } from "./basis-writing";
import {
  buildMentorOpener,
  buildMentorOpenerFromText,
  localMentorReply,
} from "./basis-mentor-session";

const DRAFT = [
  "Rain taps the cracked phone screen on the bus seat.",
  "Things keep happening and stuff feels weird.",
].join("\n");

describe("basis-mentor-session", () => {
  it("opener praises then asks one question (Spark writing loop)", () => {
    const report = buildBasisCoachLocal(DRAFT);
    const opener = buildMentorOpener(report, DRAFT);
    expect(opener.text).toMatch(/\n\n/);
    expect(opener.question.length).toBeGreaterThan(10);
    expect(opener.text).toContain(opener.question);
    // One primary ask — question mark present
    expect(opener.question).toMatch(/\?/);
    expect(opener.focusId).toBeTruthy();
  });

  it("builds opener from free-text coach tips", () => {
    const tip =
      "Name one clear subject.\n\nWhat lighting fits this moment?";
    const opener = buildMentorOpenerFromText(tip, "A girl by the window.");
    expect(opener.text).toMatch(/Nice/);
    expect(opener.question).toMatch(/\?/);
  });

  it("local follow-up uses student words and ends with a question", () => {
    const report = buildBasisCoachLocal(DRAFT);
    const reply = localMentorReply("the cracked phone on the bus", report, DRAFT);
    expect(reply.toLowerCase()).toMatch(/phone|bus|cracked/);
    expect(reply).toMatch(/\?/);
  });

  it("softens when student says they don't know", () => {
    const report = buildBasisCoachLocal(DRAFT);
    const reply = localMentorReply("I don't know", report, DRAFT);
    expect(reply.toLowerCase()).toMatch(/a or b|ok|shrink/);
  });
});
