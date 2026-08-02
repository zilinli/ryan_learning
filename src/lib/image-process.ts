/** Resize/compress images so phone uploads stay reliable. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

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
