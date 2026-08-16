import { describe, expect, it } from "vitest";
import { buildBasisCoachLocal } from "./basis-writing";
import {
  buildMentorOpener,
  buildMentorOpenerFromText,
  localMentorReply,
  mentorTurnAgentPrompt,
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

  it("prompt contains the three-step loop and a convergence exit", () => {
    const prompt = mentorTurnAgentPrompt({
      draft: DRAFT,
      genre: "Indie",
      target: "music",
      focusIds: ["detail", "vocab"],
      history: [{ role: "coach", text: "What is the one object a camera should film?" }],
      studentReply: "the cracked phone on the bus",
    });
    expect(prompt).toMatch(/praise/i);
    expect(prompt).toMatch(/clarifying question/i);
    expect(prompt).toMatch(/craft nudge/i);
    expect(prompt).toMatch(/Converge every turn/i);
  });

  it("prompt lists open spot issues and already-asked focus areas", () => {
    const prompt = mentorTurnAgentPrompt({
      draft: DRAFT,
      genre: "Indie",
      target: "music",
      focusIds: ["detail"],
      history: [],
      studentReply: "things feel weird",
      openIssues: [{ id: "fix_vocab_1_3", span: "things", dimension: "vocab" }],
      askedFocusIds: ["detail"],
    });
    expect(prompt).toContain("fix_vocab_1_3");
    expect(prompt).toContain("“things”");
    expect(prompt).toContain("Already discussed focus areas: detail");
    expect(prompt).toMatch(/Do NOT re-ask those/);
  });

  it("prompt asks for JSON with an optional edit field", () => {
    const prompt = mentorTurnAgentPrompt({
      draft: DRAFT,
      genre: "Indie",
      target: "music",
      focusIds: ["vocab"],
      history: [],
      studentReply: "dashed down the road",
    });
    expect(prompt).toContain('"edit"');
    expect(prompt).toContain('"spanId"');
    expect(prompt).toContain('"replacement"');
    expect(prompt).toContain("ONLY JSON");
  });

  it("localMentorReply behaviour is unchanged by the edit protocol", () => {
    const report = buildBasisCoachLocal(DRAFT);
    const before = "I can almost see “the cracked phone on the bus”.";
    // Follow-up answers never carry a structured edit — pure dialogue fallback
    const reply = localMentorReply("the cracked phone on the bus", report, DRAFT);
    expect(reply).toMatch(/\?/);
    expect(reply).not.toBe(before);
  });
});
