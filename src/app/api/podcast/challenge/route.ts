/**
 * POST /api/podcast/challenge
 * Body: { show, episode, learner? }
 *
 * Requires the episode transcript to already be ready (cache written by
 * /api/podcast/transcribe). Builds a TED-parity hybrid challenge (MCQ + essay)
 * with optional Cursor Agent polish, exactly like /api/ted/challenge.
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { findPodcastShow } from "@/lib/entertain/podcast-catalog";
import type { PodcastEpisode } from "@/lib/entertain/podcast-rss";
import { readTranscriptCache } from "@/lib/entertain/podcast-transcript";
import {
  buildPodcastChallenge,
  episodeToTalk,
  podcastChallengeSystemPrompt,
} from "@/lib/entertain/podcast-challenge";
import { canAffordChallengeAgent } from "@/lib/entertain/challenge-agent-guard";
import {
  parseChallengeJson,
  normalizeLearnerGrade,
  resolveTedChallengeLevel,
  type TedChallenge,
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

function sanitizeEpisode(raw: unknown): PodcastEpisode | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const guid = String(e.guid || "").trim();
  const title = String(e.title || "").trim();
  const audioUrl = String(e.audioUrl || "").trim();
  if (!guid || !audioUrl) return null;
  return {
    guid: guid.slice(0, 240),
    title: title || guid,
    description: String(e.description || "").slice(0, 1200),
    audioUrl,
    durationSec: Number(e.durationSec) || 0,
    pubDate: String(e.pubDate || ""),
    categories: Array.isArray(e.categories)
      ? e.categories.map((c) => String(c).slice(0, 80)).filter(Boolean).slice(0, 12)
      : [],
  };
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "podcast-challenge", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: { show?: unknown; episode?: unknown; learner?: TedChallengeLearner } = {};
  try {
    body = (await req.json()) as {
      show?: unknown;
      episode?: unknown;
      learner?: TedChallengeLearner;
    };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const show = findPodcastShow((body.show as { id?: string } | null | undefined)?.id);
  const episode = sanitizeEpisode(body.episode);
  if (!show || !episode) {
    return Response.json(
      { ok: false, error: "showId or episode missing" },
      { status: 400 },
    );
  }

  try {
    const learner = body.learner || null;
    const transcript = await readTranscriptCache(show.id, episode.guid);
    if (!transcript) {
      return Response.json(
        {
          ok: false,
          status: "transcript_pending",
          error: "Transcript is still being built — try again in a moment.",
        },
        { status: 409 },
      );
    }

    let challenge = buildPodcastChallenge(show, episode, transcript, learner);

    const forceFallback =
      process.env.PODCAST_CHALLENGE_FORCE_FALLBACK === "1" ||
      process.env.PODCAST_CHALLENGE_FORCE_FALLBACK === "true";

    const polish =
      !forceFallback && transcript.length > 400 && canAffordChallengeAgent();

    if (polish) {
      let agent: SDKAgent | null = null;
      try {
        agent = await Agent.create({
          apiKey: apiKey(),
          model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
          name: "Podcast Challenge",
          local: {
            cwd: path.join(process.cwd(), "tutor-workspace"),
            settingSources: [],
          },
        });

        const talk = episodeToTalk(show, episode);
        let full = "";
        const prompt = [
          podcastChallengeSystemPrompt(show, episode, learner),
          "",
          "Ground every question in concrete claims from this transcript.",
          "Transcript excerpt (for crafting questions — do not quote huge blocks):",
          transcript.slice(0, 6000),
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
              if (block.type === "text" && block.text && block.text.length > full.length) {
                full = block.text;
              }
            }
          }
        }

        const parsed = parseChallengeJson(
          full,
          talk,
          resolveTedChallengeLevel(learner),
          normalizeLearnerGrade(learner?.grade),
        );
        if (parsed) challenge = parsed;
      } catch (err) {
        if (!(err instanceof CursorAgentError)) {
          console.warn("[podcast/challenge] agent polish failed:", err);
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
    console.error("[podcast/challenge]", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Could not build challenge",
      },
      { status: 500 },
    );
  }
}

export type PodcastChallenge = TedChallenge;
