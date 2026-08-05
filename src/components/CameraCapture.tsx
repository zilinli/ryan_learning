"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { compressImageDataUrl } from "@/lib/image-process";
import { ensureMediaDevices, isSecureMediaContext } from "@/lib/media";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called for each snap; parent should append. Modal stays open for multi-page homework. */
  onCapture: (payload: {
    dataUrl: string;
    mimeType: string;
    data: string;
  }) => void;
  capturedCount?: number;
};

async function getCameraStream(
  facingMode: "environment" | "user",
): Promise<MediaStream> {
  const devices = ensureMediaDevices();
  if (!devices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser");
  }
  if (!isSecureMediaContext()) {
    throw new Error("Camera needs HTTPS — open https://…");
  }

  // Enumerate first to detect if a video input exists (avoids confusing NotFoundError)
  try {
    const devicesList = await devices.enumerateDevices();
    const hasVideo = devicesList.some((d) => d.kind === "videoinput");
    if (!hasVideo) {
      throw new DOMException("No video input device found", "NotFoundError");
    }
  } catch {
    // enumerateDevices may fail on some browsers; proceed to getUserMedia
  }

  const attempts: MediaStreamConstraints[] = [
    // Preferred: 720p back camera
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    // Fallback 1: any resolution, specific facing
    { audio: false, video: { facingMode: { ideal: facingMode } } },
    // Fallback 2: exact facing string (older API)
    { audio: false, video: { facingMode } },
    // Fallback 3: any video source
    { audio: false, video: true },
  ];

  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      return await devices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Could not open the camera");
}

