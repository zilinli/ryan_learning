"use client";

import { useEffect, useState, type ReactNode } from "react";
import { resolveFilePickerAccept } from "@/lib/attachments";

type Props = {
  disabled?: boolean;
  /** Desktop accept filter; Apple mounts once with star-slash-star */
  desktopAccept: string;
  multiple?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
  onFiles: (files: File[]) => void;
};

/**
 * iOS-safe file picker:
 * - Defer mount until accept resolved (never paint desktop filter then clear)
 * - Apple: accept all files; desktop: caller filter
 * - opacity 0.01 overlay inside label (opacity-0 can drop taps on WebKit)
 * - min 44x44 hit target
 */
export function FileAttachControl({
  disabled,
  desktopAccept,
  multiple = true,
  title = "Upload file",
  ariaLabel = "Upload file",
  className = "",
  children,
  onFiles,
}: Props) {
  const [fileAccept, setFileAccept] = useState<string | undefined>(undefined);
  const [pickerReady, setPickerReady] = useState(false);

  useEffect(() => {
    setFileAccept(resolveFilePickerAccept(desktopAccept));
    setPickerReady(true);
  }, [desktopAccept]);

  return (
    <label
      aria-disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center overflow-hidden ${
        disabled ? "pointer-events-none opacity-40" : ""
      } ${className}`}
    >
      {pickerReady ? (
        <input
          type="file"
          multiple={multiple}
          accept={fileAccept}
          disabled={disabled}
          aria-label={ariaLabel}
          // opacity 0.01 (not 0): some iOS WebKit builds treat opacity-0 as non-interactive
          className="absolute inset-0 z-10 cursor-pointer text-[16px] opacity-[0.01]"
          style={{ fontSize: 16 }}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      ) : null}
      {children}
    </label>
  );
}
