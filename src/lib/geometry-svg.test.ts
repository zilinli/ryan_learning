import { describe, expect, it } from "vitest";
import {
  buildGeometryStepSvgs,
  buildGeometrySvg,
  describeGeometryShapes,
  ensureTutorDiagrams,
  geometrySpecToMarkdown,
  normalizeTutorMarkdown,
  sanitizeSvg,
  splitTutorContent,
  svgToMarkdownImage,
  type GeometrySpec,
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
    expect(out!.trim().startsWith("svg")).toBe(false);
  });

  it("expands viewBox when joke text overflows the right edge", () => {
    // Real production case: electron joke — text at x=250 past viewBox 360
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 220" width="360" height="220">
  <rect width="360" height="220" fill="#0f172a" rx="12"/>
  <text x="250" y="55" fill="#e2e8f0" font-size="13">「我掉一个电子！」</text>
  <text x="250" y="195" fill="#fbbf24" font-size="13" font-weight="700">「确定！我是 positive！」</text>
</svg>`;
    const out = sanitizeSvg(raw)!;
    const vb = /viewBox="([^"]+)"/.exec(out)![1]!.split(/\s+/).map(Number);
    expect(vb[0]).toBe(0);
    expect(vb[2]).toBeGreaterThan(360);
    const w = /width="(\d+)"/.exec(out);
    expect(Number(w![1])).toBeGreaterThan(360);
    // Background rect should stretch with the new canvas
    expect(out).toMatch(/<rect[^>]*width="4\d{2}"/);
  });
});

describe("svgToMarkdownImage / normalizeTutorMarkdown", () => {
  it("emits a base64 data-uri markdown image", () => {
    const img = svgToMarkdownImage(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
    );
    expect(img).toMatch(/^!\[.*\]\(data:image\/svg\+xml;base64,/);
    const b64 = img!.match(/base64,([^)]+)/)?.[1];
    expect(b64).toBeTruthy();
    const decoded = Buffer.from(b64!, "base64").toString("utf8");
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("www.w3.org");
  });

  it("converts fenced and glued svg to markdown images", () => {
    const fenced = normalizeTutorMarkdown(
      'see\n```svg\n<svg viewBox="0 0 10 10"></svg>\n```\nend',
    );
    expect(fenced).toContain("data:image/svg+xml;base64,");
    expect(fenced).not.toContain("```svg");

    const glued = normalizeTutorMarkdown(
      'look\nsvg<svg viewBox="0 0 10 10"></svg>\nend',
    );
    expect(glued).toContain("data:image/svg+xml;base64,");
    expect(glued).not.toMatch(/svg<svg/);
  });

  it("repairs the production bug: svg<svg…> shown as code", () => {
    // Exact shape users saw in chat (language tag glued to markup, no fence)
    const raw =
      "好的，我画一个直角三角形 ABC，直角在 C。\n\n" +
      'svg<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="100%" role="img" aria-label="直角三角形 ABC">' +
      '<rect width="100%" height="100%" fill="#f7fbfa" rx="12"/>' +
      '<polygon points="70 190 250 190 70 55" fill="rgba(46,139,132,0.12)" stroke="#1f4d4a" stroke-width="2"/>' +
      '<polyline points="70 176 84 176 84 190" fill="none" stroke="#1f4d4a" stroke-width="1.5"/>' +
      '<text x="58" y="42" font-size="16" fill="#1f4d4a">A</text>' +
      '<text x="252" y="205" font-size="16" fill="#1f4d4a">B</text>' +
      '<text x="52" y="210" font-size="16" fill="#1f4d4a">C</text>' +
      "</svg>\n\n" +
      "你注意到什么？";

    const out = normalizeTutorMarkdown(raw);
    expect(out).toContain("data:image/svg+xml;base64,");
    expect(out).not.toMatch(/svg<svg/);
    expect(out).toContain("你注意到什么");

    const b64 = out.match(/base64,([^)\s]+)/)?.[1];
    expect(b64).toBeTruthy();
    const decoded = Buffer.from(b64!, "base64").toString("utf8");
    expect(decoded).toContain("<polygon");
    expect(decoded).toContain(">A<");
    expect(decoded).toContain(">C<");
  });

  it("does not corrupt linearGradient / radialGradient / textPath tags", () => {
    const raw = `\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 260">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B8E0F8"/>
    </linearGradient>
    <marker id="m" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="#E09B1A"/>
    </marker>
  </defs>
  <rect width="360" height="260" fill="url(#sky)" rx="12"/>
  <textPath href="#p">hi</textPath>
</svg>
\`\`\``;
    const out = normalizeTutorMarkdown(raw);
    expect(out).toContain("data:image/svg+xml;base64,");
    const b64 = out.match(/base64,([^)\s]+)/)?.[1];
    const decoded = Buffer.from(b64!, "base64").toString("utf8");
    expect(decoded).toContain("<linearGradient");
    expect(decoded).not.toContain("<line arGradient");
    expect(decoded).toContain('id="sky"');
    expect(decoded).toContain("url(#sky)");
  });

  it("still repairs collapsed <svgxmlns= / <rectwidth=", () => {
    const collapsed =
      '```svg<svgxmlns="http://wwww3.org2000svgviewBox="00320240width="100%"role="img">' +
      'rectwidth="100%"height="100%"fill="#f7fbfa"/>' +
      'polygonpoints="70,190 250,190 70,55"stroke="#1f4d4a"/>' +
      "</svg```";
    const out = normalizeTutorMarkdown(`图：${collapsed}\n你注意到咩？`);
    expect(out).toContain("data:image/svg+xml;base64,");
    const b64 = out.match(/base64,([^)\s]+)/)?.[1];
    const decoded = Buffer.from(b64!, "base64").toString("utf8");
    expect(decoded).toMatch(/<svg\s/i);
    expect(decoded).toContain("www.w3.org");
    expect(decoded).toContain("viewBox=");
  });

  it("converts mid-line bare svg (react-markdown would strip HTML)", () => {
    const out = normalizeTutorMarkdown(
      '睇吓呢个图：<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"/></svg>你睇到咩？',
    );
    expect(out).toContain("data:image/svg+xml;base64,");
    expect(out).not.toMatch(/<svg\b/);
    expect(out).toContain("睇吓呢个图");
    expect(out).toContain("你睇到咩");
  });

  it("re-encodes percent-encoded SVG data URIs to base64", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"/></svg>';
    const pct = `![直角三角形](data:image/svg+xml,${encodeURIComponent(svg)})`;
    const out = normalizeTutorMarkdown(`图：\n${pct}\n继续`);
    expect(out).toContain("data:image/svg+xml;base64,");
    expect(out).not.toMatch(/data:image\/svg\+xml,%/);
    const parts = splitTutorContent(out);
    expect(parts.some((p) => p.kind === "img" && p.src.includes(";base64,"))).toBe(
      true,
    );
  });

  it("splitTutorContent isolates images from markdown text", () => {
    const md = svgToMarkdownImage(
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"/></svg>',
    )!;
    const parts = splitTutorContent(`先睇图：\n${md}\n你注意到咩？`);
    expect(parts.some((p) => p.kind === "img")).toBe(true);
    expect(parts.some((p) => p.kind === "text" && p.text.includes("先睇图"))).toBe(
      true,
    );
    const img = parts.find((p) => p.kind === "img");
    expect(
      img &&
        img.kind === "img" &&
        img.src.startsWith("data:image/svg+xml;base64,"),
    ).toBe(true);
  });

  it("ensureTutorDiagrams inserts when model forgot to paste", () => {
    const diagram = svgToMarkdownImage(
      '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
    )!;
    const out = ensureTutorDiagrams("睇吓橙色嗰条边。你觉得佢有咩特别？", [
      diagram,
    ]);
    expect(out).toContain("data:image/svg+xml;base64,");
    expect(out).toContain("睇吓橙色");
  });
});

