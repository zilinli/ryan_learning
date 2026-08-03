"use client";

import { useEffect, useId, useState } from "react";
import { sanitizeSvg } from "@/lib/geometry-svg";

type Props = {
  language: string;
  code: string;
  user?: boolean;
};

export function DiagramBlock({ language, code, user }: Props) {
  const lang = language.toLowerCase();
  if (lang === "svg" || lang === "xml") {
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
  return (
    <div
      className={`tutor-diagram mb-2 overflow-x-auto rounded-xl p-2 last:mb-0 ${
        user ? "bg-white/15" : "bg-[var(--mist)]/80 ring-1 ring-[var(--line)]"
      }`}
      // Tutor-authored SVG only (sanitized)
      dangerouslySetInnerHTML={{ __html: safe }}
    />
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
          setSvg(rendered);
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
    <div
      className={`tutor-diagram mb-2 overflow-x-auto rounded-xl p-2 last:mb-0 ${
        user ? "bg-white/15" : "bg-[var(--mist)]/80 ring-1 ring-[var(--line)]"
      }`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
