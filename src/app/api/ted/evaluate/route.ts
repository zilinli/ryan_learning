/**
 * POST /api/ted/evaluate
 *
 * Body: { talkSlug, itemId, rubricHint, studentAnswer, grade? }
 *
 * Invokes a short-lived AI agent to score the student's answer against the
 * rubric hint. Returns a verdict (correct / partial / needs-work), a short
 * feedback line, and the corresponding BKT TurnOutcome so the caller can
 * record it via recordStudioLearningTurn().
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VERDICTS = ["correct", "partial", "needs-work"] as const;
type Verdict = (typeof VERDICTS)[number];
type TurnOutcome = "correct" | "incorrect" | "practice";

const VERDICT_TO_OUTCOME: Record<Verdict, TurnOutcome> = {
  correct: "correct",
  partial: "practice",
  "needs-work": "incorrect",
};

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

function evalPrompt(params: {
  talkSlug: string;
  rubricHint: string;
  studentAnswer: string;
  grade?: number;
}): string {
  const gradeLine =
    typeof params.grade === "number" && params.grade >= 1
      ? `The student is in grade ${params.grade}. Match expectations to this grade level.`
      : "Treat the student as grade 4 unless the answer suggests older/younger.";

  return [
    "You are a warm, encouraging TED listening coach. Evaluate the student's answer",
    "against the rubric below. Do NOT summarize or rewrite the answer — only judge it.",
    "",
    gradeLine,
    `Talk: ${params.talkSlug.replace(/_/g, " ")}`,
    `Rubric: ${params.rubricHint}`,
    "",
    "Student answer:",
    params.studentAnswer.trim() || "(empty)",
    "",
    "Return ONLY a JSON object (no markdown, no prose):",
    "{",
    `  "verdict": "${VERDICTS.join('" | "')}",   // pick one`,
    '  "feedback": "one encouraging sentence (max 60 words) with one concrete improvement hint",',
    "}",
    "",
    "Verdict rules:",
    "- correct = addresses the rubric clearly with a complete thought",
    "- partial = on the right track but incomplete or shallow",
    "- needs-work = off-topic, wrong, or refused to answer",
  ].join("\n");
}

function parseEvalResult(raw: string): {
  verdict: Verdict;
  feedback: string;
} | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const candidates: string[] = [text];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/im.exec(text);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const brace = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (brace >= 0 && last > brace) {
    candidates.unshift(text.slice(brace, last + 1));
  }
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as { verdict?: string; feedback?: string };
      const verdict = String(obj.verdict || "").trim() as Verdict;
      if (!VERDICTS.includes(verdict)) continue;
      const feedback = String(obj.feedback || "").trim().slice(0, 400);
      if (!feedback) continue;
      return { verdict, feedback };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "ted-evaluate", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: {
    talkSlug?: string;
    itemId?: string;
    rubricHint?: string;
    studentAnswer?: string;
    grade?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const talkSlug = String(body.talkSlug || "talk").trim();
  const rubricHint = String(body.rubricHint || "").trim();
  const studentAnswer = String(body.studentAnswer || "").trim();
  const grade = typeof body.grade === "number" ? Math.round(body.grade) : undefined;

  if (!rubricHint) {
    return Response.json(
      { ok: false, error: "rubricHint required" },
      { status: 400 },
    );
  }
  if (!studentAnswer) {
    return Response.json(
      {
        ok: true,
        verdict: "needs-work" as Verdict,
        feedback:
          "You didn't write an answer yet — take a guess, even if you're not sure! Every try moves you forward.",
        outcome: "incorrect" as TurnOutcome,
      },
    );
  }

  let agent: SDKAgent | null = null;
  try {
    agent = await Agent.create({
      apiKey: apiKey(),
      model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
      name: "TED Evaluate",
      local: {
        cwd: path.join(process.cwd(), "tutor-workspace"),
        settingSources: [],
      },
    });

    let full = "";
    const prompt = evalPrompt({ talkSlug, rubricHint, studentAnswer, grade });
    const run = await agent.send(
      { text: prompt },
      {
        onDelta: ({ update }) => {
          if (update.type === "text-delta" && update.text) full += update.text;
        },
      },
    );
    for await (const ev of run.stream()) {
      if (req.signal.aborted) break;
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

    const parsed = parseEvalResult(full);
    if (!parsed) {
      // Fallback: simple heuristic
      const words = studentAnswer.split(/\s+/).filter(Boolean).length;
      const hasRubricTerms = rubricHint
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((w) => studentAnswer.toLowerCase().includes(w));
      const fallbackVerdict =
        words < 3
          ? ("needs-work" as Verdict)
          : hasRubricTerms
            ? ("correct" as Verdict)
            : ("partial" as Verdict);
      const fallbackFeedback =
        fallbackVerdict === "correct"
          ? "Good answer — you connected to the main idea! Can you add one more detail from the talk?"
          : fallbackVerdict === "partial"
            ? "Nice try! Try to mention something specific from the talk — what did the speaker actually say?"
            : "Give it another shot — what's one thing you remember the speaker saying? Even one word is a great start!";
      return Response.json({
        ok: true,
        verdict: fallbackVerdict,
        feedback: fallbackFeedback,
        fallback: true,
        outcome: VERDICT_TO_OUTCOME[fallbackVerdict],
      });
    }

    return Response.json({
      ok: true,
      verdict: parsed.verdict,
      feedback: parsed.feedback,
      outcome: VERDICT_TO_OUTCOME[parsed.verdict],
    });
  } catch (err) {
    // Complete degradation: always return partial so studio-learning still writes BKT
    if (err instanceof CursorAgentError) {
      return Response.json({
        ok: true,
        verdict: "partial" as Verdict,
        feedback:
          "Nice effort! The coach is resting — but every answer counts. Try again after the next talk.",
        fallback: true,
        degraded: true,
        outcome: "practice" as TurnOutcome,
      });
    }
    return Response.json(
      { ok: false, error: "Evaluation failed" },
      { status: 500 },
    );
  } finally {
    try {
      agent?.close();
    } catch {
      /* ignore */
    }
  }
}
