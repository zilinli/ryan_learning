// @vitest-environment jsdom
/**
 * CameraCapture layout tests — phone / iPad / PC device matrix.
 * Asserts class composition, aspect ratio by pointer type, body portal
 * (escapes Composer backdrop-blur), and Snap always reachable in DOM.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react";
import { CameraCapture } from "../../components/CameraCapture";

// ---------------------------------------------------------------------------
// Device profiles
// ---------------------------------------------------------------------------

type DeviceProfile = {
  name: "phone" | "ipad" | "pc";
  /** CSS px — used for documentation / optional viewport stub */
  width: number;
  height: number;
  /** (pointer: coarse) → portrait 3/4; fine → landscape 4/3 */
  coarsePointer: boolean;
  /** Expected video aspect utility after matchMedia effect */
  expectedAspect: "aspect-[3/4]" | "aspect-[4/3]";
  /**
   * Tailwind sm: (≥640px) applies on iPad + PC.
   * We assert class *composition* (classes present in DOM); CSS media
   * queries themselves are not evaluated in jsdom.
   */
  smBreakpoint: boolean;
};

const DEVICES: DeviceProfile[] = [
  {
    name: "phone",
    width: 390,
    height: 844,
    coarsePointer: true,
    expectedAspect: "aspect-[3/4]",
    smBreakpoint: false,
  },
  {
    name: "ipad",
    width: 820,
    height: 1180,
    // iPad is touch → coarse; still gets sm: centered card via CSS width
    coarsePointer: true,
    expectedAspect: "aspect-[3/4]",
    smBreakpoint: true,
  },
  {
    name: "pc",
    width: 1440,
    height: 900,
    coarsePointer: false,
    expectedAspect: "aspect-[4/3]",
    smBreakpoint: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let matchMediaImpl: (query: string) => MediaQueryList;

function stubMatchMedia(coarse: boolean) {
  matchMediaImpl = (query: string) => {
    const isCoarseQuery = query.includes("pointer: coarse") || query.includes("pointer:coarse");
    const matches = isCoarseQuery ? coarse : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
  };
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn((q: string) => matchMediaImpl(q)),
    writable: true,
    configurable: true,
  });
}

function stubViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
}

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

function backdrop() {
  return document.querySelector('[data-camera-portal="true"]');
}

function card() {
  return document.querySelector(".max-h-\\[90dvh\\]");
}

function videoBox() {
  return document.querySelector(".bg-black");
}

async function waitAspect(expected: string) {
  await waitFor(() => {
    const el = videoBox();
    expect(el).not.toBeNull();
    expect(el!.className).toContain(expected);
  });
}

// ---------------------------------------------------------------------------
// Mocks (no real getUserMedia)
// ---------------------------------------------------------------------------

beforeAll(() => {
  stubMatchMedia(true);

  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn(() =>
        Promise.reject(new DOMException("NotAllowed", "NotAllowedError")),
      ),
      enumerateDevices: vi.fn(() => Promise.resolve([])),
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(HTMLVideoElement.prototype, "play", {
    value: vi.fn(() => Promise.reject(new DOMException("mock", "AbortError"))),
    writable: true,
    configurable: true,
  });
});

