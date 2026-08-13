/**
 * Camera error classification.
 *
 * getUserMedia failure names/messages are inconsistent across browsers and
 * OSes. On a MacBook we also need to distinguish:
 *   - OS-level TCC deny ("Permission denied by system")
 *   - Site-level deny in Chrome (Permissions API → "denied")
 *   - Browser sees zero videoinput devices even when OS Camera is enabled
 *     for Chrome (common after granting TCC without a full Chrome restart,
 *     or when Chrome's site setting for this origin is Block)
 */

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

export type CameraFailure = {
  name: string;
  message: string;
  /** From enumerateDevices: did the browser see any videoinput at all? */
  sawAnyVideoInput: boolean;
  /** From navigator.permissions.query({name:'camera'}), when available. */
  permissionState?: CameraPermissionState;
  /** Coarse platform hint for messaging. */
  isMac?: boolean;
};

/** Prefer the front camera on desktop/Mac (only FaceTime camera). */
export function defaultFacingMode(opts: {
  isMac?: boolean;
  coarsePointer?: boolean;
}): "environment" | "user" {
  if (opts.isMac) return "user";
  if (opts.coarsePointer === false) return "user";
  return "environment";
}

/** Desktop/Mac: try user-facing first, then any video. Mobile: keep environment-first. */
export function cameraConstraintAttempts(
  facingMode: "environment" | "user",
  preferUserFirst: boolean,
): MediaStreamConstraints[] {
  const preferred: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
  const facingIdeal: MediaStreamConstraints = {
    audio: false,
    video: { facingMode: { ideal: facingMode } },
  };
  const facingExact: MediaStreamConstraints = {
    audio: false,
    video: { facingMode },
  };
  const anyVideo: MediaStreamConstraints = { audio: false, video: true };

  if (preferUserFirst) {
    // MacBook / desktop: FaceTime is "user". Put any-video early so a missing
    // facingMode match never blocks the only camera.
    return [
      preferred,
      facingIdeal,
      anyVideo,
      facingExact,
      // Opposite facing as last soft try
      {
        audio: false,
        video: {
          facingMode: {
            ideal: facingMode === "user" ? "environment" : "user",
          },
        },
      },
    ];
  }

  return [preferred, facingIdeal, facingExact, anyVideo];
}

export function cameraErrorMessage(f: CameraFailure): string {
  const { name, message, sawAnyVideoInput, permissionState, isMac } = f;
  const lower = (message || "").toLowerCase();

  // Explicit OS-level deny (Chrome wording on macOS).
  const macSystemBlocked =
    lower.includes("permission denied by system") ||
    lower.includes("denied by the system") ||
    lower.includes("system permission") ||
    lower.includes("blocked by the system");

  if (macSystemBlocked) {
    return isMac
      ? "macOS is blocking this browser’s camera — open System Preferences › Security & Privacy › Camera, enable this browser, fully quit and reopen it, then tap Retry live. Or use Album."
      : "Your computer is blocking camera access for this browser. Enable it in system privacy settings, restart the browser, then tap Retry live. Or use Album.";
  }

  // Site-level deny in Chrome/Firefox (Permissions API).
  if (permissionState === "denied") {
    return "This site’s camera permission is blocked in the browser — click the lock icon in the address bar → Site settings → Camera → Allow, then tap Retry live. Or use Album.";
  }

  // Browser sees no video device at all. On Mac this often means Chrome needs
  // a full restart after TCC was granted, or the site setting is Block, or
  // the FaceTime camera is unavailable — NOT "no camera hardware".
  if (name === "NotFoundError" && !sawAnyVideoInput) {
    // Permission already granted but still no device → hardware / driver gap.
    // Don't ask the user to re-enable System Preferences or quit Chrome again.
    if (permissionState === "granted") {
      return isMac
        ? "No live camera is available to Chrome on this Mac (permission is already OK). Use Album to pick a homework photo — that works without the live camera."
        : "No live camera is available to this browser (permission is already OK). Use Album to pick a photo.";
    }
    if (isMac) {
      return "Chrome can’t see a camera right now. Fully quit Chrome and reopen it, then tap Retry live — or use Album (fastest for homework).";
    }
    return "No camera device is visible to this browser — restart the browser and tap Retry live, or use Album / Phone camera.";
  }

  if (
    name === "NotAllowedError" ||
    lower.includes("permission") ||
    lower.includes("notallowed") ||
    lower.includes("not allowed") ||
    lower.includes("denied")
  ) {
    return "Camera permission blocked — allow the camera in your browser, then tap Retry live.";
  }

  if (
    name === "NotFoundError" ||
    lower.includes("not found") ||
    lower.includes("no camera") ||
    lower.includes("no video input") ||
    lower.includes("requested device")
  ) {
    return "No camera found — use Album or Upload.";
  }

  if (!message || lower.includes("could not open")) {
    return "Could not open the camera — tap Retry live, or use Phone camera / Album.";
  }

  return message;
}

export function isNoLiveCamera(f: Pick<CameraFailure, "name" | "sawAnyVideoInput">): boolean {
  return f.name === "NotFoundError" && !f.sawAnyVideoInput;
}

/** Best-effort Permissions API probe (Safari may reject camera query). */
export async function queryCameraPermission(): Promise<CameraPermissionState> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return "unknown";
    }
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function isMacUserAgent(ua = ""): boolean {
  // iPhone/iPad UA contains "like Mac OS X" — must not count as desktop Mac.
  if (/iPhone|iPad|iPod/i.test(ua)) return false;
  return /Macintosh/i.test(ua);
}