export function CameraCapture({
  open,
  onClose,
  onCapture,
  capturedCount = 0,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const phoneCameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  /** After Phone/Album, live preview is off until user taps Live again */
  const [livePaused, setLivePaused] = useState(false);
  const [aspectClass, setAspectClass] = useState("aspect-[3/4]");

  // Detect coarse-pointer → portrait phone; fine → landscape desktop/tablet
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAspectClass(
        window.matchMedia("(pointer: coarse)").matches
          ? "aspect-[3/4]"
          : "aspect-[4/3]",
      );
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setReady(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    setError("");
    setReady(false);
    try {
      const stream = await getCameraStream(facingMode);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      // Wait for loadedmetadata OR canplay (iPad sometimes skips metadata)
      await new Promise<void>((resolve) => {
        const done = () => {
          video.removeEventListener("loadedmetadata", done);
          video.removeEventListener("canplay", done);
          resolve();
        };
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        video.addEventListener("loadedmetadata", done, { once: true });
        video.addEventListener("canplay", done, { once: true });
        window.setTimeout(resolve, 3000);
      });

      // play() returns a promise; catch autoplay blocks silently
      try {
        await video.play();
      } catch {
        // iPad Safari may block play even for muted+playsinline.
        // Try one more time after a microtask — sometimes the
        // browser needs a tick after setting srcObject.
        await new Promise((r) => window.setTimeout(r, 100));
        try {
          await video.play();
        } catch {
          // frames may still arrive; don't block readiness
        }
      }

      // Readiness: check videoWidth after play attempt, then fallback to track count
      const hasVideo = Boolean(
        video.videoWidth || stream.getVideoTracks().length,
      );
      setReady(hasVideo);
      if (!hasVideo) {
        setError("Camera not ready — tap Retry live or use Phone camera.");
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const msg =
        err instanceof Error ? err.message : "Could not open the camera";
      if (
        name === "NotAllowedError" ||
        msg.toLowerCase().includes("permission") ||
        msg.includes("NotAllowed")
      ) {
        setError(
          "Camera permission blocked — use Phone camera or Album below.",
        );
      } else if (name === "NotFoundError") {
        setError("No camera found — use Album or Upload.");
      } else {
        setError(msg);
      }
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!open) {
      stopStream();
      setLivePaused(false);
      setError("");
      return;
    }
    if (livePaused) {
      return;
    }
    void startStream();
    return () => stopStream();
  }, [open, facingMode, livePaused, startStream, stopStream]);

  const resumeLive = () => {
    setError("");
    setLivePaused(false);
  };

  const emitImage = async (dataUrl: string, mimeType: string) => {
    setBusy(true);
    try {
      const compressed = await compressImageDataUrl(dataUrl, mimeType);
      onCapture(compressed);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
    } finally {
      setBusy(false);
    }
  };

  const snap = async () => {
    const video = videoRef.current;
    if (!video || !ready || busy) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setError("Camera not ready — wait a moment, or use Phone camera.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    await emitImage(dataUrl, "image/jpeg");
  };

  const onPickedFile = async (file: File | undefined) => {
    if (!file || busy) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the photo"));
        reader.readAsDataURL(file);
      });
      await emitImage(dataUrl, file.type || "image/jpeg");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read photo");
    }
  };

  /** Android/Huawei: release getUserMedia before opening system camera/gallery */
  const releaseThenPick = (which: "phone" | "album") => {
    stopStream();
    setLivePaused(true);
    setReady(false);
    window.setTimeout(() => {
      if (which === "phone") phoneCameraRef.current?.click();
      else albumRef.current?.click();
    }, 80);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Portal to document.body so `position:fixed` is not trapped by Composer’s
  // backdrop-blur / overflow-hidden ancestors (on PC that clipped Snap below the fold).
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,28,34,0.72)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
      data-camera-portal="true"
    >
      {/*
        Phone: bottom sheet (items-end + rounded-t).
        sm+ (iPad / PC): vertically centered card so Snap stays in viewport.
        Video uses min-h-0 flex-1 + max-h so preview shrinks before clipping actions.
      */}
      <div className="safe-bottom flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/20 bg-[var(--ink)] shadow-2xl sm:max-h-[min(90dvh,52rem)] sm:rounded-2xl">
        <div className="safe-top flex shrink-0 items-center justify-between px-4 py-3 text-white">
          <div>
            <p className="text-sm font-medium">Camera</p>
            <p className="text-xs text-white/60">
              Snap each page — then tap Done
              {capturedCount > 0 ? ` · ${capturedCount} added` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            Done
          </button>
        </div>

        <div
          className={`relative w-full min-h-0 flex-1 overflow-hidden bg-black ${aspectClass} max-h-[min(58dvh,28rem)] sm:max-h-[min(62dvh,32rem)]`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover ${
              facingMode === "user" ? "scale-x-[-1]" : ""
            }`}
          />
          {flash ? (
            <div className="pointer-events-none absolute inset-0 bg-white/70" />
          ) : null}
          {livePaused && !error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/80">
              <p>Photo added. Snap more with Phone/Album, or resume live view.</p>
              <button
                type="button"
                onClick={resumeLive}
                className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)]"
              >
                Live camera
              </button>
            </div>
          ) : null}
          {!ready && !error && !livePaused ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              Starting camera…
            </div>
          ) : null}
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[#ffb4a8]">
              <p>{error}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => releaseThenPick("phone")}
                  className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                >
                  Phone camera
                </button>
                <button
                  type="button"
                  onClick={() => releaseThenPick("album")}
                  className="min-h-11 rounded-full border border-white/40 px-4 py-2 text-sm text-white"
                >
                  Album
                </button>
                <button
                  type="button"
                  onClick={resumeLive}
                  className="min-h-11 rounded-full border border-white/40 px-4 py-2 text-sm text-white"
                >
                  Retry live
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-4">
          <button
            type="button"
            onClick={() =>
              setFacingMode((m) => (m === "environment" ? "user" : "environment"))
            }
            className="min-h-11 rounded-full border border-white/25 px-3 py-2 text-sm text-white/90"
          >
            Flip
          </button>
          <button
            type="button"
            disabled={!ready || Boolean(error) || busy || livePaused}
            onClick={() => void snap()}
            className="min-h-12 min-w-[7rem] rounded-full bg-white px-8 py-3 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            {busy ? "…" : "Snap"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => releaseThenPick("phone")}
            className="min-h-11 rounded-full border border-white/25 px-3 py-2 text-sm text-white/90"
          >
            Phone
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => releaseThenPick("album")}
            className="min-h-11 rounded-full border border-white/25 px-3 py-2 text-sm text-white/90"
          >
            Album
          </button>
        </div>

        {/* System camera — has capture; must release live stream first */}
        <input
          ref={phoneCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPickedFile(file);
          }}
        />
        {/* Gallery — NO capture (important on Android/Huawei) */}
        <input
          ref={albumRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const list = e.target.files;
            e.target.value = "";
            if (!list?.length) return;
            void (async () => {
              for (const file of Array.from(list)) {
                await onPickedFile(file);
              }
            })();
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
