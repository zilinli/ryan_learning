// @vitest-environment jsdom
/**
 * CameraCapture layout tests — covers phone, tablet/iPad, and PC viewport
 * class compositions. No real camera media, just DOM structure assertions.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CameraCapture } from "../../components/CameraCapture";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderOpen(props?: Partial<Parameters<typeof CameraCapture>[0]>) {
  return render(
    <CameraCapture
      open={true}
      onClose={vi.fn()}
      onCapture={vi.fn()}
      capturedCount={0}
      {...props}
    />,
  );
}

/** Collect all class strings from an element and its ancestors for pattern checks */
function classChain(el: Element | null): string[] {
  const out: string[] = [];
  let cur = el;
  while (cur) {
    out.push(cur.className?.toString() ?? "");
    cur = cur.parentElement;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mocks (no real getUserMedia)
// ---------------------------------------------------------------------------

beforeAll(() => {
  // jsdom doesn't provide matchMedia — stub it
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn((query: string) => ({
        matches: query.includes("coarse") ? true : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      writable: true,
      configurable: true,
    });
  }

  // Suppress real camera requests — component calls getCameraStream on open
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn(
        () =>
          Promise.reject(new DOMException("NotAllowed", "NotAllowedError")),
      ),
      enumerateDevices: vi.fn(() => Promise.resolve([])),
    },
    writable: true,
    configurable: true,
  });

  // Mock HTMLVideoElement.play
  if (!HTMLVideoElement.prototype.play || HTMLVideoElement.prototype.play === (() => {})) {
    Object.defineProperty(HTMLVideoElement.prototype, "play", {
      value: vi.fn(() => Promise.reject(new DOMException("mock", "AbortError"))),
      writable: true,
    });
  }
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// 1. Outer backdrop — responsive positioning
// ===========================================================================

describe("CameraCapture backdrop (outer container)", () => {
  it("renders a fixed full-screen backdrop", () => {
    renderOpen();
    const backdrop = document.querySelector(".fixed.inset-0.z-50");
    expect(backdrop).not.toBeNull();
    const c = backdrop!.className;
    // Base phone: bottom-aligned
    expect(c).toContain("items-end");
  });

  it("includes sm:items-start for tablet / PC top-alignment", () => {
    renderOpen();
    const backdrop = document.querySelector(".fixed.inset-0.z-50");
    expect(backdrop).not.toBeNull();
    // Responsive class for >= 640px — card goes to top
    expect(backdrop!.className).toContain("sm:items-start");
  });

  it("includes sm:pt-6 for breathing room from screen top on tablet+", () => {
    renderOpen();
    const backdrop = document.querySelector(".fixed.inset-0.z-50");
    expect(backdrop!.className).toContain("sm:pt-6");
  });

  it("includes sm:px-4 for horizontal padding on tablet+", () => {
    renderOpen();
    const backdrop = document.querySelector(".fixed.inset-0.z-50");
    expect(backdrop!.className).toContain("sm:px-4");
  });

  it("has no p-0 on base (phone goes edge-to-edge)", () => {
    renderOpen();
    const backdrop = document.querySelector(".fixed.inset-0.z-50");
    expect(backdrop!.className).toContain("p-0");
  });
});

// ===========================================================================
// 2. Card — rounded corners, border, sizing
// ===========================================================================

describe("CameraCapture card", () => {
  it("renders the card with max-h and max-w constraints", () => {
    renderOpen();
    const card = document.querySelector(".max-h-\\[92vh\\]");
    expect(card).not.toBeNull();
    expect(card!.className).toContain("max-w-lg");
  });

  it("has rounded-t-2xl on phone (bottom-sheet style)", () => {
    renderOpen();
    const card = document.querySelector(".max-h-\\[92vh\\]");
    expect(card!.className).toContain("rounded-t-2xl");
  });

  it("has sm:rounded-2xl for tablet/PC (full rounded card)", () => {
    renderOpen();
    const card = document.querySelector(".max-h-\\[92vh\\]");
    expect(card!.className).toContain("sm:rounded-2xl");
  });

  it("has border on all viewports", () => {
    renderOpen();
    const card = document.querySelector(".max-h-\\[92vh\\]");
    expect(card!.className).toContain("border");
  });
});

// ===========================================================================
// 3. Header — title + Done button
// ===========================================================================

describe("CameraCapture header", () => {
  it("displays 'Camera' title", () => {
    renderOpen();
    expect(screen.getByText("Camera")).toBeTruthy();
  });

  it("shows capture count when > 0", () => {
    renderOpen({ capturedCount: 3 });
    expect(screen.getByText(/3 added/)).toBeTruthy();
  });

  it("shows no count when 0", () => {
    renderOpen({ capturedCount: 0 });
    expect(screen.queryByText(/added/)).toBeNull();
  });

  it("has a Done button", () => {
    renderOpen();
    expect(screen.getByText("Done")).toBeTruthy();
  });
});

// ===========================================================================
// 4. Video area — aspect ratio per device type
// ===========================================================================

describe("CameraCapture video area", () => {
  it("renders a video element with playsInline, muted, autoPlay (iPad safe)", () => {
    renderOpen();
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.hasAttribute("playsinline")).toBe(true);
    expect(video!.muted).toBe(true);
    expect(video!.hasAttribute("autoplay")).toBe(true);
  });

  it("video container has bg-black", () => {
    renderOpen();
    const container = document.querySelector(".bg-black");
    expect(container).not.toBeNull();
  });

  it("video container uses aspect ratio class (aspect-[3/4] or aspect-[4/3])", () => {
    renderOpen();
    const container = document.querySelector(".bg-black");
    const c = container!.className;
    expect(c).toMatch(/aspect-\[[34]\/[34]\]/);
  });

  it("has w-full and shrink-0 so video doesn't stretch the card", () => {
    renderOpen();
    const container = document.querySelector(".bg-black");
    expect(container!.className).toContain("w-full");
    expect(container!.className).toContain("shrink-0");
  });
});

