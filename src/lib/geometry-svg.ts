/** Sanitize tutor-emitted SVG so we can safely inline it. */
export function sanitizeSvg(raw: string): string | null {
  let s = repairCollapsedSvg(raw).trim();
  if (!s) return null;
  // Allow fenced content that includes xml prologue
  s = s.replace(/<\?xml[\s\S]*?\?>/i, "").trim();
  // Models often emit "svg<svg ...>" (fence language glued to tag)
  s = s.replace(/^svg\s*(?=<svg\b)/i, "").trim();
  if (!/<svg[\s>]/i.test(s)) {
    // Wrap bare drawing commands if missing root (rare)
    if (/<(path|circle|line|polygon|polyline|rect|text|g)\b/i.test(s)) {
      s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">${s}</svg>`;
    } else {
      return null;
    }
  }
  // Strip dangerous bits
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript:/gi, "");
  s = s.replace(/data:text\/html/gi, "");
  if (!s.includes("xmlns=")) {
    s = s.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return s;
}

/** Repair SVG that lost spaces in streaming (e.g. `<svgxmlns=` / `viewBox="00320240"`). */
export function repairCollapsedSvg(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return s;
  s = s.replace(/^```svg\s*/i, "").replace(/```+$/i, "").trim();
  s = s.replace(/^svg(?=<svg)/i, "");

  // <svgxmlns= → <svg xmlns=
  s = s.replace(
    /<(svg|path|circle|line|polygon|polyline|rect|text|g|defs)(?=[a-zA-Z_])/gi,
    "<$1 ",
  );
  // >rectwidth= → ><rect width=  (opening < lost after previous tag)
  s = s.replace(
    />(svg|path|circle|line|polygon|polyline|rect|text|g|defs)(?=[a-zA-Z_][\w:-]*=)/gi,
    "><$1 ",
  );

  // xmlns value ate the next attributes: xmlns="http://wwww3.org2000svgviewBox="00…
  s = s.replace(
    /xmlns="http:\/\/w+w3\.org[^"]*?(?=viewBox|width|height|role|aria-|$)/gi,
    'xmlns="http://www.w3.org/2000/svg" ',
  );
  s = s.replace(
    /xmlns="http:\/\/wwww3\.org2000svg"/gi,
    'xmlns="http://www.w3.org/2000/svg"',
  );
  s = s.replace(
    /xmlns="http:\/\/w{3,}w3\.org\/?2000\/?svg"/gi,
    'xmlns="http://www.w3.org/2000/svg"',
  );

  // viewBox="00320240" or viewBox="00320240width=…
  s = s.replace(/viewBox="00(\d{3})(\d{3})(?="|[a-z])/gi, 'viewBox="0 0 $1 $2"');
  s = s.replace(/viewBox="0 0 (\d{3})(\d{3})"/gi, 'viewBox="0 0 $1 $2"');

  // Closing quote glued to next attr: "100%"role= → "100%" role=
  // Do NOT match inside values (xmlns="http… would become xmlns=" http…).
  s = s.replace(/"([a-zA-Z_][\w:-]*=)/g, '" $1');

  // Closing fence glued: </svg```
  s = s.replace(/<\/svg```+/gi, "</svg>");

  // Restore a few frequent hyphenated attrs if glued
  s = s.replace(
    /\s(stroke|font|text|aria|fill|dominant)(width|size|anchor|label|opacity|baseline)=/gi,
    " $1-$2=",
  );

  // Drop duplicate / broken xmlns leftovers — keep a single canonical one
  s = s.replace(/\sxmlns="[^"]*"/gi, "");
  s = s.replace(
    /<svg\b/i,
    '<svg xmlns="http://www.w3.org/2000/svg"',
  );
  if (!/viewBox=/i.test(s)) {
    s = s.replace(/<svg\b/i, '<svg viewBox="0 0 320 240"');
  }
  return s;
}

function utf8ToBase64(text: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Extract plain text from react-markdown code children. */
export function nodeText(children: unknown): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) return children.map(nodeText).join("");
  if (typeof children === "object" && children !== null && "props" in children) {
    const el = children as { props?: { children?: unknown } };
    return nodeText(el.props?.children);
  }
  return "";
}

/**
 * Turn sanitized SVG into a markdown image.
 * Use base64 — percent-encoded data URIs often fail to render in react-markdown / mobile WebViews.
 */
export function svgToMarkdownImage(svg: string, alt = "diagram"): string | null {
  const safe = sanitizeSvg(svg);
  if (!safe) return null;
  const b64 = utf8ToBase64(safe);
  return `![${alt}](data:image/svg+xml;base64,${b64})`;
}

/** Match tutor diagram markdown images (percent-encoded or base64). */
export const DIAGRAM_IMAGE_RE =
  /!\[([^\]]*)\]\((data:image\/svg\+xml(?:;base64)?,[^)]+)\)/gi;

export type TutorContentPart =
  | { kind: "text"; text: string }
  | { kind: "img"; src: string; alt: string };

/**
 * Split normalized tutor markdown so diagram images are rendered as real <img>
 * nodes — never depend on react-markdown parsing multi-KB data URIs.
 */
export function splitTutorContent(content: string): TutorContentPart[] {
  const prepared = normalizeTutorMarkdown(content || "");
  const parts: TutorContentPart[] = [];
  const re = new RegExp(DIAGRAM_IMAGE_RE.source, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prepared))) {
    if (m.index > last) {
      parts.push({ kind: "text", text: prepared.slice(last, m.index) });
    }
    parts.push({
      kind: "img",
      alt: m[1] || "diagram",
      src: m[2]!,
    });
    last = m.index + m[0].length;
  }
  if (last < prepared.length) {
    parts.push({ kind: "text", text: prepared.slice(last) });
  }
  return parts.length ? parts : [{ kind: "text", text: prepared }];
}

/**
 * Repair tutor SVG output:
 * - ```svg fences (including "svg<svg" glue)
 * - bare svg<svg>...</svg> (including mid-line — react-markdown strips raw HTML)
 * Convert them to markdown images so rendering never depends on code-fence components.
 */
/** Convert percent-encoded SVG data URIs to base64 (more reliable in <img>). */
function reencodeDiagramDataUris(content: string): string {
  return content.replace(
    /!\[([^\]]*)\]\((data:image\/svg\+xml)(?!;base64),([^)]+)\)/gi,
    (_m, alt: string, prefix: string, payload: string) => {
      try {
        let svg = payload;
        if (/%[0-9A-Fa-f]{2}/.test(payload) || payload.startsWith("%")) {
          svg = decodeURIComponent(payload.replace(/\+/g, " "));
        } else if (payload.trimStart().startsWith("<")) {
          svg = payload;
        } else {
          return _m;
        }
        const img = svgToMarkdownImage(svg, alt || "diagram");
        return img || _m;
      } catch {
        return _m;
      }
    },
  );
}

