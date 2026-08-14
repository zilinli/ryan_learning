"use client";

import type { ChatAttachment } from "@/lib/types";

/** Prefer local dataUrl; then vault; then server media (after vault miss). */
function videoSrc(
  a: ChatAttachment,
  vaultSrc?: string | null,
  vaultChecked?: boolean,
): string | null {
  if (a.dataUrl) return a.dataUrl;
  if (vaultSrc) return vaultSrc;
  if (a.mediaId && vaultChecked) {
    return `/api/media/${encodeURIComponent(a.mediaId)}`;
  }
  return null;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || "video";
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Inline video player for chat attachments. Plays directly in the bubble when
 * the bytes are available (dataUrl / IndexedDB vault / server mediaId); falls
 * back to a calm unavailable chip when the media genuinely cannot be reached
 * (e.g. server file missing) so no broken element shows.
 */
export function VideoAttachment({
  attachment,
  isUser,
  vaultSrc,
  vaultChecked,
  loadFailed,
  onLoadFailed,
}: {
  attachment: ChatAttachment;
  isUser: boolean;
  vaultSrc?: string | null;
  vaultChecked?: boolean;
  loadFailed?: boolean;
  onLoadFailed?: (attachmentId: string) => void;
}) {
  const a = attachment;
  const src = loadFailed ? null : videoSrc(a, vaultSrc, vaultChecked);

  if (src) {
    return (
      <div
        className={`max-w-[16rem] overflow-hidden rounded-xl sm:max-w-[19rem] ${
          isUser
            ? "border border-[var(--surface)]"
            : "border border-[var(--line)]"
        }`}
      >
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="max-h-56 w-full bg-black object-contain"
          onError={() => {
            // dataUrl/vault hits are locally available; only a failed
            // /api/media fetch means the file is really missing.
            if (a.dataUrl || vaultSrc) return;
            onLoadFailed?.(a.id);
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="truncate text-[11px]" title={a.name}>
            {a.name || "Video"}
          </span>
          <button
            type="button"
            className="shrink-0 text-[11px] underline-offset-2 hover:underline"
            title={`Download ${a.name}`}
            onClick={() => triggerDownload(src, a.name || "video")}
          >
            download
          </button>
        </div>
      </div>
    );
  }

  // Still resolving the vault — keep a calm placeholder.
  if (!a.dataUrl && !vaultChecked && !loadFailed) {
    return (
      <span
        className={`inline-flex h-20 w-20 animate-pulse items-center justify-center rounded-xl text-xs ${
          isUser
            ? "bg-[var(--surface-muted)] text-white"
            : "bg-[var(--mist)] text-[var(--ink-muted)]"
        }`}
        aria-label="Loading video"
      >
        🎬
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
        isUser
          ? "bg-[var(--surface-muted)] text-white"
          : "bg-[var(--mist)] text-[var(--ink)]"
      }`}
      title="Video unavailable — please upload again"
    >
      🎬 {a.name || "Video"}
    </span>
  );
}
