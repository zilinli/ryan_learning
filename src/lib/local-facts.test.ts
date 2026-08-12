import { describe, expect, it } from "vitest";
import { tryLocalFacts } from "./local-facts";

describe("tryLocalFacts — unit conversion", () => {
  it("km → m and m → km", () => {
    expect(tryLocalFacts("3 km = ? m")?.answer).toBe("3000");
    expect(tryLocalFacts("3千米等于多少米")?.answer).toBe("3000");
    expect(tryLocalFacts("1500m=?km")?.answer).toBe("1.5");
    expect(tryLocalFacts("2公里是几米")?.answer).toBe("2000");
  });

  it("kg ↔ g and L ↔ mL", () => {
    expect(tryLocalFacts("2 kg = ? g")?.answer).toBe("2000");
    expect(tryLocalFacts("500克=多少千克")?.answer).toBe("0.5");
    expect(tryLocalFacts("1.5 L = ? mL")?.answer).toBe("1500");
    expect(tryLocalFacts("250毫升=多少升")?.answer).toBe("0.25");
  });

  it("h ↔ min", () => {
    expect(tryLocalFacts("2 h = ? min")?.answer).toBe("120");
    expect(tryLocalFacts("90分钟=多少小时")?.answer).toBe("1.5");
  });

  it("rejects cross-family conversion", () => {
    expect(tryLocalFacts("3 km = ? kg")).toBeNull();
    expect(tryLocalFacts("5 L = ? min")).toBeNull();
  });
});

describe("tryLocalFacts — distance formula", () => {
  it("60 km/h × 2 h = 120 km", () => {
    const hit = tryLocalFacts("60 km/h 2 h 路程?")!;
    expect(hit.answer).toBe("120");
    expect(hit.reply).toMatch(/120 km/);
  });

  it("中文：60千米每小时2小时", () => {
    expect(tryLocalFacts("60千米每小时2小时")?.answer).toBe("120");
  });
});

describe("tryLocalFacts — power table", () => {
  it("square", () => {
    expect(tryLocalFacts("12²")?.answer).toBe("144");
    expect(tryLocalFacts("12^2")?.answer).toBe("144");
    expect(tryLocalFacts("12的平方")?.answer).toBe("144");
    expect(tryLocalFacts("12 squared")?.answer).toBe("144");
  });

  it("cube", () => {
    expect(tryLocalFacts("3³")?.answer).toBe("27");
    expect(tryLocalFacts("3^3")?.answer).toBe("27");
    expect(tryLocalFacts("3的立方")?.answer).toBe("27");
  });

  it("powers of two", () => {
    expect(tryLocalFacts("2^5")?.answer).toBe("32");
    expect(tryLocalFacts("2的10次方")?.answer).toBe("1024");
    expect(tryLocalFacts("2^13")).toBeNull();
  });
});

describe("tryLocalFacts — percent & half", () => {
  it("percent", () => {
    expect(tryLocalFacts("50% of 200")?.answer).toBe("100");
    expect(tryLocalFacts("25%的80")?.answer).toBe("20");
  });

  it("half", () => {
    expect(tryLocalFacts("half of 84")?.answer).toBe("42");
    expect(tryLocalFacts("84的一半")?.answer).toBe("42");
  });

  it("rejects odd halves", () => {
    expect(tryLocalFacts("half of 85")).toBeNull();
  });
});

describe("tryLocalFacts — rejects wordy/ambiguous", () => {
  it("returns null for prose", () => {
    expect(tryLocalFacts("help me convert km to m")).toBeNull();
    expect(tryLocalFacts("路程等于什么？")).toBeNull();
    expect(tryLocalFacts("")).toBeNull();
  });
});
