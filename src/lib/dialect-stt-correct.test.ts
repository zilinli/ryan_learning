import { describe, expect, it } from "vitest";
import {
  buildDialectCorrectionPrompt,
  isDialectLang,
  parseCorrectionResult,
  topDialectWords,
} from "./dialect-stt-correct";

describe("topDialectWords", () => {
  it("returns high-confidence community-verified words", () => {
    const teo = topDialectWords("teo", 20);
    expect(teo.length).toBeGreaterThan(0);
    expect(teo.length).toBeLessThanOrEqual(20);
    expect(teo).toContain("我"); // #1 teochew pronoun, community-verified
  });

  it("honours the limit and does not duplicate", () => {
    const hak = topDialectWords("hak", 30);
    expect(hak.length).toBeLessThanOrEqual(30);
    expect(new Set(hak).size).toBe(hak.length);
  });
});

describe("buildDialectCorrectionPrompt", () => {
  it("embeds dialect name and high-frequency words", () => {
    const teo = buildDialectCorrectionPrompt("我个书", "teo");
    expect(teo).toContain("潮汕话");
    expect(teo).toContain("我个书");
    expect(teo).toContain("只修正");
    const hak = buildDialectCorrectionPrompt("涯个书", "hak");
    expect(hak).toContain("客家话");
    expect(hak).toContain("严禁扩写");
  });

  it("requires strict JSON output", () => {
    const prompt = buildDialectCorrectionPrompt("你好", "teo");
    expect(prompt).toContain('{"corrected":');
    expect(prompt).toContain("changed");
  });
});

describe("parseCorrectionResult", () => {
  it("parses valid JSON result", () => {
    const r = parseCorrectionResult('{"corrected": "我个书", "changed": true}', "涯个书");
    expect(r).toEqual({ corrected: "我个书", changed: true, raw: "涯个书" });
  });

  it("extracts JSON from a fenced block", () => {
    const r = parseCorrectionResult('```json\n{"corrected": "勿惊", "changed": false}\n```', "勿惊");
    expect(r.corrected).toBe("勿惊");
    expect(r.changed).toBe(false);
  });

  it("falls back to raw on invalid JSON", () => {
    const r = parseCorrectionResult("抱歉，我没有理解", "汝好");
    expect(r).toEqual({ corrected: "汝好", changed: false, raw: "汝好" });
  });

  it("falls back to raw when corrected is missing/empty", () => {
    expect(parseCorrectionResult('{"changed": true}', "原文").corrected).toBe("原文");
    expect(parseCorrectionResult('{"corrected": ""}', "原文").corrected).toBe("原文");
    expect(parseCorrectionResult('{"corrected": "   "}', "原文").corrected).toBe("原文");
  });

  it("does not throw on empty input", () => {
    expect(parseCorrectionResult("", "x")).toEqual({ corrected: "x", changed: false, raw: "x" });
  });
});

describe("isDialectLang", () => {
  it("only recognises teo and hak", () => {
    expect(isDialectLang("teo")).toBe(true);
    expect(isDialectLang("hak")).toBe(true);
    expect(isDialectLang("auto")).toBe(false);
    expect(isDialectLang("yue")).toBe(false);
    expect(isDialectLang("en")).toBe(false);
  });
});
