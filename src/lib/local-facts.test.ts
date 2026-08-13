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

describe("tryLocalFacts — arithmetic & multiplication table", () => {
  it("multiplication facts (symbolic / EN / 中文)", () => {
    expect(tryLocalFacts("7×8")?.answer).toBe("56");
    expect(tryLocalFacts("7 x 8")?.answer).toBe("56");
    expect(tryLocalFacts("7*8")?.answer).toBe("56");
    expect(tryLocalFacts("7 times 8")?.answer).toBe("56");
    expect(tryLocalFacts("7乘8")?.answer).toBe("56");
  });

  it("addition / subtraction / division", () => {
    expect(tryLocalFacts("8+3")?.answer).toBe("11");
    expect(tryLocalFacts("8加3")?.answer).toBe("11");
    expect(tryLocalFacts("12-5")?.answer).toBe("7");
    expect(tryLocalFacts("12减5")?.answer).toBe("7");
    expect(tryLocalFacts("24÷6")?.answer).toBe("4");
    expect(tryLocalFacts("24除以6")?.answer).toBe("4");
  });

  it("rejects non-integer division and big operands", () => {
    expect(tryLocalFacts("7÷2")).toBeNull();
    expect(tryLocalFacts("13×99")).toBeNull();
  });
});

describe("tryLocalFacts — temperature", () => {
  it("C→F and F→C", () => {
    expect(tryLocalFacts("100°C to F")?.answer).toBe("212");
    expect(tryLocalFacts("20摄氏度等于多少华氏度")?.answer).toBe("68");
    expect(tryLocalFacts("68°F in C")?.answer).toBe("20");
  });
});

describe("tryLocalFacts — fraction decimals", () => {
  it("1/2 and 3/4 as decimals", () => {
    expect(tryLocalFacts("1/2 as a decimal")?.answer).toBe("0.5");
    expect(tryLocalFacts("3/4是多少")?.answer).toBe("0.75");
    expect(tryLocalFacts("1/3 as a decimal")?.answer).toBe("0.33");
  });
});

describe("tryLocalFacts — shapes formulas", () => {
  it("rectangle perimeter & area", () => {
    expect(tryLocalFacts("perimeter of rectangle 4 and 6")?.answer).toBe("20");
    expect(tryLocalFacts("周长 4 和 6")?.answer).toBe("20");
    expect(tryLocalFacts("area of rectangle 3 5")?.answer).toBe("15");
    expect(tryLocalFacts("面积 长3 宽5")?.answer).toBe("15");
  });

  it("square area", () => {
    expect(tryLocalFacts("area of square 5")?.answer).toBe("25");
  });
});

describe("tryLocalFacts — double & triple", () => {
  it("double / triple", () => {
    expect(tryLocalFacts("double 6")?.answer).toBe("12");
    expect(tryLocalFacts("triple 8")?.answer).toBe("24");
    expect(tryLocalFacts("6的两倍")?.answer).toBe("12");
    expect(tryLocalFacts("6的3倍")?.answer).toBe("18");
  });
});

describe("tryLocalFacts — V2 P2 more formulas (report §9.2.3)", () => {
  it("square perimeter", () => {
    expect(tryLocalFacts("perimeter of square 5")?.answer).toBe("20");
    expect(tryLocalFacts("正方形周长 5")?.answer).toBe("20");
  });

  it("circle circumference & area", () => {
    const cc = tryLocalFacts("circumference of circle 7")!;
    expect(cc.answer).toBe("43.98");
    const ca = tryLocalFacts("area of circle 5")!;
    expect(ca.answer).toBe("78.54");
  });

  it("triangle area, hypotenuse, cube volume", () => {
    expect(tryLocalFacts("area of triangle 6 and 4")?.answer).toBe("12");
    expect(tryLocalFacts("hypotenuse 3 and 4")?.answer).toBe("5");
    expect(tryLocalFacts("volume of cube 3")?.answer).toBe("27");
    expect(tryLocalFacts("立方体体积 3")?.answer).toBe("27");
  });
});

describe("tryLocalFacts — V2 P2 what-percent (report §9.2.3)", () => {
  it("40 is what percent of 200", () => {
    const hit = tryLocalFacts("40 is what percent of 200")!;
    expect(hit.answer).toBe("20%");
    expect(hit.reply).toMatch(/20%/);
  });

  it("中文：40是200的百分之几", () => {
    expect(tryLocalFacts("40是200的百分之几")?.answer).toBe("20%");
  });

  it("rejects part > whole", () => {
    expect(tryLocalFacts("300 is what percent of 200")).toBeNull();
  });
});

describe("tryLocalFacts — V2 P2 term dictionary (report §9.2.3)", () => {
  it("math & ELA terms", () => {
    expect(tryLocalFacts("what is a fraction")?.reply).toMatch(/part of a whole/);
    expect(tryLocalFacts("what is a prime number")?.answer).toBe("prime number");
    expect(tryLocalFacts("what is a noun")?.answer).toBe("noun");
    expect(tryLocalFacts("define verb")?.answer).toBe("verb");
    expect(tryLocalFacts("什么是光合作用")?.answer).toBe("photosynthesis");
    expect(tryLocalFacts("什么是重力")?.answer).toBe("gravity");
  });

  it("rejects non-definition questions", () => {
    expect(tryLocalFacts("I like fractions")).toBeNull();
    expect(tryLocalFacts("fraction")).toBeNull();
  });
});

describe("tryLocalFacts — V2 P2 history timeline (report §9.2.3)", () => {
  it("when did WWII / Titanic / Apollo 11 happen", () => {
    expect(tryLocalFacts("when did world war ii happen")?.answer).toBe("1939–1945");
    expect(tryLocalFacts("when did the titanic sink")?.answer).toBe("1912");
    expect(tryLocalFacts("moon landing happened when")?.answer).toBe("1969");
    expect(tryLocalFacts("什么时候发生的二战")?.answer).toBe("1939–1945");
  });

  it("rejects non-history asks", () => {
    expect(tryLocalFacts("when is lunch")).toBeNull();
  });
});
