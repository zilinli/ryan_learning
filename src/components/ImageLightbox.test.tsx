/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { ImageLightbox } from "../components/ImageLightbox";

describe("ImageLightbox", () => {
  beforeEach(() => {
    // Mock createPortal to render inline for testing
    vi.mock("react-dom", async () => {
      const actual = await vi.importActual("react-dom");
      return {
        ...actual,
        createPortal: (node: React.ReactNode) => node,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the image with the given src", () => {
    const { container } = render(
      <ImageLightbox src="test-image.png" alt="Test" onClose={() => {}} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("test-image.png");
  });

  it("has top-layer z-index class", () => {
    const { container } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.className).toContain("z-[200]");
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="test.png" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ImageLightbox src="test.png" onClose={onClose} />,
    );
    // Find Close button by aria-label
    const closeBtn = container.querySelector('button[aria-label="Close"]');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows zoom percentage label", () => {
    const { container } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    // The percent is in a span with aria-live="polite"
    const pct = container.querySelector('[aria-live="polite"]');
    expect(pct).not.toBeNull();
    expect(pct!.textContent).toBe("100%");
  });

  it("clicking Zoom in updates the percent label", () => {
    const { container } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const zoomInBtn = container.querySelector('button[aria-label="Zoom in"]');
    expect(zoomInBtn).not.toBeNull();
    fireEvent.click(zoomInBtn!);
    const pct = container.querySelector('[aria-live="polite"]');
    expect(pct!.textContent).toBe("125%");
  });

  it("clicking Zoom out at 100% stays at 100%", () => {
    const { container } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const zoomOutBtn = container.querySelector('button[aria-label="Zoom out"]');
    expect(zoomOutBtn).not.toBeNull();
    fireEvent.click(zoomOutBtn!);
    const pct = container.querySelector('[aria-live="polite"]');
    expect(pct!.textContent).toBe("100%");
  });

  it("zooms in multiple times", () => {
    const { container } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const zoomInBtn = container.querySelector('button[aria-label="Zoom in"]');
    fireEvent.click(zoomInBtn!);
    fireEvent.click(zoomInBtn!);
    const pct = container.querySelector('[aria-live="polite"]');
    expect(pct!.textContent).toBe("150%");
  });

  it("keyboard + zooms in", () => {
    const { container } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    fireEvent.keyDown(document, { key: "+" });
    const pct = container.querySelector('[aria-live="polite"]');
    expect(pct!.textContent).toBe("125%");
  });

  it("keyboard - zooms out", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ImageLightbox src="test.png" onClose={onClose} />,
    );
    // Zoom in first
    const zoomInBtn = container.querySelector('button[aria-label="Zoom in"]');
    fireEvent.click(zoomInBtn!);
    // Then zoom out
    fireEvent.keyDown(document, { key: "-" });
    const pct = container.querySelector('[aria-live="polite"]');
    expect(pct!.textContent).toBe("100%");
  });

  it("keyboard 0 resets zoom", () => {
    const { container } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const zoomInBtn = container.querySelector('button[aria-label="Zoom in"]');
    fireEvent.click(zoomInBtn!);
    fireEvent.click(zoomInBtn!);
    let pct = container.querySelector('[aria-live="polite"]');
    expect(pct!.textContent).toBe("150%");
    fireEvent.keyDown(document, { key: "0" });
    pct = container.querySelector('[aria-live="polite"]');
    expect(pct!.textContent).toBe("100%");
  });
});
