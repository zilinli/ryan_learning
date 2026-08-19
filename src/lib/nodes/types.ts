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
};

export type NodeCommand = {
  requestId: string;
  type: "chat";
  message: string;
};

export type NodeReplyEvent =
  | { requestId: string; type: "chunk"; text: string }
  | { requestId: string; type: "done"; text: string }
  | { requestId: string; type: "error"; error: string };
