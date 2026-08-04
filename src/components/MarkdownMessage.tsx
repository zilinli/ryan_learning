"use client";

import { memo, useState, type ReactNode } from "react";
import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";
import { DiagramBlock, isDiagramLanguage } from "./DiagramBlock";
import {
  nodeText,
  splitTutorContent,
} from "@/lib/geometry-svg";

type Props = {
  content: string;
  variant?: "assistant" | "user";
};

function isEvidenceQuote(text: string): boolean {
  return /^(from\s+photo|photo\s*\d|passage|paragraph|line\s*\d|evidence|source|find this)/i.test(
    text.trim(),
  );
}

function fenceLanguage(className?: string): string {
  const m = /language-([\w-]+)/.exec(className || "");
  return m?.[1] || "";
}

function looksLikeSvg(text: string): boolean {
  const t = text.trim();
  return (
    /^<svg[\s>]/i.test(t) ||
    /^svg\s*<svg\b/i.test(t) ||
    /^svg<svg/i.test(t) ||
    /<svg[\s>/][\s\S]*<\/svg>/i.test(t) ||
    /<svgxmlns=/i.test(t)
  );
}

// ── Progressive Disclosure (Phase 2.3) ────────────────────────────

export function isStepLanguage(lang: string): boolean {
  return lang === "step" || lang === "steps";
}

function parseSteps(body: string): { label: string; content: string }[] {
  const lines = body.split("\n");
  const steps: { label: string; content: string }[] = [];
  let current: { label: string; content: string } | null = null;

  for (const line of lines) {
    const match = /^(\d+)[.)-]\s+(.+)/.exec(line.trim());
    if (match) {
      if (current) steps.push(current);
      current = { label: `Step ${match[1]}: ${match[2]}`, content: "" };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    } else {
      if (!current && line.trim()) {
        current = { label: "Reveal", content: line };
      }
    }
  }
  if (current && current.content.trim()) steps.push(current);
  return steps.length ? steps : [{ label: "Reveal step", content: body }];
}

type StepState = "hidden" | "revealing" | "revealed";

