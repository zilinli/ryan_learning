import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  buildFallbackBbcChallenge,
  bbcChallengeSystemPrompt,
  parseBbcChallengeJson,
  type BbcChallengeLearner,
} from "@/lib/entertain/bbc-challenge";
import { resolveBbcClip } from "@/lib/entertain/bbc-clip-resolve";
import { canAffordChallengeAgent } from "@/lib/entertain/challenge-agent-guard";
import { fetchYouTubeTranscript } from "@/lib/youtube-transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function apiKey(): string {
  const k = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!k) throw new Error("Cursor API Key not configured.");
  process.env.CURSOR_API_KEY = k;
  return k;
}

export async function POST(req: Request) {
  const limited = checkApiRateLimit(req, "bbc-challenge", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: {
    videoId?: string;
    clip?: unknown;
    learner?: BbcChallengeLearner;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const videoId = String(body.videoId || "").trim();
  if (!videoId)
    return Response.json({ ok: false, error: "Missing videoId" }, { status: 400 });

  const clip = resolveBbcClip(videoId, body.clip);
  if (!clip)
    return Response.json({ ok: false, error: "Clip not found" }, { status: 404 });

  try {
    const learner = body.learner || undefined;

    // Prefer English YouTube CC (manual + auto) before blurb-only generation.
    const transcript = await fetchYouTubeTranscript(videoId);
    if (!transcript || transcript.text.length < 80) {
      return Response.json(
        {
          ok: false,
          error:
            "No usable English captions (CC) for this video. Pick another clip with subtitles.",
        },
        { status: 422 },
      );
    }
    let challenge = buildFallbackBbcChallenge(clip, transcript, learner);

    const forceFallback =
      process.env.BBC_CHALLENGE_FORCE_FALLBACK === "1" ||
      process.env.BBC_CHALLENGE_FORCE_FALLBACK === "true";
    const polish =
      !forceFallback && Boolean(transcript) && canAffordChallengeAgent();

    if (polish) {
      let agent: SDKAgent | null = null;
      try {
        agent = await Agent.create({
          apiKey: apiKey(),
          model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
          name: "BBC Challenge",
          local: {
            cwd: path.join(process.cwd(), "tutor-workspace"),
            settingSources: [],
          },
        });

        let full = "";
        const prompt = bbcChallengeSystemPrompt(clip, transcript!, learner);
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

        const grade =
          typeof learner?.grade === "number" && Number.isFinite(learner.grade)
            ? Math.round(learner.grade)
            : 4;
        const level = challenge.level || "developing";
        const parsed = parseBbcChallengeJson(full, clip, level, grade);
        if (parsed) challenge = parsed;
      } catch (err) {
        if (!(err instanceof CursorAgentError)) {
          console.warn("[bbc/challenge] agent polish failed:", err);
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
    console.error("[bbc/challenge]", err);
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