export function normalizeTutorMarkdown(content: string): string {
  let t = content || "";

  // Prefer base64 for any existing percent-encoded diagram images
  t = reencodeDiagramDataUris(t);

  // ```svg ... ```  (body may start with svg<svg or <svg, possibly space-collapsed)
  t = t.replace(/```svg\s*\n?([\s\S]*?)```/gi, (_m, body: string) => {
    const raw = repairCollapsedSvg(
      String(body).trim().replace(/^svg\s*(?=<svg\b)/i, ""),
    );
    const img = svgToMarkdownImage(raw);
    return img ? `\n${img}\n` : _m;
  });

  // Collapsed fence without closing ``` properly: ```svg<svg...></svg```
  t = t.replace(/```svg\s*(<svg\b[\s\S]*?<\/svg>)\s*```?/gi, (_m, body: string) => {
    const img = svgToMarkdownImage(repairCollapsedSvg(body));
    return img ? `\n${img}\n` : _m;
  });

  // Generic fence whose body is clearly SVG
  t = t.replace(/```(\w*)\s*\n?([\s\S]*?)```/g, (m, lang: string, body: string) => {
    if (/^(svg|xml)$/i.test(lang || "")) return m; // already handled
    const raw = repairCollapsedSvg(
      String(body).trim().replace(/^svg\s*(?=<svg\b)/i, ""),
    );
    if (!/^<svg[\s>]/i.test(raw)) return m;
    const img = svgToMarkdownImage(raw);
    return img ? `\n${img}\n` : m;
  });

  // Bare: svg<svg ...></svg> anywhere (models glue the fence language to the tag)
  t = t.replace(/\bsvg\s*(<svg\b[\s\S]*?<\/svg>)/gi, (_m, svg: string) => {
    const img = svgToMarkdownImage(repairCollapsedSvg(svg));
    return img ? `\n${img}\n` : _m;
  });

  // Space-collapsed: svg<svgxmlns=...></svg```  (no spaces, broken close)
  t = t.replace(
    /\bsvg<svgxmlns=[\s\S]*?<\/svg```?/gi,
    (m) => {
      const raw = repairCollapsedSvg(m.replace(/\bsvg(?=<svg)/i, "").replace(/```$/i, ""));
      const img = svgToMarkdownImage(raw);
      return img ? `\n${img}\n` : m;
    },
  );

  // Bare <svg>...</svg> mid-prose (react-markdown strips raw HTML → invisible figure)
  t = t.replace(/<svg\b[\s\S]*?<\/svg>/gi, (m) => {
    if (m.includes("data:image/svg+xml")) return m;
    const img = svgToMarkdownImage(repairCollapsedSvg(m));
    return img ? `\n${img}\n` : m;
  });

  return t;
}