function StepReveal({
  steps,
  variant,
}: {
  steps: { label: string; content: string }[];
  variant: "assistant" | "user";
}) {
  const [states, setStates] = useState<StepState[]>(
    () => steps.map(() => "hidden"),
  );

  const reveal = (i: number) => {
    setStates((prev) => {
      const next = [...prev];
      next[i] = "revealed";
      return next;
    });
  };

  return (
    <div
      className={`my-2 rounded-xl border p-3 ${
        variant === "user"
          ? "border-white/30 bg-white/10"
          : "border-[var(--line)] bg-[var(--mist)]"
      }`}
    >
      <p
        className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${
          variant === "user" ? "text-white/70" : "text-[var(--teal)]"
        }`}
      >
        Step-by-step
      </p>
      <p className="mb-2 text-[12px] text-[var(--ink-muted)]">
        Click each step to reveal — one at a time.
      </p>
      {steps.map((step, i) => {
        const st = states[i]!;
        const isRevealed = st === "revealed";
        return (
          <div
            key={i}
            className={`mb-1.5 rounded-lg border px-3 py-2 transition-all duration-200 ${
              isRevealed
                ? "border-[var(--teal)]/35 bg-white"
                : "cursor-pointer border-[var(--line)] bg-white/60 hover:border-[var(--teal)]/50 hover:bg-white/80"
            }`}
            onClick={() => !isRevealed && reveal(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isRevealed) reveal(i);
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isRevealed
                    ? "bg-[var(--teal)] text-white"
                    : "bg-[var(--line)] text-[var(--ink-muted)]"
                }`}
              >
                {isRevealed ? "\u2713" : i + 1}
              </span>
              <span
                className={`text-[13px] font-medium ${
                  isRevealed ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {isRevealed ? (
              <div className="mt-2 ml-7 text-[14px] leading-6 text-[var(--ink)] whitespace-pre-wrap">
                {step.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TutorImg({
  src,
  alt,
  user,
}: {
  src: string;
  alt: string;
  user: boolean;
}) {
  const ok =
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("data:image/");
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || "diagram"}
      className={`tutor-md-img my-2 max-h-80 w-auto max-w-full rounded-xl object-contain ${
        user
          ? "border border-white/25"
          : "border border-[var(--line)] bg-white"
      }`}
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
  variant = "assistant",
}: Props) {
  const user = variant === "user";
  // Split diagrams out BEFORE react-markdown — long data URIs often fail to parse as images.
  const parts = splitTutorContent(content);

  const components: Components = {
    p: ({ children }) => (
      <p className="mb-2 last:mb-0 leading-7">{children}</p>
    ),
    strong: ({ children }) => (
      <strong
        className={
          user ? "font-semibold text-white" : "font-semibold text-[var(--ink)]"
        }
      >
        {children}
      </strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => (
      <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={
          user
            ? "underline underline-offset-2"
            : "text-[var(--teal)] underline underline-offset-2"
        }
      >
        {children}
      </a>
    ),
    img: ({ src, alt }) => (
      <TutorImg
        src={typeof src === "string" ? src : ""}
        alt={alt || "illustration"}
        user={user}
      />
    ),
    code: ({ className, children, ...props }) => {
      const lang = fenceLanguage(className);
      const text = nodeText(children).replace(/\n$/, "");
      if (isStepLanguage(lang)) {
        return <StepReveal steps={parseSteps(text)} variant="assistant" />;
      }
      if (isDiagramLanguage(lang) || looksLikeSvg(text)) {
        return (
          <DiagramBlock
            language={looksLikeSvg(text) ? "svg" : lang || "svg"}
            code={text}
            user={user}
          />
        );
      }
      const inline = !className;
      if (inline) {
        return (
          <code
            className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${
              user ? "bg-white/20" : "bg-[var(--mist)] text-[var(--ink)]"
            }`}
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          className={`block overflow-x-auto rounded-xl p-3 font-mono text-[13px] leading-6 ${
            user ? "bg-black/20" : "bg-[var(--mist)]"
          } ${className || ""}`}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => {
      const child = Array.isArray(children) ? children[0] : children;
      if (child && typeof child === "object" && "props" in child) {
        const props = (
          child as { props?: { className?: string; children?: unknown } }
        ).props;
        const lang = fenceLanguage(props?.className);
        const body = nodeText(props?.children).replace(/\n$/, "");
        if (isStepLanguage(lang) || isDiagramLanguage(lang) || looksLikeSvg(body)) {
          return <>{children}</>;
        }
      }
      return <pre className="mb-2 overflow-x-auto last:mb-0">{children}</pre>;
    },
    blockquote: ({ children }) => {
      const text = collectText(children);
      const evidence = !user && isEvidenceQuote(text);
      return (
        <blockquote
          className={
            evidence
              ? "tutor-evidence mb-2 rounded-xl border border-[var(--teal)]/35 bg-[var(--mist)] px-3 py-2.5 text-[var(--ink)] last:mb-0"
              : user
                ? "mb-2 border-l-2 border-white/50 pl-3 opacity-95 last:mb-0"
                : "mb-2 border-l-[3px] border-[var(--teal)] pl-3 text-[var(--ink)] last:mb-0"
          }
        >
          {evidence ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Look here in the passage
            </p>
          ) : null}
          <div className={evidence ? "text-[14px] leading-6" : undefined}>
            {children}
          </div>
        </blockquote>
      );
    },
    h1: ({ children }) => (
      <h3 className="mb-2 text-base font-semibold last:mb-0">{children}</h3>
    ),
    h2: ({ children }) => (
      <h3 className="mb-2 text-base font-semibold last:mb-0">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="mb-1.5 text-sm font-semibold last:mb-0">{children}</h4>
    ),
    hr: () => <hr className="my-3 border-[var(--line)]" />,
    table: ({ children }) => (
      <div className="mb-2 overflow-x-auto last:mb-0">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-[var(--line)] bg-[var(--mist)] px-2 py-1 text-left font-medium">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-[var(--line)] px-2 py-1">{children}</td>
    ),
  };

  if (!content.trim()) return null;

  return (
    <div
      className={`tutor-md max-w-none break-words text-[15px] leading-7 ${
        user ? "text-white [&_.katex]:text-white" : "text-[var(--ink)]"
      }`}
    >
      {parts.map((part, i) =>
        part.kind === "img" ? (
          <TutorImg key={`img-${i}`} src={part.src} alt={part.alt} user={user} />
        ) : part.text.trim() ? (
          <ReactMarkdown
            key={`md-${i}`}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              [rehypeKatex, { throwOnError: false, strict: "ignore" }],
            ]}
            components={components}
          >
            {part.text}
          </ReactMarkdown>
        ) : null,
      )}
    </div>
  );
});

function collectText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const el = node as { props?: { children?: ReactNode } };
    return collectText(el.props?.children);
  }
  return "";
}
