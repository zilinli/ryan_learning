import { describe, it, expect } from "vitest";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  clampZoom,
  zoomIn,
  zoomOut,
  formatZoomPercent,
} from "./lightbox-zoom";

describe("clampZoom", () => {
  it("returns values at step boundaries", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(4)).toBe(4);
  });

  it("clamps below ZOOM_MIN", () => {
    expect(clampZoom(0)).toBe(ZOOM_MIN);
    expect(clampZoom(-1)).toBe(ZOOM_MIN);
    expect(clampZoom(0.5)).toBe(ZOOM_MIN);
  });

  it("clamps above ZOOM_MAX", () => {
    expect(clampZoom(5)).toBe(ZOOM_MAX);
    expect(clampZoom(99)).toBe(ZOOM_MAX);
  });

  it("rounds to nearest step quanta", () => {
    const r = clampZoom(1.3);
    expect(r >= 1 && r <= 1.5 && r % ZOOM_STEP === 0).toBe(true);
  });
});

describe("zoomIn", () => {
  it("increases by ZOOM_STEP", () => {
    expect(zoomIn(1)).toBe(1.25);
    expect(zoomIn(1.25)).toBe(1.5);
    expect(zoomIn(2)).toBe(2.25);
  });

  it("clamps at ZOOM_MAX", () => {
    expect(zoomIn(3.9)).toBe(4);
    expect(zoomIn(4)).toBe(4);
  });
});

describe("zoomOut", () => {
  it("decreases by ZOOM_STEP", () => {
    expect(zoomOut(2)).toBe(1.75);
    expect(zoomOut(1.5)).toBe(1.25);
    expect(zoomOut(1.25)).toBe(1);
  });

  it("clamps at ZOOM_MIN", () => {
    expect(zoomOut(1)).toBe(1);
    expect(zoomOut(1.1)).toBe(1);
  });
});

describe("formatZoomPercent", () => {
  it("formats 1 as 100%", () => {
    expect(formatZoomPercent(1)).toBe("100%");
  });

  it("formats 1.25 as 125%", () => {
    expect(formatZoomPercent(1.25)).toBe("125%");
  });

  it("formats 4 as 400%", () => {
    expect(formatZoomPercent(4)).toBe("400%");
  });

  it("formats clamped values", () => {
    expect(formatZoomPercent(0.5)).toBe("100%");
    expect(formatZoomPercent(99)).toBe("400%");
  });

  it("returns integer percentages", () => {
    const result = formatZoomPercent(2.5);
    expect(result).toMatch(/^\d+%$/);
  });
});
