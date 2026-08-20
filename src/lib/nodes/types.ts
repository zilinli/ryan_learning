export type PairRecord = {
  code: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
};

export type NodeRecord = {
  nodeId: string;
  token: string;
  hostname: string;
  platform: string;
  openclawVersion: string;
  lastSeen: number;
  createdAt: number;
  alias?: string;
  bridgeVersion?: string;
};

export type ChatAttachmentPayload = {
  name: string;
  mimeType: string;
  dataBase64: string;
};

export type NodeCommand =
  | {
      requestId: string;
      type: "chat";
      message: string;
      attachments?: ChatAttachmentPayload[];
    }
  | {
      requestId: string;
      type: "upgrade";
    };

export type NodeReplyEvent =
  | { requestId: string; type: "chunk"; text: string }
  | { requestId: string; type: "done"; text: string }
  | { requestId: string; type: "error"; error: string };
