import { describe, expect, it } from "vitest";
import {
  buildLabDiscussOpenerLocal,
  buildLabDiscussReplyLocal,
  parseLabDiscussId,
} from "./lab-discuss";

const ctx = {
  talkTitle: "Blue Planet clip",
  speaker: "BBC Earth",
  kind: "explanation",
  prompt: "Why do coral reefs bleach?",
  choices: ["Warm water stress", "Too much music", "Ice age", "No reason"],
  selected: [0],
  essay: "Warm water stresses the algae that live in coral.",
};

describe("lab-discuss", () => {
  it("LD1: opener references essay and lab; no correct-letter spoiler", () => {
    const open = buildLabDiscussOpenerLocal("bbc", ctx);
    expect(open).toMatch(/BBC Doc Lab/i);
    expect(open).toMatch(/Warm water stresses/i);
    expect(open).not.toMatch(/\bcorrect\b/i);
    expect(open).not.toMatch(/answer is\s*[ABCD]/i);
  });

  it("LD2: reply asks a follow-up; coherence cue when student affirms with because", () => {
    const short = buildLabDiscussReplyLocal("rsa", ctx, "ok");
    expect(short.toLowerCase()).toMatch(/more|detail|support/);
    const solid = buildLabDiscussReplyLocal(
      "natgeo",
      ctx,
      "Yes because the evidence from the captions shows heat stress on the algae.",
    );
    expect(solid).toMatch(/holds together|solid|ready/i);
    expect(solid).toMatch(/NatGeo challenge question/i);
  });

  it("LD3: parseLabDiscussId accepts bbc/rsa/natgeo only", () => {
    expect(parseLabDiscussId("bbc")).toBe("bbc");
    expect(parseLabDiscussId("RSA")).toBe("rsa");
    expect(parseLabDiscussId("ted")).toBeNull();
  });
});
