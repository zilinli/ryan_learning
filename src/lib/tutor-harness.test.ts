import { describe, expect, it } from "vitest";
import {
  createTutorHarnessTools,
  mergeSearchHits,
  runJs,
  runPython,
  statusLabelForTool,
} from "./tutor-harness";
import { normalizeTutorMarkdown } from "./geometry-svg";

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
    expect(statusLabelForTool("draw_geometry")).toMatch(/diagram|Drawing/i);
  });
});

describe("draw_geometry harness tool", () => {
  it("returns markdown image (not raw code fence)", async () => {
    const tools = createTutorHarnessTools();
    const result = await tools.draw_geometry!.execute!(
      {
        title: "直角三角形 ABC",
        shapes: [
          {
            type: "triangle",
            points: [
              [70, 190],
              [250, 190],
              [70, 55],
            ],
            labels: ["C", "B", "A"],
          },
          {
            type: "right_angle",
            at: [70, 190],
            from: [250, 190],
            to: [70, 55],
          },
        ],
      },
      {} as never,
    );
    expect(typeof result).toBe("string");
    const md = String(result);
    expect(md).toContain("data:image/svg+xml");
    expect(md).toMatch(/^!\[/);
    const normalized = normalizeTutorMarkdown(`先睇图：\n${md}\n你注意到咩？`);
    expect(normalized).toContain("data:image/svg+xml");
  });

  it("errors when shapes missing", async () => {
    const tools = createTutorHarnessTools();
    const result = await tools.draw_geometry!.execute!({ shapes: [] }, {} as never);
    expect(result).toMatchObject({ isError: true });
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
