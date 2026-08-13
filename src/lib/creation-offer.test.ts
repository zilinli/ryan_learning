import { describe, expect, it } from "vitest";
import {
  creationOfferLine,
  likesTopicSignal,
  type CreationOffer,
} from "./creation-offer";

describe("creation-offer (report §9.1.3)", () => {
  it("detects enthusiasm signals in the child's own words", () => {
    expect(likesTopicSignal("I loved the dinosaurs!", "Great job!")).toBe(true);
    expect(likesTopicSignal("That was fun, more please", "Sure!")).toBe(true);
    expect(likesTopicSignal("我很喜欢这个", "你答对了！")).toBe(true);
    expect(likesTopicSignal("好玩", "非常好！")).toBe(true);
  });

  it("ignores a bare 'like' with no tutor reply", () => {
    expect(likesTopicSignal("like what is 7x8?", "")).toBe(false);
    expect(likesTopicSignal("", "Here's a hint")).toBe(false);
  });

  it("builds a kid-facing creation line with the topic label", () => {
    const offer: CreationOffer = { topicLabel: "Dinosaurs & fossils", createdAt: 1 };
    expect(creationOfferLine(offer)).toContain("Dinosaurs & fossils");
    expect(creationOfferLine(offer)).toContain("mini creation");
  });
});
