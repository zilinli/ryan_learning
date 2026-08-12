/**
 * POST /api/ted/challenge
 * Body: { slug, learner?: { age, grade, gradeBand, englishLevel } }
 * Builds listening challenge matched to learner difficulty (+ optional LLM polish).
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { findTedTalk, parseTedSlug, type TedTalk } from "@/lib/entertain/ted-catalog";
import { fetchTedTranscript } from "@/lib/entertain/ted-transcript";
import { canAffordChallengeAgent } from "@/lib/entertain/challenge-agent-guard";
import {
  buildFallbackChallenge,
  challengeSystemPrompt,
  parseChallengeJson,
  normalizeLearnerGrade,
  resolveTedChallengeLevel,
  type TedChallengeLearner,
} from "@/lib/entertain/ted-challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

function talkOrStub(slug: string): TedTalk {
  return (
    findTedTalk(slug) || {
      slug,
      title: slug.replace(/_/g, " "),
      speaker: "TED speaker",
      durationSec: 0,
      topics: ["ideas"],
      blurb: "A TED talk",
    }
  );
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "ted-challenge", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: { slug?: string; learner?: TedChallengeLearner } = {};
  try {
    body = (await req.json()) as {
      slug?: string;
      learner?: TedChallengeLearner;
    };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = parseTedSlug(body.slug || "");
  if (!slug) {
    return Response.json({ ok: false, error: "Invalid slug" }, { status: 400 });
  }

  try {
    const learner = body.learner || null;
    const level = resolveTedChallengeLevel(learner);
    const talk = talkOrStub(slug);
    const { text } = await fetchTedTranscript(slug);
    let challenge = buildFallbackChallenge(talk, text, learner);

    const forceFallback =
      process.env.TED_CHALLENGE_FORCE_FALLBACK === "1" ||
      process.env.TED_CHALLENGE_FORCE_FALLBACK === "true";

    const polish =
      !forceFallback && text.length > 400 && canAffordChallengeAgent();

    if (polish) {
      let agent: SDKAgent | null = null;
      try {
        agent = await Agent.create({
          apiKey: apiKey(),
          model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
          name: "TED Challenge",
          local: {
            cwd: path.join(process.cwd(), "tutor-workspace"),
            settingSources: [],
          },
        });

        let full = "";
        const prompt = [
          challengeSystemPrompt(talk, learner),
          "",
          "Ground every question in this transcript. Prefer concrete claims from the talk.",
          "Transcript excerpt (for crafting questions — do not quote huge blocks):",
          text.slice(0, 6000),
        ].join("\n");

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

        const parsed = parseChallengeJson(
          full,
          talk,
          level,
          normalizeLearnerGrade(learner?.grade),
        );
        if (parsed) challenge = parsed;
      } catch (err) {
        if (!(err instanceof CursorAgentError)) {
          console.warn("[ted/challenge] agent polish failed:", err);
        }
      } finally {
        try {
          agent?.close();
        } catch {
          /* ignore */
        }
      }
    }

    return Response.json({ ok: true, challenge });
  } catch (err) {
    console.error("[ted/challenge]", err);
    return Response.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not build challenge",
      },
      { status: 500 },
    );
  }
}