describe("buildGeometrySvg", () => {
  it("renders a labeled right triangle as markdown image", () => {
    const md = geometrySpecToMarkdown({
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
    });
    expect(md).toContain("data:image/svg+xml");
    expect(md).toMatch(/^!\[/);

    const svg = buildGeometrySvg({
      shapes: [{ type: "circle", center: [10, 10], r: 5 }],
    });
    expect(svg).toContain("<circle");
  });

  it("P3: overview keeps every shape bright", () => {
    const svg = buildGeometrySvg({
      shapes: [
        { type: "circle", center: [40, 60], r: 20 },
        { type: "circle", center: [160, 120], r: 30 },
      ],
      steps: [{ caption: "Focus the big circle", highlight: [1] }],
    });
    expect(svg).not.toContain('opacity="0.25"');
    expect(svg).not.toContain("Focus the big circle");
  });

  it("P3: active step dims non-highlighted shapes and pins the callout", () => {
    const spec = {
      shapes: [
        { type: "circle", center: [40, 60], r: 20 },
        { type: "circle", center: [160, 120], r: 30 },
      ],
      steps: [
        { caption: "The big circle is the whole.", highlight: [1], note: "r = 30" },
      ],
    };
    const svg = buildGeometrySvg(spec, { stepIndex: 0 });
    expect(svg).toContain('opacity="0.25"'); // shape 0 dimmed
    expect(svg).toContain("The big circle is the whole.");
    expect(svg).toContain("r = 30");
  });

  it("P3: buildGeometryStepSvgs yields overview + one view per step", () => {
    const spec = {
      title: "Squares",
      shapes: [
        { type: "circle", center: [40, 60], r: 20 },
        { type: "circle", center: [160, 120], r: 30 },
      ],
      steps: [
        { caption: "Step one", highlight: [0] },
        { caption: "Step two", highlight: [1], note: "note" },
      ],
    };
    const views = buildGeometryStepSvgs(spec);
    expect(views).toHaveLength(3);
    expect(views[0]!.caption).toBe("Overview");
    expect(views[1]!.svg).toContain('opacity="0.25"');
    expect(views[1]!.svg).toContain("Step one");
    expect(views[2]!.svg).toContain("note");
  });

  it("P3: geometrySpecToMarkdown embeds a geom-steps fence when steps exist", () => {
    const md = geometrySpecToMarkdown({
      title: "Tri",
      shapes: [{ type: "circle", center: [40, 60], r: 20 }],
      steps: [{ caption: "Here it is", highlight: [0] }],
    });
    expect(md).toContain("```geom-steps");
    expect(md).toContain('"caption":"Here it is"');
    // Overview image still first
    expect(md.indexOf("data:image/svg+xml")).toBeLessThan(md.indexOf("geom-steps"));
  });

  it("P3: no fence when steps are missing", () => {
    const md = geometrySpecToMarkdown({
      shapes: [{ type: "circle", center: [40, 60], r: 20 }],
    });
    expect(md).not.toContain("geom-steps");
  });
});

describe("describeGeometryShapes (P2-5 where-to-look)", () => {
  const spec: GeometrySpec = {
    shapes: [
      { type: "triangle", points: [[10, 10], [110, 10], [60, 90]], labels: ["A", "B", "C"] },
      { type: "segment", from: [10, 10], to: [110, 10], midLabel: "base = 5 cm" },
      { type: "angle", at: [10, 10], from: [60, 90], to: [110, 10], label: "θ" },
      { type: "bar", from: [10, 140], size: [80, 30], quantityLabel: "12" },
      { type: "point", at: [60, 90], label: "C" },
      { type: "circle", center: [200, 60], r: 24 },
    ],
    steps: [],
  };

  it("describes highlighted shapes with their labels", () => {
    expect(describeGeometryShapes(spec, [0])).toEqual(["triangle A·B·C"]);
    expect(describeGeometryShapes(spec, [1])).toEqual(["segment base = 5 cm"]);
    expect(describeGeometryShapes(spec, [2])).toEqual(["angle θ"]);
    expect(describeGeometryShapes(spec, [3])).toEqual(["12"]);
    expect(describeGeometryShapes(spec, [4])).toEqual(["point C"]);
  });

  it("falls back to plain type names when labels are missing", () => {
    const bare = describeGeometryShapes(
      { shapes: [{ type: "circle", center: [5, 5], r: 2 }], steps: [] },
      [0],
    );
    expect(bare).toEqual(["circle"]);
  });

  it("skips out-of-range indexes", () => {
    expect(describeGeometryShapes(spec, [99])).toEqual([]);
    expect(describeGeometryShapes(spec, [])).toEqual([]);
  });
});
