/**
 * POST /api/dialect-correct
 *
 * 方言 STT 转写纠错（兜底路径）：把 ASR 转写文本交给 Cursor Agent (LLM)
 * 只做同音/用词纠错，返回 { corrected, changed }。
 * 失败/超时一律返回 { corrected: raw, changed: false }，绝不阻塞语音输入。
 *
 * Body: { text: string, dialect: "teo" | "hak" }
 */

import path from "node:path";
import { Agent } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import {
  buildDialectCorrectionPrompt,
  parseCorrectionResult,
  type DialectKind,
  type DialectSttCorrectResult,
} from "@/lib/dialect-stt-correct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TEXT = 200;

function apiKey(): string {
  const k =
    process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

export async function POST(req: Request): Promise<Response> {
  let body: { text?: string; dialect?: string };
  try {
    body = (await req.json()) as { text?: string; dialect?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body.text || "").trim();
  const dialect = body.dialect;
  if (!raw) {
    return Response.json({ error: "Empty text" }, { status: 400 });
  }
  if (dialect !== "teo" && dialect !== "hak") {
    return Response.json({ error: "Invalid dialect" }, { status: 400 });
  }
  if (raw.length > MAX_TEXT) {
    return Response.json(
      { error: `Text too long (max ${MAX_TEXT} characters)` },
      { status: 400 },
    );
  }

  const fallback: DialectSttCorrectResult = {
    corrected: raw,
    changed: false,
    raw,
  };

  const prompt = buildDialectCorrectionPrompt(raw, dialect as DialectKind);

  let agent: SDKAgent | null = null;
  const close = () => {
    try {
      agent?.close();
    } catch {
      // ignore
    }
  };
  const onAbort = () => close();
  req.signal.addEventListener("abort", onAbort);

  try {
    agent = await Agent.create({
      apiKey: apiKey(),
      model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
      name: "Spark Dialect Corrector",
      local: {
        cwd: path.join(process.cwd(), "tutor-workspace"),
        settingSources: [],
      },
    });

    let full = "";
    const run = await agent.send(prompt, {
      onDelta: ({ update }) => {
        if (update.type === "text-delta" && update.text) {
          full += update.text;
        }
      },
    });

    for await (const ev of run.stream()) {
      if (req.signal.aborted) break;
      if (ev.type === "assistant") {
        for (const block of ev.message.content) {
          if (block.type === "text" && block.text && block.text.length > full.length) {
            full = block.text;
          }
        }
      }
    }

    return Response.json(parseCorrectionResult(full, raw));
  } catch (err) {
    if (req.signal.aborted) {
      return Response.json(fallback);
    }
    console.warn(
      "[dialect-correct] LLM correction failed, returning raw:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(fallback);
  } finally {
    req.signal.removeEventListener("abort", onAbort);
    close();
  }
}