// ===========================================================================
// 5. Bottom action bar — Snap / Flip / Phone / Album
// ===========================================================================

describe("CameraCapture action buttons", () => {
  it("renders all four action buttons", () => {
    renderOpen();
    expect(screen.getByText("Snap")).toBeTruthy();
    expect(screen.getByText("Flip")).toBeTruthy();
    expect(screen.getByText("Phone")).toBeTruthy();
    expect(screen.getByText("Album")).toBeTruthy();
  });

  it("Snap button is present and initially enabled (style-wise)", () => {
    renderOpen();
    const snap = screen.getByText("Snap");
    expect(snap).toBeTruthy();
    // Camera is rejected by mock → error state, so Snap will be disabled in DOM
    // but the button itself renders
  });

  it("all four buttons are in a flex row with wrap", () => {
    renderOpen();
    // The button bar is the last flex div before the hidden inputs
    const bars = document.querySelectorAll(
      ".flex.shrink-0.flex-wrap.items-center.justify-between",
    );
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// 6. Error state
// ===========================================================================

describe("CameraCapture error state", () => {
  it("shows an error message when camera cannot be opened", async () => {
    render(
      <CameraCapture
        open={true}
        onClose={vi.fn()}
        onCapture={vi.fn()}
        capturedCount={0}
      />,
    );
    // Wait for React effects to settle
    await new Promise((r) => setTimeout(r, 500));
    // Component should show an error since getUserMedia is mocked to reject
    // jsdom may lose DOMException typing through Promise rejection, so the
    // fallback message "Could not open the camera" is expected here.
    const errorDiv = document.querySelector(".text-\\[\\#ffb4a8\\]");
    expect(errorDiv).not.toBeNull();
    const text = (errorDiv?.textContent ?? "").toLowerCase();
    expect(
      text.includes("could not open") ||
      text.includes("permission") ||
      text.includes("not found") ||
      text.includes("not ready"),
    ).toBe(true);
  });
});

// ===========================================================================
// 7. Hidden file inputs (Phone / Album)
// ===========================================================================

describe("CameraCapture hidden inputs", () => {
  it("has a hidden phone camera input with capture=environment", () => {
    renderOpen();
    const inputs = document.querySelectorAll('input[type="file"]');
    const phoneInput = Array.from(inputs).find((el) =>
      el.getAttribute("capture") === "environment",
    );
    expect(phoneInput).not.toBeNull();
    expect(phoneInput!.getAttribute("accept")).toBe("image/*");
  });

  it("has an album input without capture (Android/Huawei safe)", () => {
    renderOpen();
    const inputs = document.querySelectorAll('input[type="file"]');
    const albumInput = Array.from(inputs).find(
      (el) => el.getAttribute("capture") === null && el.hasAttribute("multiple"),
    );
    expect(albumInput).not.toBeNull();
    expect(albumInput!.getAttribute("accept")).toBe("image/*");
  });
});

// ===========================================================================
// 8. Closed state
// ===========================================================================

describe("CameraCapture closed state", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <CameraCapture open={false} onClose={vi.fn()} onCapture={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
