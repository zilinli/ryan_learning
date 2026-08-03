import { describe, expect, it } from "vitest";
import {
  mergeSearchHits,
  runJs,
  runPython,
  statusLabelForTool,
} from "./tutor-harness";

describe("tutor-harness runners", () => {
  it("runs a simple python print", async () => {
    const out = await runPython("print(2 + 2)");
    expect(out).toContain("OK");
    expect(out).toContain("4");
  });

  it("runs a simple js console.log", async () => {
    const out = await runJs("console.log(3 * 3)");
    expect(out).toContain("OK");
    expect(out).toContain("9");
  });

  it("blocks dangerous python APIs", async () => {
    await expect(
      runPython("import os\nos.system('echo hi')"),
    ).rejects.toThrow(/blocked/i);
  });

  it("maps tool status labels", () => {
    expect(statusLabelForTool("web_search")).toMatch(/Search/i);
    expect(statusLabelForTool("run_python")).toMatch(/Python/i);
  });
});

describe("mergeSearchHits", () => {
  it("prefers earlier batches and dedupes URLs", () => {
    const merged = mergeSearchHits(
      [
        [
          {
            title: "G1",
            url: "https://a.example/x/",
            snippet: "g",
            source: "google",
          },
        ],
        [
          {
            title: "D1",
            url: "https://a.example/x",
            snippet: "d",
            source: "ddg",
          },
          {
            title: "D2",
            url: "https://b.example/y",
            snippet: "d2",
          },
        ],
      ],
      5,
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]!.title).toBe("G1");
    expect(merged[1]!.title).toBe("D2");
  });
});
