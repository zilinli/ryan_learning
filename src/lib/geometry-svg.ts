
/** Fix common broken SVG fences from the tutor so Markdown can render diagrams. */
export function normalizeTutorMarkdown(content: string): string {
  let t = content || "";
  // ```svg<svg → ```svg\n<svg
  t = t.replace(/```svg\s*(?=<svg\b)/gi, "```svg\n");
  // Fenced block whose body starts with "svg<svg...>"
  t = t.replace(
    /```(?:svg)?\s*\n?svg\s*(<svg\b[\s\S]*?<\/svg>)\s*```/gi,
    "```svg\n$1\n```",
  );
  // Bare "svg<svg...></svg>" not already fenced
  t = t.replace(
    /(^|\n)\s*svg\s*(<svg\b[\s\S]*?<\/svg>)\s*(?=\n|$)/gi,
    "$1\n```svg\n$2\n```\n",
  );
  return t;
}

/** Sanitize tutor-emitted SVG so we can safely inline it. */
export function sanitizeSvg(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // Allow fenced content that includes xml prologue
  s = s.replace(/<\?xml[\s\S]*?\?>/i, "").trim();
  // Models sometimes emit "svg<svg ...>" (language tag glued to markup)
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
    };

export type GeometrySpec = {
  width?: number;
  height?: number;
  title?: string;
  shapes: GeomShape[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  return [p[0] + (dx / len) * 14, p[1] + (dy / len) * 14];
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
    const poly = pts.map((p) => p.join(",")).join(" ");
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
    let out = `<line x1="${shape.from[0]}" y1="${shape.from[1]}" x2="${shape.to[0]}" y2="${shape.to[1]}" stroke="${stroke}" stroke-width="2"${dash}/>`;
    if (shape.type === "segment" && shape.midLabel) {
      const mx = (shape.from[0] + shape.to[0]) / 2;
      const my = (shape.from[1] + shape.to[1]) / 2;
      out += `<text x="${mx}" y="${my - 8}" font-size="13" fill="#163532" text-anchor="middle">${esc(shape.midLabel)}</text>`;
    }
    if (shape.type === "arrow") {
      const [ux, uy] = unit(shape.from, shape.to);
      const tip = shape.to;
      const left: GeomPoint = [tip[0] - ux * 12 + uy * 6, tip[1] - uy * 12 - ux * 6];
      const right: GeomPoint = [tip[0] - ux * 12 - uy * 6, tip[1] - uy * 12 + ux * 6];
      out += `<polygon points="${tip.join(",")} ${left.join(",")} ${right.join(",")}" fill="${stroke}"/>`;
    }
    return out;
  }

  if (shape.type === "circle") {
    return `<circle cx="${shape.center[0]}" cy="${shape.center[1]}" r="${shape.r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }

  if (shape.type === "point") {
    const color = shape.color || stroke;
    let out = `<circle cx="${shape.at[0]}" cy="${shape.at[1]}" r="3.5" fill="${color}"/>`;
    if (shape.label) {
      out += `<text x="${shape.at[0] + 10}" y="${shape.at[1] - 8}" font-size="14" fill="#163532">${esc(shape.label)}</text>`;
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
    const p1: GeomPoint = [shape.at[0] + Math.cos(a1) * r, shape.at[1] + Math.sin(a1) * r];
    const p2: GeomPoint = [shape.at[0] + Math.cos(a2) * r, shape.at[1] + Math.sin(a2) * r];
    let out = `<path d="M ${p1[0]} ${p1[1]} A ${r} ${r} 0 ${large} ${sweep} ${p2[0]} ${p2[1]}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
    if (shape.label) {
      const mid = a1 + delta / 2;
      const lx = shape.at[0] + Math.cos(mid) * (r + 14);
      const ly = shape.at[1] + Math.sin(mid) * (r + 14);
      out += `<text x="${lx}" y="${ly}" font-size="13" fill="#163532" text-anchor="middle">${esc(shape.label)}</text>`;
    }
    return out;
  }

  if (shape.type === "right_angle") {
    const size = shape.size ?? 14;
    const [u1x, u1y] = unit(shape.at, shape.from);
    const [u2x, u2y] = unit(shape.at, shape.to);
    const a: GeomPoint = [shape.at[0] + u1x * size, shape.at[1] + u1y * size];
    const c: GeomPoint = [shape.at[0] + u2x * size, shape.at[1] + u2y * size];
    const b: GeomPoint = [a[0] + u2x * size, a[1] + u2y * size];
    return `<polyline points="${a.join(",")} ${b.join(",")} ${c.join(",")}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
  }

  if (shape.type === "text") {
    return `<text x="${shape.at[0]}" y="${shape.at[1]}" font-size="${shape.size ?? 14}" fill="#163532" text-anchor="middle">${esc(shape.text)}</text>`;
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
  return `\`\`\`svg\n${svg}\n\`\`\``;
}
