import { describe, expect, it } from "vitest";
import {
  buildGeometrySvg,
  geometrySpecToMarkdown,
  normalizeTutorMarkdown,
  sanitizeSvg,
} from "./geometry-svg";

describe("sanitizeSvg", () => {
  it("keeps a simple svg", () => {
    const out = sanitizeSvg(
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3"/></svg>',
    );
    expect(out).toContain("<svg");
    expect(out).toContain("circle");
  });

  it("strips script and event handlers", () => {
    const out = sanitizeSvg(
      '<svg onclick="alert(1)"><script>evil()</script><circle cx="1" cy="1" r="1"/></svg>',
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
  });

  it("strips leading svg language glue", () => {
    const out = sanitizeSvg('svg<svg viewBox="0 0 1 1"></svg>');
    expect(out).toContain("<svg");
    expect(out!.startsWith("svg")).toBe(false);
  });
});

describe("buildGeometrySvg", () => {
  it("renders a labeled triangle", () => {
    const svg = buildGeometrySvg({
      title: "Triangle ABC",
      shapes: [
        {
          type: "triangle",
          points: [
            [40, 200],
            [160, 40],
            [280, 200],
          ],
          labels: ["A", "B", "C"],
        },
        {
          type: "right_angle",
          at: [40, 200],
          from: [280, 200],
          to: [160, 40],
        },
      ],
    });
    expect(svg).toContain("<polygon");
    expect(svg).toContain(">A<");
    expect(svg).toContain("polyline");
    expect(geometrySpecToMarkdown({ shapes: [{ type: "circle", center: [10, 10], r: 5 }] })).toContain(
      "```svg",
    );
  });
});

describe("normalizeTutorMarkdown", () => {
  it("repairs bare svg<svg blocks", () => {
    const out = normalizeTutorMarkdown(
      'look\nsvg<svg viewBox="0 0 10 10"></svg>\nend',
    );
    expect(out).toContain("```svg");
    expect(out).toContain('<svg viewBox="0 0 10 10"></svg>');
    expect(out).not.toMatch(/svg<svg/);
  });
});
