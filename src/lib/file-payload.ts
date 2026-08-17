import {
  isAllowedAttachment,
  isOfficeAttachment,
  isVideoAttachment,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  normalizeMime,
  stripDataUrlPrefix,
  guessKind,
} from "./attachments";
import { compressImageDataUrl } from "./image-process";

export type ClientAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: "image" | "file";
  dataUrl?: string;
  data?: string;
  textContent?: string;
};

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsText(file);
  });
}

function newId() {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function fileToAttachment(file: File): Promise<ClientAttachment> {
  const name = file.name || `upload-${Date.now()}`;
  let mimeType = normalizeMime(file.type, name);

  // Phone camera often returns empty name + empty type
  if (!file.type && !name.includes(".")) {
    mimeType = "image/jpeg";
  }

  if (!isAllowedAttachment(mimeType, name) && !mimeType.startsWith("image/")) {
    // Last resort: if browser thinks it's an image blob from camera
    if (file.type.startsWith("image/") || file.name === "" || file.name === "image.jpg") {
      mimeType = file.type || "image/jpeg";
    } else {
      throw new Error(
        `Unsupported file: ${name || "unknown"}. Use photos, short videos (mp4/webm/mov), PDF, Markdown, Word, PowerPoint, Excel, HTML, or text.`,
      );
    }
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Keep each file under ${MAX_FILE_MB}MB (${name})`);
  }

  const id = newId();
  const kind = guessKind(mimeType, name || "photo.jpg");

  if (kind === "image" || mimeType.startsWith("image/")) {
    if (file.size < 32) {
      throw new Error("That photo looks empty — try again");
    }
    const dataUrlRaw = await readAsDataURL(file);
    if (!dataUrlRaw.startsWith("data:")) {
      throw new Error(`Could not read photo ${name}`);
    }
    const compressed = await compressImageDataUrl(dataUrlRaw, mimeType);
    if (!compressed.data || compressed.data.length < 32) {
      throw new Error("Could not process that photo — try Camera → Phone");
    }
    const safeName =
      name && name.includes(".")
        ? name.replace(/\.(heic|heif)$/i, ".jpg")
        : `photo-${id.slice(-6)}.jpg`;
    return {
      id,
      name: safeName,
      mimeType: compressed.mimeType,
      kind: "image",
      dataUrl: compressed.dataUrl,
      data: compressed.data,
    };
  }

  if (mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const dataUrl = await readAsDataURL(file);
    return {
      id,
      name,
      mimeType: "application/pdf",
      kind: "file",
      // data-only (like videos): a multi-MB dataUrl would double the bytes in
      // memory + JSON body and crash low-memory phones. The server rebuilds the
      // dataUrl from `data` before persisting, and the client downloads by mediaId.
      data: stripDataUrlPrefix(dataUrl),
    };
  }

  // Office Open XML — binary; server extracts text (never readAsText)
  if (isOfficeAttachment(mimeType, name)) {
    const dataUrl = await readAsDataURL(file);
    return {
      id,
      name,
      mimeType,
      kind: "file",
      // data-only (memory safety — see PDF branch above)
      data: stripDataUrlPrefix(dataUrl),
    };
  }

  // Short video — binary; server STT + keyframe OCR (never readAsText).
  // IMPORTANT: only `data` (raw base64) is kept — no `dataUrl`. Holding both
  // doubles the multi-MB clip in memory and, combined with JSON.stringify,
  // crashes low-memory phones mid-upload (the 499 page-reloads). Local preview
  // shows the "VID" chip in Composer; after send the server writes media and
  // the client re-fetches via mediaId.
  if (isVideoAttachment(mimeType, name)) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error(
        `Keep videos under ${MAX_VIDEO_MB}MB (${name}) — uploads are sent as data and larger clips crash the browser.`,
      );
    }
    const dataUrl = await readAsDataURL(file);
    const data = stripDataUrlPrefix(dataUrl);
    return {
      id,
      name,
      mimeType: mimeType.startsWith("video/") ? mimeType : "video/mp4",
      kind: "file",
      data,
    };
  }

  // Text docs (md/html/code/csv/…): keep text for the tutor + a dataUrl so history can download
  const textContent = await readAsText(file);
  const clipped = textContent.slice(0, 80_000);
  const dataUrl = `data:${mimeType || "text/plain"};charset=utf-8,${encodeURIComponent(clipped)}`;
  return {
    id,
    name,
    mimeType,
    kind: "file",
    textContent: clipped,
    dataUrl,
  };
}

export async function filesToAttachments(
  fileList: FileList | File[],
  existingCount: number,
): Promise<{ items: ClientAttachment[]; errors: string[] }> {
  const files = Array.from(fileList).filter(Boolean);
  const room = Math.max(0, MAX_ATTACHMENTS - existingCount);
  const errors: string[] = [];
  if (files.length === 0) return { items: [], errors: ["No file selected"] };
  if (room <= 0) {
    return {
      items: [],
      errors: [`Already at the limit of ${MAX_ATTACHMENTS} attachments`],
    };
  }
  if (files.length > room) {
    errors.push(`Only adding ${room} more (max ${MAX_ATTACHMENTS}).`);
  }
  const slice = files.slice(0, room);
  const items: ClientAttachment[] = [];
  for (const file of slice) {
    try {
      items.push(await fileToAttachment(file));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Failed: ${file.name}`);
    }
  }
  if (!items.length && !errors.length) {
    errors.push("Could not read the selected files");
  }
  return { items, errors };
}

export function attachmentFromCameraCapture(payload: {
  dataUrl: string;
  mimeType: string;
  data: string;
  index?: number;
}): ClientAttachment {
  const id = newId();
  return {
    id,
    name: `camera-${payload.index ?? id.slice(-4)}.jpg`,
    mimeType: payload.mimeType || "image/jpeg",
    kind: "image",
    dataUrl: payload.dataUrl,
    data: payload.data,
  };
}
