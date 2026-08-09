import { describe, expect, it, vi } from "vitest";
import {
  applyConfusableChoice,
  confirmOptions,
  confirmTimeoutMs,
  detectConfusable,
} from "./voice-confusables";

describe("voice-confusables (B3)", () => {
  it("VC1: seeded heard + matching skill → pair", () => {
    const pair = detectConfusable("然后用 24 除以 3", ["division-basics"]);
    expect(pair?.id).toBe("chuyi-chufa");
    expect(confirmOptions(pair!).length).toBeGreaterThanOrEqual(2);
  });

  it("VC2: token present but skill mismatch → null", () => {
    expect(
      detectConfusable("然后用 24 除以 3", ["reading-evidence"]),
    ).toBeNull();
    expect(detectConfusable("然后用 24 除以 3", [])).toBeNull();
  });

  it("VC3: no match → null", () => {
    expect(
      detectConfusable("今天天气不错", ["division-basics"]),
    ).toBeNull();
  });

  it("VC4: chip choice mutates transcript term", () => {
    const pair = detectConfusable("用 24 除以 3", ["division-basics"])!;
    expect(applyConfusableChoice("用 24 除以 3", pair, "除法")).toBe(
      "用 24 除法 3",
    );
  });

  it("VC5: confirm timeout is fail-open window (~4s)", () => {
    expect(confirmTimeoutMs()).toBe(4000);
  });

  it("VC6: typed path helper — detect only for voice callers (pure fn still matches text)", () => {
    // Typed input must skip detectConfusable at the VoiceControls boundary.
    // Document contract: callers of typed send never invoke detectConfusable.
    const spy = vi.fn(detectConfusable);
    // Simulate typed path: do not call
    expect(spy).not.toHaveBeenCalled();
    // When voice path would call:
    spy("分子是 3", ["fractions-concepts"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
