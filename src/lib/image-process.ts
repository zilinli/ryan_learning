/** Resize/compress images so phone uploads stay reliable. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/** Normalized crop rect (0–1 relative to image width/height). */
export type CropRectNorm = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = url;
  });
}

/**
 * Normalize any browser-readable image to JPEG base64.
 * Falls back to the original data URL if canvas encode fails (e.g. odd formats).
 */
export async function compressImageDataUrl(
  dataUrl: string,
  mimeHint = "image/jpeg",
): Promise<{ dataUrl: string; mimeType: string; data: string }> {
  // Skip tiny images
  const approxBytes = Math.floor((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 0.75);
  try {
    const img = await loadImage(dataUrl);
    let { width, height } = img;
    if (!width || !height) {
      throw new Error("empty image");
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer JPEG for photos; keep PNG only for tiny graphics with alpha needs
    const wantPng = mimeHint === "image/png" && approxBytes < 400_000;
    const mimeType = wantPng ? "image/png" : "image/jpeg";
    const out = wantPng
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const data = out.replace(/^data:[^;]+;base64,/, "");
    if (!data || data.length < 32) throw new Error("encode failed");
    return { dataUrl: out, mimeType, data };
  } catch {
    const mimeType =
      dataUrl.match(/^data:([^;]+);/)?.[1] || mimeHint || "image/jpeg";
    return {
      dataUrl,
      mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
      data: dataUrl.replace(/^data:[^;]+;base64,/, ""),
    };
  }
}

/**
 * Crop a region from a data URL (AUDIT8 photo框选).
 * Rect is normalized 0–1; tiny / full-frame crops return compressed full image.
 */
export async function cropImageDataUrl(
  dataUrl: string,
  rect: CropRectNorm,
  mimeHint = "image/jpeg",
): Promise<{ dataUrl: string; mimeType: string; data: string }> {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  const w = clamp01(rect.w);
  const h = clamp01(rect.h);
  // Near-full page or invalid → just compress
  if (w < 0.05 || h < 0.05 || (x <= 0.02 && y <= 0.02 && w >= 0.96 && h >= 0.96)) {
    return compressImageDataUrl(dataUrl, mimeHint);
  }

  try {
    const img = await loadImage(dataUrl);
    const iw = img.width;
    const ih = img.height;
    if (!iw || !ih) throw new Error("empty image");

    let sx = Math.floor(x * iw);
    let sy = Math.floor(y * ih);
    let sw = Math.floor(w * iw);
    let sh = Math.floor(h * ih);
    sx = Math.max(0, Math.min(iw - 1, sx));
    sy = Math.max(0, Math.min(ih - 1, sy));
    sw = Math.max(1, Math.min(iw - sx, sw));
    sh = Math.max(1, Math.min(ih - sy, sh));

    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    const cw = Math.max(1, Math.round(sw * scale));
    const ch = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);

    const mimeType = "image/jpeg";
    const out = canvas.toDataURL(mimeType, JPEG_QUALITY);
    const data = out.replace(/^data:[^;]+;base64,/, "");
    if (!data || data.length < 32) throw new Error("encode failed");
    return { dataUrl: out, mimeType, data };
  } catch {
    return compressImageDataUrl(dataUrl, mimeHint);
  }
}
