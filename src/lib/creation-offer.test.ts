import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  creationOfferLine,
  likesTopicSignal,
  recordCreationOfferAccepted,
  type CreationOffer,
} from "./creation-offer";
import {
  emptyLearningMemory,
  loadLearningMemory,
  recordLearningTurnMemory,
  saveLearningMemory,
} from "./learning-memory";

const ACCT = "acct_creation_offer";

afterEach(() => {
  kvClearMemory();
  delete (globalThis as { window?: unknown }).window;
});

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
    const offer: CreationOffer = {
      topicLabel: "Dinosaurs & fossils",
      topicId: "dino-fossils",
      createdAt: 1,
    };
    expect(creationOfferLine(offer)).toContain("Dinosaurs & fossils");
    expect(creationOfferLine(offer)).toContain("mini creation");
  });

  it("V3 — recordCreationOfferAccepted counts the 'creation' source", async () => {
    // Node has no localStorage — shim it so save/load round-trip works.
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      length: 0,
      clear: () => store.clear(),
    };
    (globalThis as { window?: unknown }).window = {};
    let mem = emptyLearningMemory();
    mem = recordLearningTurnMemory(mem, {
      userText: "I'm into space and planets — phases of the moon",
    });
    const space =
      mem.skills.find((s) => s.topicId === "science-space") || mem.skills[0];
    expect(space).toBeDefined();
    saveLearningMemory(mem, ACCT);

    const offer: CreationOffer = {
      topicLabel: space!.label,
      topicId: space!.topicId,
      createdAt: Date.now(),
    };
    await recordCreationOfferAccepted(ACCT, offer);

    const after = loadLearningMemory(ACCT);
    const skill = after.skills.find((s) => s.id === space!.id);
    expect(skill?.sourceCounts?.creation).toBe(1);
    expect(skill?.lastSource).toBe("creation");
  });
});
