/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// Mock KaTeX CSS
vi.mock("katex/dist/katex.min.css", () => ({}));

// Mock DiagramBlock
vi.mock("./DiagramBlock", () => ({
  DiagramBlock: ({ language, code }: { language: string; code: string }) =>
    React.createElement("div", {
      "data-testid": "diagram",
      "data-language": language,
      "data-code": code,
    }),
  isDiagramLanguage: (lang: string) =>
    ["mermaid", "svg", "geometry"].includes(lang),
}));

vi.mock("@/lib/geometry-svg", () => ({
  nodeText: (children: unknown) => {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.join("");
    return String(children ?? "");
  },
  splitTutorContent: (content: string) => {
    // Return as text-only parts for test simplicity
    return content.trim()
      ? [{ kind: "text" as const, text: content }]
      : [];
  },
}));

describe("MarkdownMessage", () => {
  it("renders markdown content as text", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    render(
      React.createElement(MarkdownMessage, {
        content: "Hello, this is **bold** text.",
        variant: "assistant",
      }),
    );

    // The ReactMarkdown component should render the text
    const container = screen.getByText(/Hello/);
    expect(container).toBeTruthy();
  });

  it("renders LaTeX expressions", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    render(
      React.createElement(MarkdownMessage, {
        content: "The formula is $E = mc^2$.",
        variant: "assistant",
      }),
    );

    // Should render the math formula
    expect(screen.getByText(/E = mc/)).toBeTruthy();
  });

  it("renders bold text in user variant", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    render(
      React.createElement(MarkdownMessage, {
        content: "**My answer** is correct.",
        variant: "user",
      }),
    );

    expect(screen.getByText(/My answer/)).toBeTruthy();
    expect(screen.getByText(/is correct/)).toBeTruthy();
  });

  it("renders inline code", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    render(
      React.createElement(MarkdownMessage, {
        content: "Use the `print()` function.",
        variant: "assistant",
      }),
    );

    expect(screen.getByText(/print/)).toBeTruthy();
  });

  it("renders numbered lists", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    render(
      React.createElement(MarkdownMessage, {
        content: "Step 1: Start\nStep 2: Continue\nStep 3: End",
        variant: "assistant",
      }),
    );

    expect(screen.getByText(/Start/)).toBeTruthy();
  });

  it("renders empty content as null", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    const { container } = render(
      React.createElement(MarkdownMessage, {
        content: "   ",
        variant: "assistant",
      }),
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders blockquotes for evidence", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    render(
      React.createElement(MarkdownMessage, {
        content: "> From the passage, line 12 shows the key idea.",
        variant: "assistant",
      }),
    );

    // Blockquotes should render
    expect(screen.getByText(/From the passage/)).toBeTruthy();
  });

  it("renders step reveal for step fences", async () => {
    const { MarkdownMessage } = await import("./MarkdownMessage");
    render(
      React.createElement(MarkdownMessage, {
        content:
          '```step\n1. First, identify the problem\n2. Then, solve it step by step\n```',
        variant: "assistant",
      }),
    );

    expect(screen.getByText("Step-by-step")).toBeTruthy();
  });
});
