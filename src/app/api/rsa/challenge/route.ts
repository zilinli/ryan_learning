import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import { findRsaVideo } from "@/lib/entertain/rsa-catalog";
import {
  buildFallbackRsaChallenge,
  rsaChallengeSystemPrompt,
  parseRsaChallengeJson,
  type RsaChallengeLearner,
} from "@/lib/entertain/rsa-challenge";
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
  const limited = checkApiRateLimit(req, "rsa-challenge", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: { videoId?: string; learner?: RsaChallengeLearner } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const videoId = String(body.videoId || "").trim();
  if (!videoId)
    return Response.json({ ok: false, error: "Missing videoId" }, { status: 400 });

  const video = findRsaVideo(videoId);
  if (!video)
    return Response.json({ ok: false, error: "Video not found" }, { status: 404 });

  const learner = body.learner || null;

  const transcript = await fetchYouTubeTranscript(videoId);

  let challenge = buildFallbackRsaChallenge(video, transcript, learner);

  const forceFallback = process.env.RSA_CHALLENGE_FORCE_FALLBACK === "1";
  if (!forceFallback && transcript) {
    let agent: SDKAgent | null = null;
    try {
      agent = await Agent.create({
        apiKey: apiKey(),
        model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
        name: "RSA Challenge",
        local: {
          cwd: path.join(process.cwd(), "tutor-workspace"),
          settingSources: [],
        },
      });

      let full = "";
      const prompt = rsaChallengeSystemPrompt(video, transcript, learner);
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
          : 7;
      const level = challenge.level || "developing";
      const parsed = parseRsaChallengeJson(full, video, level, grade);
      if (parsed) challenge = parsed;
    } catch (err) {
      if (err instanceof CursorAgentError) {
        /* keep fallback */
      }
    } finally {
      try { agent?.close(); } catch { /* ignore */ }
    }
  }

  return Response.json({ ok: true, challenge });
}
