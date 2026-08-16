import { describe, expect, it } from "vitest";
import { suggestLabFromText } from "./lab-recommend";

describe("suggestLabFromText — topic routing", () => {
  it("routes space to TED", () => {
    const r = suggestLabFromText("我想了解黑洞和宇宙");
    expect(r?.labId).toBe("ted");
    expect(r?.gameParam).toBe("ted-lab");
  });

  it("routes animals to NatGeo", () => {
    const r = suggestLabFromText("there is a documentary about dinosaurs and animals");
    expect(r?.labId).toBe("natgeo");
  });

  it("routes psychology/education to RSA", () => {
    const r = suggestLabFromText("关于心理和创造力的演讲");
    expect(r?.labId).toBe("rsa");
  });

  it("routes history/geography to BBC", () => {
    const r = suggestLabFromText("历史纪录片 about ancient 地球环境");
    expect(r?.labId).toBe("bbc");
  });

  it("routes science to TED", () => {
    const r = suggestLabFromText("科学实验 physics chemistry");
    expect(r?.labId).toBe("ted");
  });
});

describe("suggestLabFromText — edge cases", () => {
  it("returns null for empty text", () => {
    expect(suggestLabFromText("")).toBeNull();
    expect(suggestLabFromText("   ")).toBeNull();
  });

  it("falls back to a valid lab for unrelated text", () => {
    const r = suggestLabFromText("今天的作业很难");
    expect(r).not.toBeNull();
    expect(["ted", "natgeo", "bbc", "rsa"]).toContain(r!.labId);
    expect(r!.gameParam).toBeTruthy();
    expect(r!.title).toBeTruthy();
    expect(r!.line).toBeTruthy();
  });
});