/** Pull a markdown diagram image out of a harness / MCP tool result. */
export function extractGeometryMarkdown(result: unknown): string | null {
  const texts: string[] = [];
  const walk = (v: unknown, depth = 0) => {
    if (depth > 10 || v == null) return;
    if (typeof v === "string") {
      texts.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of ["text", "content", "value", "result", "output", "message"]) {
        if (k in o) walk(o[k], depth + 1);
      }
    }
  };
  walk(result);
  for (const t of texts) {
    const md = t.match(/!\[[^\]]*\]\(data:image\/svg\+xml(?:;base64)?,[^)]+\)/i);
    if (md?.[0]) return md[0];
  }
  for (const t of texts) {
    if (/<svg\b/i.test(t)) {
      const img = svgToMarkdownImage(t);
      if (img) return img;
    }
  }
  return null;
}

/** If the model narrated a figure but forgot to paste it, append captured tool diagrams. */
export function ensureTutorDiagrams(text: string, diagrams: string[]): string {
  const unique = [...new Set(diagrams.filter(Boolean))];
  if (!unique.length) return text;
  if (/data:image\/svg\+xml/i.test(text)) return text;
  const block = unique.join("\n\n");
  const trimmed = (text || "").trim();
  if (!trimmed) return block;
  // Prefer inserting before the first question / options so the figure is visible early
  const askAt = trimmed.search(/\n(?:你|You |Which |揀|选|選)/);
  if (askAt > 40) {
    return `${trimmed.slice(0, askAt).trimEnd()}\n\n${block}\n\n${trimmed.slice(askAt).trimStart()}`;
  }
  return `${block}\n\n${trimmed}`;
}

export type GeomPoint = [number, number];

export type GeomShape =
  | {
      type: "triangle";
      points: [GeomPoint, GeomPoint, GeomPoint];
      labels?: [string, string, string];
      fill?: string;
      stroke?: string;
    }
  | {
      type: "polygon";
      points: GeomPoint[];
      labels?: string[];
      fill?: string;
      stroke?: string;
    }
  | {
      type: "line";
      from: GeomPoint;
      to: GeomPoint;
      stroke?: string;
      dashed?: boolean;
    }
  | {
      type: "segment";
      from: GeomPoint;
      to: GeomPoint;
      stroke?: string;
      midLabel?: string;
    }
  | {
      type: "circle";
      center: GeomPoint;
      r: number;
      fill?: string;
      stroke?: string;
    }
  | {
      type: "point";
      at: GeomPoint;
      label?: string;
      color?: string;
    }
  | {
      type: "angle";
      at: GeomPoint;
      from: GeomPoint;
      to: GeomPoint;
      label?: string;
      radius?: number;
    }
  | {
      type: "right_angle";
      at: GeomPoint;
      from: GeomPoint;
      to: GeomPoint;
      size?: number;
    }
  | {
      type: "text";
      at: GeomPoint;
      text: string;
      size?: number;
    }
  | {
      type: "arrow";
      from: GeomPoint;
      to: GeomPoint;
      stroke?: string;
    }
  | {
      /** Singapore bar model — horizontal or vertical bar with label. */
      type: "bar";
      from: GeomPoint;
      /** Width × height of the bar. */
      size: [number, number];
      label?: string;
      /** Label at top/left (quantity label). */
      quantityLabel?: string;
      fill?: string;
      stroke?: string;
      /** Dashed outline for unknown quantities. */
      dashed?: boolean;
    };

