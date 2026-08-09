import { describe, expect, it } from "vitest";
import {
  looksLikeStillStuck,
  nextRepresentation,
  pickForcedRepresentation,
  REPRESENTATIONS,
} from "./multi-rep";

describe("multi-rep (CA-7)", () => {
  it("MR1: cycle order advances unused reps", () => {
    expect(nextRepresentation(null, [])).toBe("bar_model");
    expect(nextRepresentation("bar_model", ["bar_model"])).toBe("number_line");
    expect(
      nextRepresentation("blocks", [...REPRESENTATIONS]),
    ).toBe("bar_model");
  });

  it("MR2: force only after stuck streak ≥ 2", () => {
    expect(pickForcedRepresentation("fractions-concepts", 1, {})).toBeNull();
    const forced = pickForcedRepresentation("fractions-concepts", 2, {
      "fractions-concepts": "bar_model",
    });
    expect(forced).toBe("number_line");
  });

  it("MR3: stuck phrasing detected", () => {
    expect(looksLikeStillStuck("I still don't get it")).toBe(true);
    expect(looksLikeStillStuck("还是不懂")).toBe(true);
    expect(looksLikeStillStuck("ok next")).toBe(false);
  });
});
