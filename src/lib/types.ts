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
  /** Full data URL — used as fallback when `data` is missing */
  dataUrl?: string;
  /** Extracted or plain text for documents */
  textContent?: string;
  /** Server media id (history) — server can re-extract text */
  mediaId?: string;
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

/** CA-1 worksheet progress (optional; ignored by older clients) */
export interface ConversationWorksheetPlan {
  total: number;
  current: number;
  items: Array<{
    id: number;
    label: string;
    status: "pending" | "active" | "done" | "skipped";
  }>;
  source: "agent";
  updatedAt: number;
}

/** One chat in the sidebar history list */
export interface ConversationRecord {
  sessionId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  /** CA-1 — multi-problem worksheet progress */
  worksheetPlan?: ConversationWorksheetPlan;
  /** A2.h — set once a practice offer was generated for this conversation */
  practiceOfferEmittedAt?: number;
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
  /** Base64 image data (no prefix) from this turn's attachments — re-sent on follow-up to prevent forgetting */
  images?: Array<{ name: string; mimeType: string; data: string }>;
}

export interface ChatRequestBody {
  sessionId: string;
  message: string;
  attachments?: ChatAttachmentPayload[];
  /** Recent text turns (no images) — keeps context if agent was recreated */
  history?: HistoryTurn[];
  /** Voice picker id: auto | ava | yunxi | wanLung | alvaro | henri … */
  voiceId?: string;
  /** Explicit reply language: auto | en | zh | yue | es | fr */
  replyLanguage?: string;
  /** Other chat titles for cross-session continuity */
  recentTitles?: string[];
  /** Cross-session learning memory snapshot (topics / BKT skills / session digests) */
  learningMemory?: {
    topics?: Array<{
      id: string;
      label: string;
      mastery: number;
      solves?: number;
      lastSeen?: number;
    }>;
    skills?: Array<{
      id: string;
      label: string;
      topicId?: string;
      pKnown?: number;
      mastery?: number;
      attempts?: number;
      correct?: number;
      incorrect?: number;
      confidence?: number;
      lastSeen?: number;
    }>;
    recentStruggles?: string[];
    recentWins?: string[];
    /** Session digests — episodic memory from past conversations */
    sessionDigests?: Array<{
      date: string;
      topic: string;
      insight: string;
      bestApproach: string;
    }>;
    updatedAt?: number;
  };
  /** Engagement / streak snapshot for celebration cues */
  engagement?: {
    streak?: number;
    solvesToday?: number;
    totalSolves?: number;
    badges?: string[];
  };
  /** Active student account profile — name/grade/school for tutor personalization */
  studentProfile?: {
    name?: string;
    age?: number;
    grade?: number;
    gradeBand?: string;
    school?: string;
    curriculum?: {
      label?: string;
      grade?: number;
      subjects?: string[];
      textbookHints?: string;
    } | null;
    preferredChinese?: "zh" | "yue";
    stronger?: string[];
    focusAreas?: string[];
  };
  /** @deprecated legacy single image */
  image?: {
    data: string;
    mimeType: string;
  };
  reset?: boolean;
  /** D1 — parent PIN check mode: full worked steps (exit forces Socratic) */
  checkMode?: boolean;
}

export interface DiffBlock { filepath: string; hunks: string; added: number; removed: number; }
export interface ToolCall { tool: string; input?: string; output?: string; status: "running" | "success" | "error"; time: string; }
export interface TestResult { passed: number; failed: number; output: string; }
export type PendingAction = "apply" | "revert" | null;
export interface ConsoleMessage { id: string; role: "user" | "assistant" | "system"; content: string; diffs?: DiffBlock[]; testResults?: TestResult; pendingAction?: PendingAction; actionApplied?: boolean; status?: string; tools?: ToolCall[]; attachments?: { name: string; kind: AttachmentKind }[]; createdAt: number; }
export interface ConsoleSessionState { sessionId: string; messages: ConsoleMessage[]; fileChangeCount: number; hasUncommittedChanges: boolean; }
export interface ConsoleChatRequestBody { sessionId: string; message: string; attachments?: ChatAttachmentPayload[]; voiceLang?: string; pin?: string; pinHash?: string; action?: string; }
export interface MiniConsoleState { open: boolean; sessionId: string; phase: "idle" | "thinking" | "diff" | "applied" | "error"; userMessage: string; agentMessage: string; diff?: DiffBlock; testResults?: TestResult; error?: string; }
