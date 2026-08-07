import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { ImageLightbox } from "../components/ImageLightbox";

describe("ImageLightbox", () => {
  beforeEach(() => {
    // Mock createPortal to render inline for testing
    vi.mock("react-dom", async () => {
      const actual = await vi.importActual("react-dom");
      return {
        ...actual,
        createPortal: (node: React.ReactNode, _container: Element) => node,
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
    const { getByLabelText } = render(
      <ImageLightbox src="test.png" onClose={onClose} />,
    );
    fireEvent.click(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows zoom percentage label", () => {
    const { getByText } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    expect(getByText("100%")).not.toBeNull();
  });

  it("clicking Zoom in updates the percent label", () => {
    const { getByLabelText, getByText } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const zoomInBtn = getByLabelText("Zoom in");
    fireEvent.click(zoomInBtn);
    // Should no longer be "100%"
    expect(getByText("125%")).not.toBeNull();
  });

  it("clicking Zoom out at 100% stays at 100%", () => {
    const { getByLabelText, getByText } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const zoomOutBtn = getByLabelText("Zoom out");
    fireEvent.click(zoomOutBtn);
    expect(getByText("100%")).not.toBeNull();
  });

  it("zooms in multiple times", () => {
    const { getByLabelText, getByText } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    const zoomInBtn = getByLabelText("Zoom in");
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomInBtn);
    expect(getByText("150%")).not.toBeNull();
  });

  it("keyboard + zooms in", () => {
    const { getByText } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    fireEvent.keyDown(document, { key: "+" });
    expect(getByText("125%")).not.toBeNull();
  });

  it("keyboard - zooms out", () => {
    const onClose = vi.fn();
    const { getByText, getByLabelText } = render(
      <ImageLightbox src="test.png" onClose={onClose} />,
    );
    // Zoom in first
    const zoomInBtn = getByLabelText("Zoom in");
    fireEvent.click(zoomInBtn);
    expect(getByText("125%")).not.toBeNull();
    // Then zoom out
    fireEvent.keyDown(document, { key: "-" });
    expect(getByText("100%")).not.toBeNull();
  });

  it("keyboard 0 resets zoom", () => {
    const { getByText, getByLabelText } = render(
      <ImageLightbox src="test.png" onClose={() => {}} />,
    );
    fireEvent.click(getByLabelText("Zoom in"));
    fireEvent.click(getByLabelText("Zoom in"));
    expect(getByText("150%")).not.toBeNull();
    fireEvent.keyDown(document, { key: "0" });
    expect(getByText("100%")).not.toBeNull();
  });
});
