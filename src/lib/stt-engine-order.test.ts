import { afterEach, describe, expect, it } from "vitest";
import { isMultiEngineLang, sttEngineOrder } from "./stt-engine-order";

const OLD = { ...process.env };

afterEach(() => {
  process.env = { ...OLD };
});

describe("sttEngineOrder", () => {
  it("returns three-tier fallback for teo by default", () => {
    delete process.env.STT_ENGINE_ORDER_TEO;
    expect(sttEngineOrder("teo")).toEqual(["bailian", "iflytek", "local"]);
  });

  it("returns three-tier fallback for hak by default", () => {
    delete process.env.STT_ENGINE_ORDER_HAK;
    expect(sttEngineOrder("hak")).toEqual(["bailian", "iflytek", "local"]);
  });

  it("returns Bailian-first for unknown languages", () => {
    expect(sttEngineOrder("zh")).toEqual(["bailian", "local"]);
    expect(sttEngineOrder("en")).toEqual(["bailian", "local"]);
    expect(sttEngineOrder("auto")).toEqual(["bailian", "local"]);
  });

  it("honours env override for teo", () => {
    process.env.STT_ENGINE_ORDER_TEO = "iflytek,bailian,local";
    expect(sttEngineOrder("teo")).toEqual(["iflytek", "bailian", "local"]);
  });

  it("honours env override for hak", () => {
    process.env.STT_ENGINE_ORDER_HAK = "bailian";
    expect(sttEngineOrder("hak")).toEqual(["bailian"]);
  });

  it("trims whitespace and filters invalid engine names", () => {
    process.env.STT_ENGINE_ORDER_TEO = " iflytek , invalid , local , ";
    expect(sttEngineOrder("teo")).toEqual(["iflytek", "local"]);
  });

  it("falls back to default when env yields empty list", () => {
    process.env.STT_ENGINE_ORDER_TEO = "garbage";
    expect(sttEngineOrder("teo")).toEqual(["bailian", "iflytek", "local"]);
  });
});

describe("isMultiEngineLang", () => {
  it("only teo and hak are multi-engine", () => {
    expect(isMultiEngineLang("teo")).toBe(true);
    expect(isMultiEngineLang("hak")).toBe(true);
  });

  it("non-dialect langs are not multi-engine", () => {
    expect(isMultiEngineLang("auto")).toBe(false);
    expect(isMultiEngineLang("en")).toBe(false);
    expect(isMultiEngineLang("zh")).toBe(false);
    expect(isMultiEngineLang("yue")).toBe(false);
    expect(isMultiEngineLang("es")).toBe(false);
    expect(isMultiEngineLang("fr")).toBe(false);
  });
});