beforeEach(() => {
  // Default to phone until a device block overrides
  stubMatchMedia(true);
  stubViewport(390, 844);
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

// ===========================================================================
// Shared: portal + Snap reachable (regression for PC bottom-clip bug)
// ===========================================================================

describe("CameraCapture — shared invariants (all devices)", () => {
  it("portals overlay to document.body (escapes Composer blur/overflow)", () => {
    renderOpen();
    const portal = backdrop();
    expect(portal).not.toBeNull();
    expect(portal!.parentElement).toBe(document.body);
  });

  it("still portals when nested under backdrop-blur + overflow-hidden (Composer mimic)", () => {
    render(
      <div className="relative overflow-hidden backdrop-blur-md" style={{ height: 120 }}>
        <CameraCapture open onClose={vi.fn()} onCapture={vi.fn()} />
      </div>,
    );
    const portal = backdrop();
    expect(portal).not.toBeNull();
    expect(portal!.parentElement).toBe(document.body);
    // Must NOT remain trapped inside the blur parent
    expect(portal!.closest(".backdrop-blur-md")).toBeNull();
  });

  it("locks body scroll while open and restores on close", () => {
    const { rerender } = render(
      <CameraCapture open onClose={vi.fn()} onCapture={vi.fn()} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<CameraCapture open={false} onClose={vi.fn()} onCapture={vi.fn()} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("always renders Snap / Flip / Phone / Album / Done", () => {
    renderOpen();
    for (const label of ["Snap", "Flip", "Phone", "Album", "Done"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("keeps action bar shrink-0 so Snap is not flex-shrunk away", () => {
    renderOpen();
    const snap = screen.getByText("Snap");
    const bar = snap.closest(".flex.shrink-0");
    expect(bar).not.toBeNull();
    expect(bar!.className).toContain("shrink-0");
  });

  it("video preview is shrinkable (min-h-0 flex-1) so Snap stays in card", () => {
    renderOpen();
    const box = videoBox();
    expect(box!.className).toContain("min-h-0");
    expect(box!.className).toContain("flex-1");
  });
});

// ===========================================================================
// Device matrix: phone / iPad / PC
// ===========================================================================

describe.each(DEVICES)(
  "CameraCapture — $name (${width}×${height})",
  (device) => {
    beforeEach(() => {
      stubMatchMedia(device.coarsePointer);
      stubViewport(device.width, device.height);
    });

    it("applies correct video aspect for pointer type", async () => {
      await act(async () => {
        renderOpen();
      });
      await waitAspect(device.expectedAspect);
    });

    it("base layout is phone bottom-sheet (items-end + p-0 + rounded-t)", () => {
      renderOpen();
      const bd = backdrop();
      expect(bd!.className).toContain("items-end");
      expect(bd!.className).toContain("p-0");
      expect(card()!.className).toContain("rounded-t-2xl");
    });

    it("includes sm: centering classes for iPad/PC CSS (≥640px)", () => {
      renderOpen();
      const bd = backdrop();
      // Classes are always in the DOM; sm: CSS activates by viewport width
      expect(bd!.className).toContain("sm:items-center");
      expect(bd!.className).toContain("sm:p-4");
      expect(card()!.className).toContain("sm:rounded-2xl");
      if (device.smBreakpoint) {
        // Document intent: these devices rely on sm: centering so Snap is on-screen
        expect(device.width).toBeGreaterThanOrEqual(640);
      } else {
        expect(device.width).toBeLessThan(640);
      }
    });

    it("card max-height uses dvh so mobile browser chrome is respected", () => {
      renderOpen();
      expect(card()!.className).toContain("max-h-[90dvh]");
      expect(card()!.className).toContain("max-w-lg");
    });

    it("Snap button is in the portaled overlay (reachable)", () => {
      renderOpen();
      const snap = screen.getByText("Snap");
      expect(snap.closest('[data-camera-portal="true"]')).not.toBeNull();
      expect(document.body.contains(snap)).toBe(true);
    });

    it("video has playsInline + muted + autoPlay (iOS/iPad safe)", () => {
      renderOpen();
      const video = document.querySelector("video");
      expect(video).not.toBeNull();
      expect(video!.hasAttribute("playsinline")).toBe(true);
      expect(video!.muted).toBe(true);
      expect(video!.hasAttribute("autoplay")).toBe(true);
    });
  },
);

// ===========================================================================
// Phone-specific: bottom sheet must not regress
// ===========================================================================

describe("CameraCapture — phone specifics", () => {
  beforeEach(() => {
    stubMatchMedia(true);
    stubViewport(390, 844);
  });

  it("uses portrait aspect-[3/4] for coarse pointer", async () => {
    await act(async () => {
      renderOpen();
    });
    await waitAspect("aspect-[3/4]");
  });

  it("does not use PC landscape aspect by default on phone", async () => {
    await act(async () => {
      renderOpen();
    });
    await waitFor(() => {
      expect(videoBox()!.className).not.toContain("aspect-[4/3]");
    });
  });
});

// ===========================================================================
// iPad-specific: touch + tablet width
// ===========================================================================

describe("CameraCapture — iPad specifics", () => {
  beforeEach(() => {
    stubMatchMedia(true);
    stubViewport(820, 1180);
  });

  it("keeps portrait-ish aspect on coarse pointer (touch iPad)", async () => {
    await act(async () => {
      renderOpen();
    });
    await waitAspect("aspect-[3/4]");
  });

  it("carries sm:items-center so sheet is vertically centered on tablet CSS", () => {
    renderOpen();
    expect(backdrop()!.className).toContain("sm:items-center");
    // Caps height on larger tablets
    expect(card()!.className).toMatch(/sm:max-h-\[min\(90dvh,52rem\)\]/);
  });

  it("landscape iPad viewport still portals + shows Snap", () => {
    stubViewport(1180, 820);
    renderOpen();
    expect(backdrop()!.parentElement).toBe(document.body);
    expect(screen.getByText("Snap")).toBeTruthy();
  });
});

// ===========================================================================
// PC-specific: fine pointer + centered modal (the reported bug)
// ===========================================================================

describe("CameraCapture — PC specifics", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    stubViewport(1440, 900);
  });

  it("uses landscape aspect-[4/3] for fine pointer (mouse)", async () => {
    await act(async () => {
      renderOpen();
    });
    await waitAspect("aspect-[4/3]");
  });

  it("centers modal on sm+ (not bottom-aligned only) so Snap is not below fold", () => {
    renderOpen();
    const c = backdrop()!.className;
    expect(c).toContain("sm:items-center");
    // Must NOT use the old broken top-only alignment without height budget
    expect(c).not.toContain("sm:items-start");
  });

  it("video max-height caps prevent Snap from being pushed off-screen", () => {
    renderOpen();
    const box = videoBox()!.className;
    expect(box).toMatch(/max-h-\[min\(58dvh,28rem\)\]/);
    expect(box).toMatch(/sm:max-h-\[min\(62dvh,32rem\)\]/);
  });

  it("short PC window still keeps Snap in portal", () => {
    stubViewport(1280, 720);
    renderOpen();
    const snap = screen.getByText("Snap");
    expect(snap.closest('[data-camera-portal="true"]')).not.toBeNull();
    expect(videoBox()!.className).toContain("flex-1");
    expect(videoBox()!.className).toContain("min-h-0");
  });
});

// ===========================================================================
// Header / card chrome
// ===========================================================================

describe("CameraCapture header & card", () => {
  it("displays Camera title and Done", () => {
    renderOpen();
    expect(screen.getByText("Camera")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("shows capture count when > 0", () => {
    renderOpen({ capturedCount: 3 });
    expect(screen.getByText(/3 added/)).toBeTruthy();
  });

  it("shows no count when 0", () => {
    renderOpen({ capturedCount: 0 });
    expect(screen.queryByText(/added/)).toBeNull();
  });
});

// ===========================================================================
// Error + hidden inputs + closed
// ===========================================================================

describe("CameraCapture error / inputs / closed", () => {
  it("shows an error when camera cannot be opened", async () => {
    renderOpen();
    await waitFor(
      () => {
        const errorDiv = document.querySelector(".text-\\[\\#ffb4a8\\]");
        expect(errorDiv).not.toBeNull();
        const text = (errorDiv?.textContent ?? "").toLowerCase();
        expect(
          text.includes("could not open") ||
            text.includes("permission") ||
            text.includes("not found") ||
            text.includes("not ready"),
        ).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it("has phone capture input and album input without capture", () => {
    renderOpen();
    const inputs = document.querySelectorAll('input[type="file"]');
    const phoneInput = Array.from(inputs).find(
      (el) => el.getAttribute("capture") === "environment",
    );
    const albumInput = Array.from(inputs).find(
      (el) => el.getAttribute("capture") === null && el.hasAttribute("multiple"),
    );
    expect(phoneInput).not.toBeNull();
    expect(albumInput).not.toBeNull();
  });

  it("renders nothing when open=false", () => {
    render(<CameraCapture open={false} onClose={vi.fn()} onCapture={vi.fn()} />);
    expect(document.querySelector('[data-camera-portal="true"]')).toBeNull();
    expect(screen.queryByText("Camera")).toBeNull();
  });
});

// ===========================================================================
// macOS system-block recovery — reproduction evidence:
// Chrome on MacBook: enumerateDevices() → 0 videoinput, getUserMedia →
// NotFoundError. The app must (a) show System Settings guidance and
// (b) let "Retry live" actually re-invoke getUserMedia after the user
// enables the camera in macOS.
// ===========================================================================

describe("CameraCapture — macOS system-block recovery", () => {
  const defaultGum = vi.fn(() =>
    Promise.reject(new DOMException("NotAllowed", "NotAllowedError")),
  );
  const macGum = vi.fn<
    (constraints: MediaStreamConstraints) => Promise<MediaStream>
  >(() =>
    Promise.reject(
      new DOMException("Requested device not found", "NotFoundError"),
    ),
  );

  beforeEach(() => {
    macGum.mockReset();
    macGum.mockRejectedValue(
      new DOMException("Requested device not found", "NotFoundError"),
    );
    try {
      window.sessionStorage?.removeItem("spark.camera.noLive");
    } catch {
      /* ignore */
    }
    // Simulate MacBook Chrome UA so messaging / facing defaults kick in.
    Object.defineProperty(globalThis.navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      configurable: true,
    });
    // Matches post-restart evidence: site permission granted, but 0 devices.
    Object.defineProperty(globalThis.navigator, "permissions", {
      value: {
        query: vi.fn(async () => ({ state: "granted" })),
      },
      configurable: true,
    });
    // macOS block signature: enumerateDevices sees no videoinput.
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: {
        getUserMedia: macGum,
        enumerateDevices: vi.fn(() => Promise.resolve([])),
      },
      writable: true,
      configurable: true,
    });
    // Skip the metadata-wait timeout in the success path.
    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
      configurable: true,
      get: () => 2,
    });
  });

  afterEach(() => {
    try {
      window.sessionStorage?.removeItem("spark.camera.noLive");
    } catch {
      /* ignore */
    }
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: {
        getUserMedia: defaultGum,
        enumerateDevices: vi.fn(() => Promise.resolve([])),
      },
      writable: true,
      configurable: true,
    });
  });

  it("shows Chrome restart / Album guidance instead of 'No camera found'", async () => {
    renderOpen();
    await waitFor(
      () => {
        const err = document.querySelector(
          ".text-\\[\\#ffb4a8\\], .text-white\\/90",
        );
        expect(err).not.toBeNull();
        const text = err?.textContent || "";
        expect(/quit Chrome|Album|permission is already OK/i.test(text)).toBe(
          true,
        );
      },
      { timeout: 5000 },
    );
    // Must NOT mislead a MacBook owner into thinking there is no camera hardware.
    expect(screen.queryByText(/^No camera found/)).toBeNull();
    // Album-first CTA appears when live camera is unavailable.
    expect(
      screen.getByRole("button", { name: "Choose from Album" }),
    ).toBeTruthy();
  });

  it("Retry live re-invokes getUserMedia after the OS block is fixed", async () => {
    renderOpen();

    // First attempt: all constraint tries fail with NotFoundError.
    await waitFor(
      () => {
        const err = document.querySelector(
          ".text-\\[\\#ffb4a8\\], .text-white\\/90",
        );
        expect(err).not.toBeNull();
        expect(
          /quit Chrome|Album|permission is already OK/i.test(
            err?.textContent || "",
          ),
        ).toBe(true);
      },
      { timeout: 5000 },
    );
    const callsAfterFailure = macGum.mock.calls.length;
    expect(callsAfterFailure).toBeGreaterThanOrEqual(4);

    // User enables camera in macOS System Settings → next request succeeds.
    const track = { stop: vi.fn() };
    macGum.mockResolvedValue({
      getVideoTracks: () => [track],
      getTracks: () => [track],
      getAudioTracks: () => [],
    } as unknown as MediaStream);

    fireEvent.click(screen.getByRole("button", { name: "Retry live" }));

    // Retry must actually call getUserMedia again (Bug A regression).
    await waitFor(
      () => {
        expect(macGum.mock.calls.length).toBeGreaterThan(callsAfterFailure);
      },
      { timeout: 5000 },
    );

    // Stream goes live → Snap becomes enabled.
    await waitFor(
      () => {
        const snap = screen.getByText("Snap") as HTMLButtonElement;
        expect(snap.disabled).toBe(false);
      },
      { timeout: 5000 },
    );
  });
});
