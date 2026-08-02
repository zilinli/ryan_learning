export type ChatRole = "user" | "assistant" | "system";

export type AttachmentKind = "image" | "file";

/** UI / stored message attachment */
export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  /** Preview for images (and sometimes files) */
  dataUrl?: string;
}

/** Wire format for /api/chat */
export interface ChatAttachmentPayload {
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  /** Base64 (no data: prefix) for images / binary files */
  data?: string;
  /** Extracted or plain text for documents */
  textContent?: string;
}

/** @deprecated use ChatAttachment — kept for old localStorage sessions */
export interface ChatImage {
  dataUrl: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  /** @deprecated legacy single image */
  image?: ChatImage;
  createdAt: number;
}

export interface TutorSessionState {
  sessionId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ChatRequestBody {
  sessionId: string;
  message: string;
  attachments?: ChatAttachmentPayload[];
  /** @deprecated legacy single image */
  image?: {
    data: string;
    mimeType: string;
  };
  reset?: boolean;
}
