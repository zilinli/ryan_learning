import { NextRequest } from "next/server";
import { streamAgentResponse } from "@/lib/agent";
import type { ChatRequest } from "@/lib/types";
import { autoGitPipeline } from "@/lib/git-ops";

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, sessionId, workspacePath, attachments, voiceLang } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ACC_WORKSPACE = "/root/codes/ryan_learning";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const toolEvents: Array<{ tool?: string; input?: unknown }> = [];
        let lastDoneSent = false;

        for await (const event of streamAgentResponse(
          message.trim(),
          sessionId,
          workspacePath,
          attachments,
          voiceLang,
        )) {
          if (event.type === "tool_call") {
            toolEvents.push({ tool: event.tool, input: event.input });
          }
          // 11C.6 — enrich the "done" event with auto-git results
          if (event.type === "done") {
            let commitInfo = {};
            try {
              const res = await autoGitPipeline(ACC_WORKSPACE, toolEvents);
              if (res.testResult === "skipped") {
                commitInfo = { commitSkipped: true, skippedReason: res.skippedReason };
              } else {
                commitInfo = {
                  commitSha: res.sha,
                  commitMessage: res.message,
                  testResult: res.testResult,
                  testDetail: res.testDetail,
                };
              }
            } catch (err) {
              commitInfo = { testResult: "fail", testDetail: String(err).slice(0, 300) };
            }
            lastDoneSent = true;
            const enriched = { ...event, ...commitInfo };
            const line = `event: ${enriched.type}\ndata: ${JSON.stringify(enriched)}\n\n`;
            controller.enqueue(encoder.encode(line));
            continue;
          }
          const line = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        }

        // Safety: ensure at least one "done" event is emitted
        if (!lastDoneSent) {
          const line = `event: done\ndata: ${JSON.stringify({ type: "done" })}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`
          )
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
