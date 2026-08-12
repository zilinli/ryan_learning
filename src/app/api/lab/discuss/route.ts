/**
 * POST /api/lab/discuss
 * Body: { lab: "bbc"|"rsa"|"natgeo", action: "open"|"reply", context, studentReply?, history? }
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  buildLabDiscussOpenerLocal,
  buildLabDiscussReplyLocal,
  discussOpenAgentPrompt,
  discussReplyAgentPrompt,
  parseLabDiscussId,
  type LabDiscussContext,
  type LabDiscussTurn,
} from "@/lib/entertain/lab-discuss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

function parseContext(raw: unknown): LabDiscussContext | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const prompt = String(c.prompt || "").trim();
  const essay = String(c.essay || "").trim();
  if (!prompt || essay.length < 3) return null;
  return {
    talkTitle: String(c.talkTitle || "Challenge").slice(0, 200),
    speaker: String(c.speaker || "Source").slice(0, 120),
    kind: String(c.kind || "critique").slice(0, 32),
    prompt: prompt.slice(0, 2000),
    choices: Array.isArray(c.choices)
      ? c.choices.map((x) => String(x).slice(0, 300)).slice(0, 4)
      : [],
    selected: Array.isArray(c.selected)
      ? [...new Set(c.selected as number[])]
          .filter((n) => Number.isInteger(n) && n >= 0 && n < 4)
          .slice(0, 4)
      : [],
    essay: essay.slice(0, 4000),
  };
}

async function runAgent(prompt: string, signal: AbortSignal): Promise<string> {
  let agent: SDKAgent | null = null;
  try {
    agent = await Agent.create({
      apiKey: apiKey(),
      model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
      name: "Lab Discuss",
      local: {
        cwd: path.join(process.cwd(), "tutor-workspace"),
        settingSources: [],
      },
    });
    let full = "";
    const run = await agent.send(
      { text: prompt },
      {
        onDelta: ({ update }) => {
          if (update.type === "text-delta" && update.text) full += update.text;
        },
      },
    );
    for await (const ev of run.stream()) {
      if (signal.aborted) break;
      if (ev.type === "assistant") {
        for (const block of ev.message.content) {
          if (
            block.type === "text" &&
            block.text &&
            block.text.length > full.length
          ) {
            full = block.text;
          }
        }
      }
    }
    return full.replace(/^```[\w]*\n?|\n?```$/g, "").trim().slice(0, 1200);
  } finally {
    try {
      agent?.close();
    } catch {
      /* ignore */
    }
  }
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "lab-discuss", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: {
    lab?: string;
    action?: string;
    context?: unknown;
    studentReply?: string;
    history?: Array<{ role?: string; text?: string }>;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const lab = parseLabDiscussId(body.lab);
  if (!lab) {
    return Response.json(
      { ok: false, error: "lab must be bbc, rsa, or natgeo" },
      { status: 400 },
    );
  }

  const ctx = parseContext(body.context);
  if (!ctx) {
    return Response.json(
      { ok: false, error: "Missing discuss context (prompt + essay)" },
      { status: 400 },
    );
  }

  const action = body.action === "reply" ? "reply" : "open";
  const history: LabDiscussTurn[] = Array.isArray(body.history)
    ? body.history
        .map((t) => ({
          role: t.role === "you" ? ("you" as const) : ("coach" as const),
          text: String(t.text || "").trim().slice(0, 800),
        }))
        .filter((t) => t.text)
        .slice(-10)
    : [];

  if (action === "open") {
    let reply = buildLabDiscussOpenerLocal(lab, ctx);
    try {
      const full = await runAgent(discussOpenAgentPrompt(lab, ctx), req.signal);
      if (full.length > 12) reply = full;
    } catch (err) {
      if (!(err instanceof CursorAgentError) && !(err instanceof Error)) {
        /* local */
      }
    }
    return Response.json({ ok: true, reply, lab });
  }

  const studentReply = String(body.studentReply || "").trim().slice(0, 1200);
  if (studentReply.length < 1) {
    return Response.json({ ok: false, error: "Reply is empty" }, { status: 400 });
  }

  let reply = buildLabDiscussReplyLocal(lab, ctx, studentReply);
  try {
    const full = await runAgent(
      discussReplyAgentPrompt(lab, ctx, history, studentReply),
      req.signal,
    );
    if (full.length > 12) reply = full;
  } catch {
    /* local */
  }
  return Response.json({ ok: true, reply, lab });
}
