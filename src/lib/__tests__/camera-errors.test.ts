import { describe, it, expect } from "vitest";
import {
  cameraConstraintAttempts,
  cameraErrorMessage,
  defaultFacingMode,
  isMacUserAgent,
} from "../camera-errors";

// ===========================================================================
// Camera error classification — MacBook evidence (2026-08-13):
// Chrome has OS Camera enabled, but enumerateDevices → 0 videoinput and
// getUserMedia({video:true}) → NotFoundError. Message must NOT claim the
// OS is blocking when Chrome is already checked in System Preferences.
// ===========================================================================

describe("cameraErrorMessage", () => {
  it("macOS system block: explicit 'Permission denied by system'", () => {
    const msg = cameraErrorMessage({
      name: "NotAllowedError",
      message: "Permission denied by system",
      sawAnyVideoInput: false,
      isMac: true,
    });
    expect(msg).toMatch(/System Preferences|system privacy/i);
    expect(msg).toContain("quit");
  });

  it("site permission denied (Permissions API)", () => {
    const msg = cameraErrorMessage({
      name: "NotAllowedError",
      message: "Permission denied",
      sawAnyVideoInput: true,
      permissionState: "denied",
      isMac: true,
    });
    expect(msg).toContain("lock icon");
    expect(msg).toContain("Site settings");
  });

  it("Chrome sees no video device even when OS Camera is enabled", () => {
    const msg = cameraErrorMessage({
      name: "NotFoundError",
      message: "Requested device not found",
      sawAnyVideoInput: false,
      permissionState: "prompt",
      isMac: true,
    });
    expect(msg).toContain("Album");
    expect(msg).not.toMatch(/blocking camera access/i);
  });

  it("permission granted + zero devices → Album-first (no more quit Chrome nag)", () => {
    const msg = cameraErrorMessage({
      name: "NotFoundError",
      message: "Requested device not found",
      sawAnyVideoInput: false,
      permissionState: "granted",
      isMac: true,
    });
    expect(msg).toContain("Album");
    expect(msg).toContain("permission is already OK");
    expect(msg).not.toContain("quit Chrome");
  });

  it("non-Mac: zero video devices → restart browser", () => {
    const msg = cameraErrorMessage({
      name: "NotFoundError",
      message: "Requested device not found",
      sawAnyVideoInput: false,
      isMac: false,
    });
    expect(msg).toContain("restart");
    expect(msg).toContain("Album");
  });

  it("site permission blocked (NotAllowedError, no system keyword)", () => {
    const msg = cameraErrorMessage({
      name: "NotAllowedError",
      message: "Permission denied",
      sawAnyVideoInput: true,
    });
    expect(msg).toContain("allow the camera in your browser");
  });

  it("generic permission wording in message", () => {
    const msg = cameraErrorMessage({
      name: "",
      message: "The request is not allowed by the user agent",
      sawAnyVideoInput: true,
    });
    expect(msg).toContain("allow the camera");
  });

  it("genuine no-camera: NotFoundError but video was enumerated", () => {
    const msg = cameraErrorMessage({
      name: "NotFoundError",
      message: "Requested device not found",
      sawAnyVideoInput: true,
    });
    expect(msg).toContain("No camera found");
  });

  it("not found wording in message", () => {
    const msg = cameraErrorMessage({
      name: "",
      message: "no camera device found",
      sawAnyVideoInput: true,
    });
    expect(msg).toContain("No camera found");
  });

  it("generic failure falls back to original message", () => {
    const msg = cameraErrorMessage({
      name: "OverconstrainedError",
      message: "constraint mismatch",
      sawAnyVideoInput: true,
    });
    expect(msg).toBe("constraint mismatch");
  });

  it("empty message becomes generic guidance", () => {
    const msg = cameraErrorMessage({
      name: "",
      message: "",
      sawAnyVideoInput: true,
    });
    expect(msg).toContain("Retry live");
  });
});

describe("defaultFacingMode", () => {
  it("Mac → user (FaceTime)", () => {
    expect(defaultFacingMode({ isMac: true })).toBe("user");
  });

  it("desktop fine pointer → user", () => {
    expect(defaultFacingMode({ coarsePointer: false })).toBe("user");
  });

  it("phone coarse pointer → environment", () => {
    expect(defaultFacingMode({ coarsePointer: true })).toBe("environment");
  });
});

describe("isMacUserAgent", () => {
  it("detects Macintosh", () => {
    expect(
      isMacUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      ),
    ).toBe(true);
  });

  it("rejects iPhone (UA contains 'like Mac OS X')", () => {
    expect(
      isMacUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/151.0",
      ),
    ).toBe(false);
  });

  it("rejects iPad", () => {
    expect(
      isMacUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });

  it("rejects Windows", () => {
    expect(isMacUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      false,
    );
  });
});

describe("cameraConstraintAttempts", () => {
  it("desktop preferUserFirst puts any-video before exact facing", () => {
    const a = cameraConstraintAttempts("user", true);
    expect(a.length).toBeGreaterThanOrEqual(4);
    // Third attempt (index 2) should be any video
    expect(a[2]?.video).toBe(true);
  });

  it("mobile keeps environment-first with any-video last", () => {
    const a = cameraConstraintAttempts("environment", false);
    expect(a).toHaveLength(4);
    expect(a[3]?.video).toBe(true);
  });
});
