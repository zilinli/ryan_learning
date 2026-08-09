/**
 * CA-8 — diagramId + revision: replace prior SVG with same id in a thread.
 *
 * Alt convention: `geo:<diagramId>:<revision> <optional title>`
 * Example: `![geo:tri1:2 Right triangle](data:image/svg+xml;base64,...)`
 */

import { DIAGRAM_IMAGE_RE } from "./geometry-svg";

export type DiagramMeta = {
  diagramId: string;
  revision: number;
  title: string;
};

const ALT_RE = /^geo:([^:\s]+):(\d+)\s*(.*)$/i;

export function parseDiagramAlt(alt: string): DiagramMeta | null {
  const m = (alt || "").trim().match(ALT_RE);
  if (!m) return null;
  return {
    diagramId: m[1]!,
    revision: Math.max(1, Math.floor(Number(m[2]) || 1)),
    title: (m[3] || "").trim(),
  };
}

export function formatDiagramAlt(
  diagramId: string,
  revision: number,
  title = "",
): string {
  const id = String(diagramId || "fig")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40) || "fig";
  const rev = Math.max(1, Math.floor(revision || 1));
  const t = (title || "").trim().slice(0, 48);
  return t ? `geo:${id}:${rev} ${t}` : `geo:${id}:${rev}`;
}

type ImgHit = {
  full: string;
  alt: string;
  meta: DiagramMeta | null;
  index: number;
};

function listImages(md: string): ImgHit[] {
  const out: ImgHit[] = [];
  const re = new RegExp(DIAGRAM_IMAGE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const alt = m[1] || "";
    out.push({
      full: m[0],
      alt,
      meta: parseDiagramAlt(alt),
      index: m.index,
    });
  }
  return out;
}

/** Within one message: keep only the highest revision per diagramId. */
export function collapseSameDiagramImages(markdown: string): string {
  if (!markdown) return markdown;
  const imgs = listImages(markdown);
  const best = new Map<string, ImgHit>();
  for (const img of imgs) {
    if (!img.meta) continue;
    const prev = best.get(img.meta.diagramId);
    if (!prev || img.meta.revision >= prev.meta!.revision) {
      best.set(img.meta.diagramId, img);
    }
  }
  if (!best.size) return markdown;
  let out = markdown;
  // Remove older same-id images (iterate reverse to keep indices stable-ish via replace)
  for (const img of [...imgs].reverse()) {
    if (!img.meta) continue;
    const keep = best.get(img.meta.diagramId);
    if (keep && keep.full !== img.full) {
      out = out.replace(img.full, "");
    }
  }
  return out.replace(/\n{3,}/g, "\n\n").trimEnd();
}

/**
 * Across a chat thread: for each diagramId, keep the latest revision image
 * and replace earlier occurrences with a short note.
 */
export function collapseDiagramsInMessages<
  T extends { role: string; content: string },
>(messages: T[]): T[] {
  const latest = new Map<string, { rev: number; msgIdx: number }>();
  const parsed: Array<Array<ImgHit>> = messages.map((m) =>
    m.role === "assistant" ? listImages(m.content) : [],
  );

  parsed.forEach((imgs, msgIdx) => {
    for (const img of imgs) {
      if (!img.meta) continue;
      const prev = latest.get(img.meta.diagramId);
      if (!prev || img.meta.revision >= prev.rev) {
        latest.set(img.meta.diagramId, { rev: img.meta.revision, msgIdx });
      }
    }
  });

  if (!latest.size) return messages;

  return messages.map((m, msgIdx) => {
    if (m.role !== "assistant") return m;
    let content = m.content;
    const imgs = parsed[msgIdx] || [];
    for (const img of imgs) {
      if (!img.meta) continue;
      const keep = latest.get(img.meta.diagramId);
      if (!keep) continue;
      if (keep.msgIdx !== msgIdx || img.meta.revision < keep.rev) {
        content = content.replace(
          img.full,
          `\n*(updated figure ${img.meta.diagramId})*\n`,
        );
      }
    }
    content = collapseSameDiagramImages(content);
    return content === m.content ? m : { ...m, content };
  });
}
