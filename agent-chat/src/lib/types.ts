export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: string;
}

export interface ToolCall {
  tool: string;
  input: unknown;
  output?: string;
  status: "running" | "success" | "error";
  timestamp: string;
}

export interface ConversationRecord {
  sessionId: string;
  agentId: string;
  title: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface SessionMeta {
  sessionId: string;
  agentId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  workspacePath: string;
}

export interface SessionRegistry {
  sessions: SessionMeta[];
  lastUpdated: string;
}

export interface WorkspaceNode {
  path: string;
  name: string;
  type: "directory" | "file";
  size?: number;
  children?: WorkspaceNode[];
}

export interface FileContent {
  path: string;
  size: number;
  mimeType: string;
  content: string;
  lines: number;
  language: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  workspacePath?: string;
}

export interface SSEEvent {
  type: "status" | "delta" | "tool_use" | "error" | "done";
  content?: string;
  message?: string;
  code?: string;
  sessionId?: string;
  messageCount?: number;
}
