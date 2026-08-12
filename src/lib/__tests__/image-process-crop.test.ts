import { describe, expect, it } from "vitest";
import {
  clientToCropNorm,
  isNearFullFrameCrop,
  rectFromDrag,
} from "../image-process";

describe("clientToCropNorm", () => {
  const box = { left: 100, top: 50, width: 200, height: 100 };

  it("maps corners to 0 and 1", () => {
    expect(clientToCropNorm(box, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(clientToCropNorm(box, 300, 150)).toEqual({ x: 1, y: 1 });
  });

  it("maps center", () => {
    expect(clientToCropNorm(box, 200, 100)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("clamps outside the image", () => {
    expect(clientToCropNorm(box, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(clientToCropNorm(box, 999, 999)).toEqual({ x: 1, y: 1 });
  });

  it("returns origin for zero-size bounds (layout not ready)", () => {
    expect(
      clientToCropNorm({ left: 0, top: 0, width: 0, height: 0 }, 10, 10),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("rectFromDrag", () => {
  it("builds rect from diagonal drag", () => {
    const r = rectFromDrag(0.2, 0.3, 0.6, 0.7);
    expect(r.x).toBeCloseTo(0.2);
    expect(r.y).toBeCloseTo(0.3);
    expect(r.w).toBeCloseTo(0.4);
    expect(r.h).toBeCloseTo(0.4);
  });

  it("normalizes reverse drag", () => {
    const r = rectFromDrag(0.8, 0.9, 0.2, 0.4);
    expect(r.x).toBeCloseTo(0.2);
    expect(r.y).toBeCloseTo(0.4);
    expect(r.w).toBeCloseTo(0.6);
    expect(r.h).toBeCloseTo(0.5);
  });

  it("enforces minimum size", () => {
    const r = rectFromDrag(0.5, 0.5, 0.51, 0.51);
    expect(r.w).toBeGreaterThanOrEqual(0.04);
    expect(r.h).toBeGreaterThanOrEqual(0.04);
  });

  it("keeps rect inside the frame", () => {
    const r = rectFromDrag(0.98, 0.98, 1.2, 1.2);
    expect(r.x + r.w).toBeLessThanOrEqual(1.0001);
    expect(r.y + r.h).toBeLessThanOrEqual(1.0001);
  });
});

describe("isNearFullFrameCrop", () => {
  it("treats default modal selection as near-full", () => {
    expect(isNearFullFrameCrop({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 })).toBe(
      false,
    );
  });

  it("treats near-full page as skip-crop", () => {
    expect(isNearFullFrameCrop({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isNearFullFrameCrop({ x: 0.01, y: 0.01, w: 0.98, h: 0.98 })).toBe(
      true,
    );
  });

  it("treats tiny rect as skip-crop", () => {
    expect(isNearFullFrameCrop({ x: 0.4, y: 0.4, w: 0.03, h: 0.2 })).toBe(
      true,
    );
  });

  it("keeps a real question crop", () => {
    expect(isNearFullFrameCrop({ x: 0.1, y: 0.2, w: 0.7, h: 0.35 })).toBe(
      false,
    );
  });
});
