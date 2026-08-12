/**
 * POST /api/natgeo/challenge
 * Body: { slug, learner?: { age, grade, englishLevel } }
 * Returns a reading-comprehension challenge for the given article.
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { fetchNatGeoArticle } from "@/lib/entertain/natgeo-scrape";
import {
  buildFallbackNatGeoChallenge,
  natgeoChallengeSystemPrompt,
  parseNatGeoChallengeJson,
  type NatGeoChallengeLearner,
} from "@/lib/entertain/natgeo-challenge";
import { findNatGeoArticle, type NatGeoArticle } from "@/lib/entertain/natgeo-catalog";
import { canAffordChallengeAgent } from "@/lib/entertain/challenge-agent-guard";
import { fetchYouTubeTranscript } from "@/lib/youtube-transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key is not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "natgeo-challenge", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: { slug?: string; learner?: NatGeoChallengeLearner } = {};
  try {
    body = (await req.json()) as {
      slug?: string;
      learner?: NatGeoChallengeLearner;
    };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();
  if (!slug) {
    return Response.json({ ok: false, error: "Missing slug" }, { status: 400 });
  }

  try {
    // Try catalog first, then live scrape
    let article = findNatGeoArticle(slug);
    if (!article) {
      article = await fetchNatGeoArticle(slug);
    }

    if (!article) {
      return Response.json(
        { ok: false, error: "Article not found" },
        { status: 404 },
      );
    }

    const learner = body.learner || null;

    // Prefer English YouTube CC first (TED-style), then article as secondary.
    let sourceArticle: NatGeoArticle = article;
    if (article.videoId) {
      const yt = await fetchYouTubeTranscript(article.videoId);
      if (yt?.text && yt.text.length >= 80) {
        sourceArticle = {
          ...article,
          body: [
            "Primary source — English video captions (YouTube CC):",
            yt.text.slice(0, 10_000),
            "",
            "Secondary — article text:",
            article.body,
          ]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 12_000),
        };
      }
    }

    let challenge = buildFallbackNatGeoChallenge(sourceArticle, learner);

    const forceFallback =
      process.env.NATGEO_CHALLENGE_FORCE_FALLBACK === "1" ||
      process.env.NATGEO_CHALLENGE_FORCE_FALLBACK === "true";

    const polish =
      !forceFallback &&
      sourceArticle.body.length > 400 &&
      canAffordChallengeAgent();

    if (polish) {
      let agent: SDKAgent | null = null;
      try {
        agent = await Agent.create({
          apiKey: apiKey(),
          model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
          name: "NatGeo Challenge",
          local: {
            cwd: path.join(process.cwd(), "tutor-workspace"),
            settingSources: [],
          },
        });

        let full = "";
        const prompt = natgeoChallengeSystemPrompt(sourceArticle, learner);
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

        const grade =
          typeof learner?.grade === "number" && Number.isFinite(learner.grade)
            ? Math.round(learner.grade)
            : 4;
        const level = challenge.level || "developing";
        const parsed = parseNatGeoChallengeJson(full, article, level, grade);
        if (parsed) challenge = parsed;
      } catch (err) {
        if (!(err instanceof CursorAgentError)) {
          console.warn("[natgeo/challenge] agent polish failed:", err);
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
    console.error("[natgeo/challenge]", err);
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