export type GeometrySpec = {
  width?: number;
  height?: number;
  title?: string;
  shapes: GeomShape[];
  /** CA-8 — stable id so the client can replace prior revisions */
  diagramId?: string;
  /** CA-8 — monotonic revision (1, 2, 3…) */
  revision?: number;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Round geometry numbers so SVG/data-URIs stay compact (and TTS-safe). */
function n(x: number): number {
  return Math.round(x);
}

function labelOffset(
  p: GeomPoint,
  neighbors: GeomPoint[],
): GeomPoint {
  // Nudge label away from figure center
  let cx = 0;
  let cy = 0;
  for (const n of neighbors) {
    cx += n[0];
    cy += n[1];
  }
  cx /= Math.max(neighbors.length, 1);
  cy /= Math.max(neighbors.length, 1);
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  const len = Math.hypot(dx, dy) || 1;
  return [n(p[0] + (dx / len) * 14), n(p[1] + (dy / len) * 14)];
}

function unit(from: GeomPoint, to: GeomPoint): GeomPoint {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function renderShape(shape: GeomShape, idx: number): string {
  const stroke = "stroke" in shape && shape.stroke ? shape.stroke : "#1f4d4a";
  const fill =
    "fill" in shape && shape.fill
      ? shape.fill
      : shape.type === "triangle" || shape.type === "polygon" || shape.type === "circle"
        ? "rgba(46,139,132,0.12)"
        : "none";

  if (shape.type === "triangle" || shape.type === "polygon") {
    const pts = shape.points;
    const poly = pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" ");
    let out = `<polygon points="${poly}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    const labels = shape.labels || [];
    labels.forEach((lab, i) => {
      if (!lab || !pts[i]) return;
      const [lx, ly] = labelOffset(pts[i]!, pts);
      out += `<text x="${lx}" y="${ly}" font-size="14" font-family="Source Sans 3, sans-serif" fill="#163532" text-anchor="middle" dominant-baseline="middle">${esc(lab)}</text>`;
    });
    return out;
  }

  if (shape.type === "line" || shape.type === "segment" || shape.type === "arrow") {
    const dash = shape.type === "line" && shape.dashed ? ' stroke-dasharray="6 4"' : "";
    let out = `<line x1="${n(shape.from[0])}" y1="${n(shape.from[1])}" x2="${n(shape.to[0])}" y2="${n(shape.to[1])}" stroke="${stroke}" stroke-width="2"${dash}/>`;
    if (shape.type === "segment" && shape.midLabel) {
      const mx = n((shape.from[0] + shape.to[0]) / 2);
      const my = n((shape.from[1] + shape.to[1]) / 2);
      out += `<text x="${mx}" y="${my - 8}" font-size="13" fill="#163532" text-anchor="middle">${esc(shape.midLabel)}</text>`;
    }
    if (shape.type === "arrow") {
      const [ux, uy] = unit(shape.from, shape.to);
      const tip = shape.to;
      const left: GeomPoint = [
        n(tip[0] - ux * 12 + uy * 6),
        n(tip[1] - uy * 12 - ux * 6),
      ];
      const right: GeomPoint = [
        n(tip[0] - ux * 12 - uy * 6),
        n(tip[1] - uy * 12 + ux * 6),
      ];
      out += `<polygon points="${n(tip[0])},${n(tip[1])} ${left.join(",")} ${right.join(",")}" fill="${stroke}"/>`;
    }
    return out;
  }

  if (shape.type === "circle") {
    return `<circle cx="${n(shape.center[0])}" cy="${n(shape.center[1])}" r="${n(shape.r)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }

  if (shape.type === "point") {
    const color = shape.color || stroke;
    let out = `<circle cx="${n(shape.at[0])}" cy="${n(shape.at[1])}" r="4" fill="${color}"/>`;
    if (shape.label) {
      out += `<text x="${n(shape.at[0] + 10)}" y="${n(shape.at[1] - 8)}" font-size="14" fill="#163532">${esc(shape.label)}</text>`;
    }
    return out;
  }

  if (shape.type === "angle") {
    const r = shape.radius ?? 28;
    const [u1x, u1y] = unit(shape.at, shape.from);
    const [u2x, u2y] = unit(shape.at, shape.to);
    const a1 = Math.atan2(u1y, u1x);
    const a2 = Math.atan2(u2y, u2x);
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta >= 0 ? 1 : 0;
    const p1: GeomPoint = [
      n(shape.at[0] + Math.cos(a1) * r),
      n(shape.at[1] + Math.sin(a1) * r),
    ];
    const p2: GeomPoint = [
      n(shape.at[0] + Math.cos(a2) * r),
      n(shape.at[1] + Math.sin(a2) * r),
    ];
    let out = `<path d="M ${p1[0]} ${p1[1]} A ${r} ${r} 0 ${large} ${sweep} ${p2[0]} ${p2[1]}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
    if (shape.label) {
      const mid = a1 + delta / 2;
      const lx = n(shape.at[0] + Math.cos(mid) * (r + 14));
      const ly = n(shape.at[1] + Math.sin(mid) * (r + 14));
      out += `<text x="${lx}" y="${ly}" font-size="13" fill="#163532" text-anchor="middle">${esc(shape.label)}</text>`;
    }
    return out;
  }

  if (shape.type === "right_angle") {
    const size = shape.size ?? 14;
    const [u1x, u1y] = unit(shape.at, shape.from);
    const [u2x, u2y] = unit(shape.at, shape.to);
    const a: GeomPoint = [
      n(shape.at[0] + u1x * size),
      n(shape.at[1] + u1y * size),
    ];
    const c: GeomPoint = [
      n(shape.at[0] + u2x * size),
      n(shape.at[1] + u2y * size),
    ];
    const b: GeomPoint = [n(a[0] + u2x * size), n(a[1] + u2y * size)];
    return `<polyline points="${a.join(",")} ${b.join(",")} ${c.join(",")}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  }

  if (shape.type === "text") {
    return `<text x="${n(shape.at[0])}" y="${n(shape.at[1])}" font-size="${shape.size ?? 14}" fill="#163532" text-anchor="middle">${esc(shape.text)}</text>`;
  }

  if (shape.type === "bar") {
    const barFill = shape.fill || "rgba(46,139,132,0.15)";
    const barStroke = shape.stroke || stroke;
    const dash = shape.dashed ? ' stroke-dasharray="6 4"' : "";
    const [w, h] = shape.size;
    const bw = Math.max(8, n(w));
    const bh = Math.max(8, n(h));
    const x = n(shape.from[0]);
    const y = n(shape.from[1]);

    let out = `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${barFill}" stroke="${barStroke}" stroke-width="2.5" rx="4"${dash}/>`;

    // Label inside the bar (centred)
    if (shape.label) {
      const cx = x + bw / 2;
      const cy = y + bh / 2;
      out += `<text x="${n(cx)}" y="${n(cy)}" font-size="15" font-weight="600" fill="#163532" text-anchor="middle" dominant-baseline="middle">${esc(shape.label)}</text>`;
    }

    // Quantity label outside the bar (above for horizontal, left for narrow vertical)
    if (shape.quantityLabel) {
      if (bw >= bh * 0.6) {
        // Horizontal / wide bar → label above
        out += `<text x="${n(x + bw / 2)}" y="${y - 8}" font-size="12" fill="#5a6b68" text-anchor="middle">${esc(shape.quantityLabel)}</text>`;
      } else {
        // Narrow vertical bar → label to the right
        out += `<text x="${x + bw + 10}" y="${n(y + bh / 2)}" font-size="12" fill="#5a6b68" dominant-baseline="middle">${esc(shape.quantityLabel)}</text>`;
      }
    }

    return out;
  }

  return `<!-- unknown shape ${idx} -->`;
}

/** Build a teaching SVG from a simple geometry JSON spec. */
export function buildGeometrySvg(spec: GeometrySpec): string {
  const width = Math.min(Math.max(spec.width ?? 320, 160), 640);
  const height = Math.min(Math.max(spec.height ?? 240, 120), 480);
  const parts = (spec.shapes || []).map((s, i) => renderShape(s, i));
  const title = spec.title
    ? `<text x="${width / 2}" y="18" font-size="13" fill="#5a6b68" text-anchor="middle">${esc(spec.title)}</text>`
    : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(spec.title || "geometry diagram")}">`,
    `<rect width="100%" height="100%" fill="#f7fbfa" rx="12"/>`,
    title,
    ...parts,
    `</svg>`,
  ].join("");
}

export function geometrySpecToMarkdown(spec: GeometrySpec): string {
  const svg = buildGeometrySvg(spec);
  let alt = spec.title || "geometry diagram";
  if (spec.diagramId) {
    const rev = Math.max(1, Math.floor(spec.revision || 1));
    const id = String(spec.diagramId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    alt = `geo:${id || "fig"}:${rev}${spec.title ? ` ${spec.title}` : ""}`;
  }
  const img = svgToMarkdownImage(svg, alt);
  // Prefer markdown image (reliable). Keep a fenced fallback if encoding fails.
  return img ?? `\`\`\`svg\n${svg}\n\`\`\``;
}
