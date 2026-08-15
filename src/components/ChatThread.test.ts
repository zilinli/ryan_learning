/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import type { ChatMessage } from "@/lib/types";

// Mock child components
vi.mock("./MarkdownMessage", () => ({
  MarkdownMessage: ({ content }: { content: string; variant?: string }) =>
    React.createElement("div", { "data-testid": "markdown" }, content),
}));

vi.mock("./ImageLightbox", () => ({
  ImageLightbox: () => React.createElement("div", { "data-testid": "lightbox" }),
}));

vi.mock("@/lib/photo-vault", () => ({
  getPhotoFromVault: vi.fn(() => Promise.resolve(null)),
}));

Element.prototype.scrollIntoView = vi.fn();

describe("ChatThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no messages", async () => {
    const { ChatThread } = await import("./ChatThread");
    render(
      React.createElement(ChatThread, {
        messages: [],
        streaming: false,
      }),
    );

    expect(screen.getByText("Ask anything about your homework...")).toBeTruthy();
  });

  it("renders user and assistant message bubbles", async () => {
    const { ChatThread } = await import("./ChatThread");
    const messages: ChatMessage[] = [
      {
        id: "m1",
        role: "user",
        content: "How do I solve this equation?",
        createdAt: Date.now(),
      },
      {
        id: "m2",
        role: "assistant",
        content: "Let's break it down step by step.",
        createdAt: Date.now(),
      },
    ];

    render(
      React.createElement(ChatThread, {
        messages,
        streaming: false,
      }),
    );

    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Spark")).toBeTruthy();

    const markdownElements = screen.getAllByTestId("markdown");
    expect(markdownElements.length).toBe(2);
  });

  it("shows loading skeleton when streaming with no content yet", async () => {
    const { ChatThread } = await import("./ChatThread");
    const messages: ChatMessage[] = [
      { id: "m1", role: "user", content: "Hello", createdAt: Date.now() },
      {
        id: "m2",
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      },
    ];

    render(
      React.createElement(ChatThread, {
        messages,
        streaming: true,
      }),
    );

    const sparkLabels = screen.getAllByText("Spark");
    expect(sparkLabels.length).toBeGreaterThan(0);
  });

  it("does not show empty state when messages exist", async () => {
    const { ChatThread } = await import("./ChatThread");
    const messages: ChatMessage[] = [
      {
        id: "m1",
        role: "assistant",
        content: "Let's get started!",
        createdAt: Date.now(),
      },
    ];

    render(
      React.createElement(ChatThread, {
        messages,
        streaming: false,
      }),
    );

    expect(screen.queryByText("Ask anything about your homework...")).toBeNull();
  });
});
