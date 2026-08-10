"use client";

import { useEffect, useId, useState } from "react";
import { sanitizeSvg } from "@/lib/geometry-svg";

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
  const src = `data:image/svg+xml;base64,${
    typeof Buffer !== "undefined"
      ? Buffer.from(safe, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(safe)))
  }`;

  return (
    <div
      className={`tutor-diagram mb-2 overflow-x-auto rounded-xl p-2 last:mb-0 ${
        user ? "bg-[var(--surface-muted)]" : "bg-[var(--mist)]/80 ring-1 ring-[var(--line)]"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="diagram"
        className="tutor-diagram-img mx-auto w-full max-w-full"
      />
    </div>
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
        user ? "bg-[var(--surface-muted)]" : "bg-[var(--mist)]/80 ring-1 ring-[var(--line)]"
      }`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
