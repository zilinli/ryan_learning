export type ChatRole = "user" | "assistant" | "system";

export type AttachmentKind = "image" | "file";

/** UI / stored message attachment */
export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  /** Local preview (base64 data URL) — kept in browser storage */
  dataUrl?: string;
  /** Server-persisted homework photo id → GET /api/media/:id */
  mediaId?: string;
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

/** @deprecated single-session shape (v2 localStorage) */
export interface TutorSessionState {
  sessionId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

/** One chat in the sidebar history list */
export interface ConversationRecord {
  sessionId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ConversationsStore {
  version: 3;
  activeId: string;
  conversations: ConversationRecord[];
}

/** Compact prior turns for prompt continuity after agent cold-start */
export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  sessionId: string;
  message: string;
  attachments?: ChatAttachmentPayload[];
  /** Recent text turns (no images) — keeps context if agent was recreated */
  history?: HistoryTurn[];
  /** Voice picker id: auto | ava | yunxi | wanLung | alvaro … */
  voiceId?: string;
  /** Explicit reply language: auto | en | zh | yue | es */
  replyLanguage?: string;
  /** Other chat titles for cross-session continuity */
  recentTitles?: string[];
  /** Cross-session learning memory snapshot (topics / mastery) */
  learningMemory?: {
    topics?: Array<{
      id: string;
      label: string;
      mastery: number;
      solves?: number;
      lastSeen?: number;
    }>;
    recentStruggles?: string[];
    recentWins?: string[];
    updatedAt?: number;
  };
  /** Engagement / streak snapshot for celebration cues */
  engagement?: {
    streak?: number;
    solvesToday?: number;
    totalSolves?: number;
    badges?: string[];
  };
  /** @deprecated legacy single image */
  image?: {
    data: string;
    mimeType: string;
  };
  reset?: boolean;
}
