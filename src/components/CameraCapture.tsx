"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureMediaDevices, isSecureMediaContext } from "@/lib/media";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (payload: {
    dataUrl: string;
    mimeType: string;
    data: string;
  }) => void;
};

async function getCameraStream(
  facingMode: "environment" | "user",
): Promise<MediaStream> {
  const devices = ensureMediaDevices();
  if (!devices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser");
  }
  if (!isSecureMediaContext()) {
    throw new Error("Camera needs HTTPS — open https://… on your phone");
  }

  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    {
      audio: false,
      video: { facingMode },
    },
    {
      audio: false,
      video: true,
    },
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

export function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setReady(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    setError("");
    try {
      const stream = await getCameraStream(facingMode);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        const onReady = () => {
          video.removeEventListener("loadedmetadata", onReady);
          resolve();
        };
        video.addEventListener("loadedmetadata", onReady);
      });

      try {
        await video.play();
      } catch {
        // Autoplay may need another tap; still mark ready if frames exist
      }
      setReady(Boolean(video.videoWidth || stream.active));
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
          "Camera permission blocked — allow camera, or use Take photo / Upload below.",
        );
      } else if (name === "NotFoundError") {
        setError("No camera found — use Upload instead.");
      } else {
        setError(msg);
      }
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }
    void startStream();
    return () => stopStream();
  }, [open, facingMode, startStream, stopStream]);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    if (!w || !h) {
      setError("Camera not ready — wait a moment or use Take photo.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror selfie preview to match what user sees
    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const data = dataUrl.replace(/^data:[^;]+;base64,/, "");
    onCapture({ dataUrl, mimeType: "image/jpeg", data });
    stopStream();
    onClose();
  };

  const onFallbackFile = async (file: File | undefined) => {
    if (!file) return;
    const mimeType =
      file.type === "image/jpg" || !file.type ? "image/jpeg" : file.type;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the photo"));
      reader.readAsDataURL(file);
    });
    const data = dataUrl.replace(/^data:[^;]+;base64,/, "");
    onCapture({ dataUrl, mimeType, data });
    stopStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,28,34,0.72)] p-0 sm:items-center sm:p-4">
      <div className="safe-bottom flex max-h-dvh w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/20 bg-[var(--ink)] shadow-2xl animate-fade-up sm:rounded-2xl">
        <div className="safe-top flex shrink-0 items-center justify-between px-4 py-3 text-white">
          <p className="text-sm font-medium">Camera</p>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="min-h-11 px-2 text-sm text-white/80 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="relative aspect-[3/4] min-h-0 flex-1 bg-black sm:aspect-[4/3]">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover ${
              facingMode === "user" ? "scale-x-[-1]" : ""
            }`}
          />
          {!ready && !error ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              Starting camera…
            </div>
          ) : null}
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[#ffb4a8]">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => fileFallbackRef.current?.click()}
                className="min-h-11 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[var(--ink)]"
              >
                Take photo / pick image
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() =>
              setFacingMode((m) => (m === "environment" ? "user" : "environment"))
            }
            className="min-h-11 rounded-full border border-white/25 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Flip
          </button>
          <button
            type="button"
            disabled={!ready || Boolean(error)}
            onClick={snap}
            className="min-h-12 rounded-full bg-white px-8 py-3 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            Snap
          </button>
          <button
            type="button"
            onClick={() => fileFallbackRef.current?.click()}
            className="min-h-11 rounded-full border border-white/25 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Album
          </button>
        </div>

        <input
          ref={fileFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFallbackFile(file);
          }}
        />
      </div>
    </div>
  );
}
