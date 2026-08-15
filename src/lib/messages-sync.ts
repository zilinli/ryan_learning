/**
 * Client-side message sync — modelled on creations-sync.ts.
 * Polls server every 8s for message state; cross-tab sync via BroadcastChannel.
 */

export type MessagesSyncData = {
  accountId: string;
  messages?: unknown[];
  unreadCount?: number;
};

let syncChannel: BroadcastChannel | null = null;
function channel(): BroadcastChannel {
  if (!syncChannel) syncChannel = new BroadcastChannel("spark-messages");
  return syncChannel;
}

export function subscribeMessagesChanged(
  handler: (data: MessagesSyncData) => void,
): () => void {
  const bc = channel();
  const onMsg = (e: MessageEvent<MessagesSyncData>) => {
    if (e.data && e.data.accountId) handler(e.data);
  };
  bc.addEventListener("message", onMsg);
  return () => bc.removeEventListener("message", onMsg);
}

export function notifyMessagesChanged(data: MessagesSyncData): void {
  try { channel().postMessage(data); } catch { /* ignore */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("spark-messages-changed", { detail: data }),
    );
  }
}

export async function fetchMessages(accountId: string): Promise<{
  messages: unknown[];
  unreadCount: number;
} | null> {
  try {
    const res = await fetch(
      `/api/messages?accountId=${encodeURIComponent(accountId)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as { messages: unknown[]; unreadCount: number };
  } catch { return null; }
}

export async function fetchUnreadCount(
  accountId: string,
  opts?: { minUrgency?: "routine" | "important" | "urgent" },
): Promise<number> {
  try {
    const q = new URLSearchParams({ accountId, countOnly: "1" });
    if (opts?.minUrgency) q.set("minUrgency", opts.minUrgency);
    const res = await fetch(`/api/messages?${q.toString()}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.unreadCount === "number" ? data.unreadCount : 0;
  } catch { return 0; }
}
