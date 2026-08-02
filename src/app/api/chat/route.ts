import { normalizeIncomingAttachments, stripDataUrlPrefix } from "@/lib/attachments";
import { hasCursorApiKey, streamTutorReply } from "@/lib/cursor-agent";
import { buildFileSummaries } from "@/lib/extract-files";
import { buildTutorPrompt } from "@/lib/prompts";
import type { ChatRequestBody } from "@/lib/types";
import type { SDKImage } from "@cursor/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  if (!hasCursorApiKey()) {
    return Response.json(
      { error: "Cursor API Key is not configured." },
      { status: 503 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, message, reset } = body;
  if (!sessionId || typeof sessionId !== "string") {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const attachments = normalizeIncomingAttachments(body);
  if ((!message || !message.trim()) && attachments.length === 0) {
    return Response.json(
      { error: "Type a message or add photos / files." },
      { status: 400 },
    );
  }

  const imageAttachments = attachments.filter((a) => a.kind === "image" && a.data);
  const fileSummaries = await buildFileSummaries(attachments);

  const prompt = buildTutorPrompt({
    userText: message ?? "",
    imageCount: imageAttachments.length,
    fileSummaries,
  });

  const images: SDKImage[] | undefined =
    imageAttachments.length > 0
      ? imageAttachments.map((img) => ({
          data: stripDataUrlPrefix(img.data || ""),
          mimeType: img.mimeType.startsWith("image/")
            ? img.mimeType
            : "image/jpeg",
        }))
      : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      try {
        send("status", { status: "thinking" });
        const { agentId, fullText } = await streamTutorReply({
          sessionId,
          text: prompt,
          images,
          reset,
          handlers: {
            onText: (delta) => send("delta", { text: delta }),
            onStatus: (status) => send("status", { status }),
          },
        });
        send("done", { agentId, text: fullText });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        send("error", { error: msg });
      } finally {
        controller.close();
      }
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
