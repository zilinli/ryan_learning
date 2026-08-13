"use client";

import { useEffect, useId, useState } from "react";
import { sanitizeSvg } from "@/lib/geometry-svg";
import { ImageLightbox } from "./ImageLightbox";

type Props = {
  language: string;
  code: string;
  user?: boolean;
};

export function DiagramBlock({ language, code, user }: Props) {
  const lang = (language || "").toLowerCase().replace(/^language-/, "");
  const looksSvg =
    /^<svg[\s>]/i.test(code.trim()) ||
    /^svg\s*<svg\b/i.test(code.trim()) ||
    /^svg<svg/i.test(code.trim()) ||
    /<svg[\s>/][\s\S]*<\/svg>/i.test(code) ||
    /<svgxmlns=/i.test(code);

  if (lang === "svg" || lang === "xml" || looksSvg) {
    return <SvgDiagram code={code} user={user} />;
  }
  if (lang === "mermaid") {
    return <MermaidDiagram code={code} user={user} />;
  }
  return null;
}

export function isDiagramLanguage(language: string | undefined): boolean {
  if (!language) return false;
  const lang = language.replace(/^language-/, "").toLowerCase();
  return lang === "svg" || lang === "xml" || lang === "mermaid";
}

/** Data-URI helper shared by SVG + Mermaid render paths. */
function svgToDataUri(svg: string): string {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

/** Shared diagram card chrome: centered, click-to-zoom, zoom badge. */
function DiagramCard({
  user,
  src,
  children,
}: {
  user?: boolean;
  src: string;
  children: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <div
        className={`tutor-diagram ${user ? "bg-[var(--surface-muted)]" : "bg-[var(--mist)]/80 ring-1 ring-[var(--line)]"}`}
      >
        <button
          type="button"
          className="tutor-diagram-view"
          onClick={() => setZoom(true)}
          aria-label="View larger diagram"
        >
          {children}
        </button>
        <span className="tutor-diagram-zoom-hint" aria-hidden>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </span>
      </div>
      {zoom ? (
        <ImageLightbox src={src} alt="Diagram" onClose={() => setZoom(false)} />
      ) : null}
    </>
  );
}

function SvgDiagram({ code, user }: { code: string; user?: boolean }) {
  const safe = sanitizeSvg(code);
  if (!safe) {
    return (
      <pre
        className={`mb-2 overflow-x-auto rounded-xl p-3 font-mono text-[13px] ${
          user ? "bg-black/20" : "bg-[var(--mist)]"
        }`}
      >
        {code}
      </pre>
    );
  }

  // Prefer <img data-uri> — more reliable than inline SVG in some WebViews
  const src = svgToDataUri(safe);

  return (
    <DiagramCard user={user} src={src}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="diagram" className="tutor-diagram-img" />
    </DiagramCard>
  );
}

/**
 * Mermaid renders an <svg> with an inline `style="max-width: 900px"` that
 * overrides our responsive classes on narrow bubbles — strip it so the figure
 * scales to the container and node labels never overlap/clip.
 */
function normalizeMermaidSvg(svg: string): string {
  return svg.replace(
    /(<svg\b[^>]*?)\sstyle="[^"]*"/i,
    '$1 style="width:100%;max-width:100%;height:auto"',
  );
}

function MermaidDiagram({ code, user }: { code: string; user?: boolean }) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Source Sans 3, sans-serif",
        });
        const id = `mmd-${reactId}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: rendered } = await mermaid.render(id, code.trim());
        if (!cancelled) {
          setSvg(normalizeMermaidSvg(rendered));
          setErr("");
        }
      } catch (e) {
        if (!cancelled) {
          setSvg(null);
          setErr(e instanceof Error ? e.message : "Diagram failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (err) {
    return (
      <pre
        className={`mb-2 overflow-x-auto rounded-xl p-3 font-mono text-[12px] ${
          user ? "bg-black/20" : "bg-[var(--mist)]"
        }`}
      >
        {code}
      </pre>
    );
  }
  if (!svg) {
    return (
      <p className="mb-2 text-xs text-[var(--ink-muted)] last:mb-0">
        Drawing diagram…
      </p>
    );
  }
  return (
    <DiagramCard user={user} src={svgToDataUri(svg)}>
      <div
        className="tutor-diagram-inline"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </DiagramCard>
  );
}
