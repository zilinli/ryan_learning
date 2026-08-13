import { describe, expect, it } from "vitest";
import { LAB_GAME_PARAM, suggestNextLab } from "./cross-lab";

describe("suggestNextLab (P2-4 cross-lab)", () => {
  it("routes a black-hole TED talk to NatGeo (space thread)", () => {
    const s = suggestNextLab("ted", ["science", "space", "black hole"]);
    expect(s?.to).toBe("natgeo");
    expect(s?.line).toContain("NatGeo Lab");
  });

  it("routes a nature BBC clip to NatGeo when the tag matches", () => {
    const s = suggestNextLab("bbc", ["nature", "Blue Planet"]);
    expect(s?.to).toBe("natgeo");
  });

  it("routes a society/creativity TED talk to RSA", () => {
    const s = suggestNextLab("ted", ["ideas", "creativity"]);
    expect(s?.to).toBe("rsa");
  });

  it("routes a psychology RSA video to TED (science thread)", () => {
    const s = suggestNextLab("rsa", ["psychology", "how we think"]);
    expect(s?.to).toBe("ted");
  });

  it("never suggests the lab you are already in", () => {
    for (const from of ["ted", "natgeo", "bbc", "rsa"] as const) {
      const s = suggestNextLab(from, ["space", "animals", "history"]);
      expect(s?.to).not.toBe(from);
    }
  });

  it("falls back to a sensible default when no tag matches", () => {
    const s = suggestNextLab("ted", ["something-unrelated"]);
    expect(s?.to).toBe("natgeo");
    expect(s).not.toBeNull();
  });

  it("returns null without tags", () => {
    expect(suggestNextLab("ted", [])).toBeNull();
    expect(suggestNextLab("natgeo", undefined as unknown as string[])).toBeNull();
  });

  it("maps every lab to a valid game param", () => {
    expect(LAB_GAME_PARAM.ted).toBe("ted-lab");
    expect(LAB_GAME_PARAM.natgeo).toBe("natgeo-lab");
    expect(LAB_GAME_PARAM.bbc).toBe("bbc-lab");
    expect(LAB_GAME_PARAM.rsa).toBe("rsa-lab");
  });
});
