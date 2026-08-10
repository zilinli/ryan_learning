/**
 * POST /api/faq-ai — Ask Spark Help (read-only agent over docs + source).
 * Body: { question, replyLang?, attachments?[] }
 * Response: SSE (status / delta / done / error)
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent, SDKImage, SDKUserMessage } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { createFaqAiTools } from "@/lib/console-harness";
import {
  FAQ_AI_SYS,
  buildFaqAiUserPrompt,
  normalizeFaqReplyLang,
} from "@/lib/faq-ai";
import {
  normalizeIncomingAttachments,
  stripDataUrlPrefix,
} from "@/lib/attachments";
import { buildFileSummaries } from "@/lib/extract-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_Q = 2_000;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

export async function POST(req: Request) {
  let body: {
    question?: string;
    replyLang?: string;
    attachments?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = String(body.question || "").trim().slice(0, MAX_Q);
  const replyLang = normalizeFaqReplyLang(body.replyLang);
  const attachments = normalizeIncomingAttachments({
    attachments: body.attachments as never,
  });

  if (!question && attachments.length === 0) {
    return Response.json(
      { error: "Ask a question, or attach a photo / file." },
      { status: 400 },
    );
  }

  for (const a of attachments) {
    if (a.kind === "image" && a.data != null && String(a.data).trim().length < 8) {
      return Response.json(
        { error: `Photo "${a.name}" looks empty — try Camera / Upload again.` },
        { status: 400 },
      );
    }
  }

  const imageAttachments = attachments.filter((a) => a.kind === "image" && a.data);
  const fileSummaries = await buildFileSummaries(attachments);
  const images: SDKImage[] | undefined =
    imageAttachments.length > 0
      ? imageAttachments.map((img) => ({
          data: stripDataUrlPrefix(img.data || ""),
          mimeType: img.mimeType.startsWith("image/")
            ? img.mimeType
            : "image/jpeg",
        }))
      : undefined;

  const prompt = buildFaqAiUserPrompt({
    question: question || "Please answer based on the attached photo / file.",
    replyLang,
    fileSummaries,
  });

  const enc = new TextEncoder();
  const tools = createFaqAiTools();

  const stream = new ReadableStream({
    async start(ctrl) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          ctrl.close();
        } catch {
          // ignore
        }
      };
      const send = (ev: string, data: unknown) => {
        if (closed || req.signal.aborted) return;
        try {
          ctrl.enqueue(
            enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      heartbeat = setInterval(() => {
        if (closed || req.signal.aborted) {
          if (heartbeat) clearInterval(heartbeat);
          return;
        }
        send("hb", {});
      }, 8_000);

      let agent: SDKAgent | null = null;
      let full = "";
      const onAbort = () => {
        try {
          agent?.close();
        } catch {
          // ignore
        }
        close();
      };
      req.signal.addEventListener("abort", onAbort);

      try {
        send("status", { status: "Looking through docs & code…" });
        agent = await Agent.create({
          apiKey: apiKey(),
          model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
          name: "Spark Help",
          local: {
            cwd: path.resolve(process.cwd()),
            settingSources: [],
            customTools: tools,
          },
        });

        // Seed system guidance as the first user message (SDK has no separate sys slot here)
        const userMsg: SDKUserMessage =
          images && images.length > 0
            ? {
                text: `${FAQ_AI_SYS}\n\n---\n\n${prompt}`,
                images,
              }
            : { text: `${FAQ_AI_SYS}\n\n---\n\n${prompt}` };

        const run = await agent.send(userMsg, {
          onDelta: ({ update }) => {
            if (update.type === "text-delta" && update.text) {
              full += update.text;
              send("delta", { text: update.text });
            }
          },
        });

        for await (const ev of run.stream()) {
          if (req.signal.aborted) break;
          if (ev.type === "assistant") {
            for (const block of ev.message.content) {
              if (
                block.type === "text" &&
                block.text &&
                block.text.length > full.length
              ) {
                const extra = block.text.slice(full.length);
                full = block.text;
                if (extra) send("delta", { text: extra });
              }
            }
          }
        }

        const answer = full.trim();
        if (!answer) {
          send("error", {
            error: "No answer came back — try rephrasing the question.",
          });
        } else {
          send("done", { answer });
        }
      } catch (err) {
        const msg =
          err instanceof CursorAgentError
            ? `Help agent failed: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Help agent failed";
        send("error", { error: msg });
      } finally {
        req.signal.removeEventListener("abort", onAbort);
        try {
          agent?.close();
        } catch {
          // ignore
        }
        close();
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
