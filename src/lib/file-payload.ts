import {
  isAllowedAttachment,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  normalizeMime,
  stripDataUrlPrefix,
  guessKind,
} from "./attachments";

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

export async function fileToAttachment(file: File): Promise<ClientAttachment> {
  const name = file.name || "upload";
  let mimeType = normalizeMime(file.type, name);

  if (!isAllowedAttachment(mimeType, name)) {
    throw new Error(
      `Unsupported file: ${name}. Use photos, PDF, or text (txt/md/csv).`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Keep each file under 12MB (${name})`);
  }

  const id = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const kind = guessKind(mimeType, name);

  if (kind === "image") {
    const dataUrlRaw = await readAsDataURL(file);
    const prefix = dataUrlRaw.match(/^data:([^;]+);base64,/);
    if (prefix?.[1] && prefix[1] !== "application/octet-stream") {
      mimeType = prefix[1] === "image/jpg" ? "image/jpeg" : prefix[1];
    }
    if (
      (mimeType === "image/heic" || mimeType === "image/heif") &&
      !dataUrlRaw.startsWith("data:image/")
    ) {
      throw new Error("Please save HEIC photos as JPG, or use Upload from Photos");
    }
    if (mimeType === "image/heic" || mimeType === "image/heif") {
      mimeType = "image/jpeg";
    }
    const dataUrl = dataUrlRaw.replace(
      /^data:[^;]+;base64,/,
      `data:${mimeType};base64,`,
    );
    return {
      id,
      name,
      mimeType,
      kind: "image",
      dataUrl,
      data: stripDataUrlPrefix(dataUrl),
    };
  }

  // Text-like documents: send extracted text (PDF text extracted on server)
  if (
    mimeType === "application/pdf" ||
    name.toLowerCase().endsWith(".pdf")
  ) {
    const dataUrl = await readAsDataURL(file);
    return {
      id,
      name,
      mimeType: "application/pdf",
      kind: "file",
      dataUrl,
      data: stripDataUrlPrefix(dataUrl),
    };
  }

  const textContent = await readAsText(file);
  return {
    id,
    name,
    mimeType,
    kind: "file",
    textContent: textContent.slice(0, 80_000),
  };
}

export async function filesToAttachments(
  fileList: FileList | File[],
  existingCount: number,
): Promise<{ items: ClientAttachment[]; errors: string[] }> {
  const files = Array.from(fileList);
  const room = Math.max(0, MAX_ATTACHMENTS - existingCount);
  const errors: string[] = [];
  if (files.length > room) {
    errors.push(`You can attach up to ${MAX_ATTACHMENTS} files at once.`);
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
  return { items, errors };
}
