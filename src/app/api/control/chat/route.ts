import { randomBytes } from "node:crypto";
import { checkAdmin } from "@/lib/nodes/auth";
import { enqueueCommand, pickOnlineNode, subscribeReply } from "@/lib/nodes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { message?: string; nodeId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "missing message" }, { status: 400 });

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
      const unsub = subscribeReply(requestId, (ev) => {
        if (ev.type === "chunk") send("delta", { text: ev.text });
        if (ev.type === "done") {
          send("done", { text: ev.text, nodeId: node.nodeId });
          unsub();
          controller.close();
        }
        if (ev.type === "error") {
          send("error", { error: ev.error });
          unsub();
          controller.close();
        }
      });
      enqueueCommand(node.nodeId, { requestId, type: "chat", message });
      const watchdog = setTimeout(() => {
        send("error", { error: "node timeout (3 min). Is Spark Bridge running?" });
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }, 180_000);
      const origClose = controller.close.bind(controller);
      controller.close = () => {
        clearTimeout(watchdog);
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
