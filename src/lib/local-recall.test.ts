import { describe, expect, it } from "vitest";
import { tryLocalRecall } from "./local-recall";

describe("tryLocalRecall", () => {
  it("handles times-table and add/sub", () => {
    expect(tryLocalRecall("7×8")?.answer).toBe(56);
    expect(tryLocalRecall("7x8")?.answer).toBe(56);
    expect(tryLocalRecall("12+5")?.answer).toBe(17);
    expect(tryLocalRecall("20-3")?.answer).toBe(17);
    expect(tryLocalRecall("56÷7")?.answer).toBe(8);
  });

  it("rejects non-exact division and big multiply", () => {
    expect(tryLocalRecall("10÷3")).toBeNull();
    expect(tryLocalRecall("15×16")).toBeNull();
    expect(tryLocalRecall("256÷8")).toBeNull();
  });

  it("rejects conceptual / wordy asks", () => {
    expect(tryLocalRecall("what is 7 times 8")).toBeNull();
    expect(tryLocalRecall("帮我算 7×8")).toBeNull();
    expect(tryLocalRecall("")).toBeNull();
  });
});
