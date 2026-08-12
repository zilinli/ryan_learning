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
  if (!k) throw new Error("Cursor API Key not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

function evalPrompt(params: {
  videoId: string;
  rubricHint: string;
  studentAnswer: string;
  grade?: number;
}): string {
  const gradeLine =
    typeof params.grade === "number" && params.grade >= 1
      ? `The student is in grade ${params.grade}.`
      : "Treat as grade 7 unless the answer suggests otherwise.";

  return [
    "You are a warm, encouraging listening/comprehension coach for a student who just watched an RSA animated talk.",
    "Evaluate the student's answer against the rubric. Do NOT summarize or rewrite — only judge.",
    "",
    gradeLine,
    `Video: ${params.videoId}`,
    `Rubric: ${params.rubricHint}`,
    "",
    "Student answer:",
    params.studentAnswer.trim() || "(empty)",
    "",
    "Return ONLY JSON (no markdown):",
    "{",
    `  "verdict": "${VERDICTS.join('" | "')}",`,
    '  "feedback": "one encouraging sentence (max 60 words) with one concrete improvement hint",',
    "}",
    "",
    "Verdict: correct=addresses rubric with complete thought, partial=on track but shallow, needs-work=off-topic/wrong/empty",
  ].join("\n");
}

function parse(raw: string): { verdict: Verdict; feedback: string } | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const candidates: string[] = [text];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/im.exec(text);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const brace = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (brace >= 0 && last > brace) candidates.unshift(text.slice(brace, last + 1));
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as { verdict?: string; feedback?: string };
      const verdict = String(obj.verdict || "").trim() as Verdict;
      if (!VERDICTS.includes(verdict)) continue;
      const feedback = String(obj.feedback || "").trim().slice(0, 400);
      if (!feedback) continue;
      return { verdict, feedback };
    } catch { /* try next */ }
  }
  return null;
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "rsa-evaluate", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: {
    videoId?: string;
    rubricHint?: string;
    studentAnswer?: string;
    grade?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rubricHint = String(body.rubricHint || "").trim();
  const studentAnswer = String(body.studentAnswer || "").trim();
  const grade = typeof body.grade === "number" ? Math.round(body.grade) : undefined;

  if (!rubricHint)
    return Response.json({ ok: false, error: "rubricHint required" }, { status: 400 });

  if (!studentAnswer) {
    return Response.json({
      ok: true,
      verdict: "needs-work" as Verdict,
      feedback: "You haven't written anything yet — even a guess helps! What's one idea from the talk?",
      outcome: "incorrect" as TurnOutcome,
    });
  }

  const videoId = String(body.videoId || "video").trim();

  let agent: SDKAgent | null = null;
  try {
    agent = await Agent.create({
      apiKey: apiKey(),
      model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
      name: "RSA Evaluate",
      local: {
        cwd: path.join(process.cwd(), "tutor-workspace"),
        settingSources: [],
      },
    });

    let full = "";
    const prompt = evalPrompt({ videoId, rubricHint, studentAnswer, grade });
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
          )
            full = block.text;
        }
      }
    }

    const parsed = parse(full);
    if (!parsed) {
      const words = studentAnswer.split(/\s+/).filter(Boolean).length;
      const hasRubricTerms = rubricHint
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((w) => studentAnswer.toLowerCase().includes(w));
      const v: Verdict =
        words < 3 ? "needs-work" : hasRubricTerms ? "correct" : "partial";
      return Response.json({
        ok: true,
        verdict: v,
        feedback:
          v === "correct"
            ? "Strong answer! Can you add one more reason to support your view?"
            : v === "partial"
              ? "Good start! Try referencing one specific idea from the speaker."
              : "Give it another try — what's the main thing the speaker wanted you to understand?",
        fallback: true,
        outcome: VERDICT_TO_OUTCOME[v],
      });
    }

    return Response.json({
      ok: true,
      verdict: parsed.verdict,
      feedback: parsed.feedback,
      outcome: VERDICT_TO_OUTCOME[parsed.verdict],
    });
  } catch (err) {
    if (err instanceof CursorAgentError) {
      return Response.json({
        ok: true,
        verdict: "partial" as Verdict,
        feedback: "Nice effort! The coach is resting — but every answer helps you grow. Try another video!",
        fallback: true,
        degraded: true,
        outcome: "practice" as TurnOutcome,
      });
    }
    return Response.json({ ok: false, error: "Evaluation failed" }, { status: 500 });
  } finally {
    try { agent?.close(); } catch { /* ignore */ }
  }
}
