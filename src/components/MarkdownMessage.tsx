"use client";

import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";

type Props = {
  content: string;
  variant?: "assistant" | "user";
};

function isEvidenceQuote(text: string): boolean {
  return /^(from\s+photo|photo\s*\d|passage|paragraph|line\s*\d|evidence|source|find this)/i.test(
    text.trim(),
  );
}

export function MarkdownMessage({ content, variant = "assistant" }: Props) {
  const user = variant === "user";

  const components: Components = {
    p: ({ children }) => (
      <p className="mb-2 last:mb-0 leading-7">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className={user ? "font-semibold text-white" : "font-semibold text-[var(--ink)]"}>
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
    code: ({ className, children, ...props }) => {
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
    pre: ({ children }) => (
      <pre className="mb-2 overflow-x-auto last:mb-0">{children}</pre>
    ),
    blockquote: ({ children }) => {
      // Flatten text to detect evidence-style quotes
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

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
