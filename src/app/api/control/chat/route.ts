import { randomBytes } from "node:crypto";
import { checkAdmin } from "@/lib/nodes/auth";
import { enqueueCommand, pickOnlineNode, subscribeReply } from "@/lib/nodes/store";
import type { ChatAttachmentPayload } from "@/lib/nodes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 1200;

const MAX_ATTACH_BYTES = 80 * 1024 * 1024;
const CHAT_ABS_TIMEOUT_MS = 20 * 60 * 1000;
const CHAT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sanitizeAttachments(raw: unknown): ChatAttachmentPayload[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAttachmentPayload[] = [];
  for (const item of raw.slice(0, 9)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = String(rec.name || "file").slice(0, 180);
    const mimeType = String(rec.mimeType || "application/octet-stream");
    const dataBase64 = String(rec.dataBase64 || rec.dataUrl || "");
    if (!dataBase64) continue;
    const b64 = dataBase64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Math.floor((b64.length * 3) / 4);
    if (bytes > MAX_ATTACH_BYTES) continue;
    out.push({ name, mimeType, dataBase64: b64 });
  }
  return out;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    message?: string;
    nodeId?: string;
    attachments?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const attachments = sanitizeAttachments(body.attachments);
  const message = body.message?.trim() || "";
  if (!message && attachments.length === 0) {
    return Response.json({ error: "missing message" }, { status: 400 });
  }

  const node = await pickOnlineNode(body.nodeId);
  if (!node) {
    return Response.json(
      { error: "no online OpenClaw node. Open /deploy and pair a PC first." },
      { status: 503 },
    );
  }

  const requestId = randomBytes(8).toString("hex");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      send("status", { status: "thinking", nodeId: node.nodeId, hostname: node.hostname });
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      let absTimer: ReturnType<typeof setTimeout> | undefined;
      let unsub: () => void = () => {};
      const fail = (msg: string) => {
        clearTimeout(idleTimer);
        clearTimeout(absTimer);
        try {
          send("error", { error: msg });
        } catch {
          /* closed */
        }
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const armIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          fail(
            "node idle timeout (5 min, no progress). OpenClaw may be stuck — check Spark Bridge on the Mac.",
          );
        }, CHAT_IDLE_TIMEOUT_MS);
      };
      absTimer = setTimeout(() => {
        fail("node timeout (20 min absolute). Task still running on Mac may finish later.");
      }, CHAT_ABS_TIMEOUT_MS);
      armIdle();
      unsub = subscribeReply(requestId, (ev) => {
        armIdle();
        if (ev.type === "chunk") send("delta", { text: ev.text });
        if (ev.type === "done") {
          clearTimeout(idleTimer);
          clearTimeout(absTimer);
          send("done", { text: ev.text, nodeId: node.nodeId });
          unsub();
          controller.close();
        }
        if (ev.type === "error") {
          clearTimeout(idleTimer);
          clearTimeout(absTimer);
          send("error", { error: ev.error });
          unsub();
          controller.close();
        }
      });
      enqueueCommand(node.nodeId, {
        requestId,
        type: "chat",
        message,
        attachments: attachments.length ? attachments : undefined,
      });
      const origClose = controller.close.bind(controller);
      controller.close = () => {
        clearTimeout(idleTimer);
        clearTimeout(absTimer);
        origClose();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
