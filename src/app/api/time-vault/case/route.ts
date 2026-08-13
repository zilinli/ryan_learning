/**
 * POST /api/time-vault/case
 * Body: { learner?: { grade, englishLevel } }
 * Returns an AI-generated Time Vault case (with static fallback).
 */

import path from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "@/lib/default-api-key";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";
import {
  caseSpecForDifficulty,
  difficultyFromPKnown,
  parseTimeVaultJson,
  pickFallbackCase,
  timeVaultSystemPrompt,
  type TimeVaultCase,
  type TimeVaultLearner,
} from "@/lib/entertain/time-vault";

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
  const limited = checkApiRateLimit(req, "time-vault", RATE_PRESETS.agent);
  if (limited) return limited;

  let body: { learner?: TimeVaultLearner & { readingEvidencePKnown?: number } } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const fallback = pickFallbackCase();
    const learner = body.learner || null;

    // ZPD: derive difficulty from BKT pKnown if provided, else learner grade.
    let difficulty = fallback.difficulty;
    if (typeof learner?.readingEvidencePKnown === "number") {
      difficulty = difficultyFromPKnown(learner.readingEvidencePKnown);
    } else if (learner) {
      const grade = typeof learner.grade === "number" ? learner.grade : 4;
      difficulty = Math.max(1, Math.min(5, Math.round((grade - 1) / 2) + 1));
    }

    const spec = caseSpecForDifficulty(difficulty);
    let vaultCase: TimeVaultCase = { ...fallback, difficulty };

    const forceFallback =
      process.env.TIME_VAULT_FORCE_FALLBACK === "1" ||
      process.env.TIME_VAULT_FORCE_FALLBACK === "true";

    if (!forceFallback) {
      let agent: SDKAgent | null = null;
      try {
        agent = await Agent.create({
          apiKey: apiKey(),
          model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
          name: "Time Vault",
          local: {
            cwd: path.join(process.cwd(), "tutor-workspace"),
            settingSources: [],
          },
        });

        let full = "";
        const prompt = timeVaultSystemPrompt(spec, learner || undefined);

        // Hard cap on agent generation so the endpoint always returns in time.
        const generate = (async () => {
          const run = await agent!.send(
            { text: prompt },
            {
              onDelta: ({ update }) => {
                if (update.type === "text-delta" && update.text)
                  full += update.text;
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
          return full;
        })();

        full = await Promise.race([
          generate,
          new Promise<string>((_, reject) =>
            setTimeout(
              () => reject(new Error("timeout: agent generation too slow")),
              20_000,
            ),
          ),
        ]);

        const parsed = parseTimeVaultJson(full, { ...fallback, difficulty });
        if (parsed) vaultCase = parsed;
      } catch (err) {
        if (!(err instanceof CursorAgentError)) {
          console.warn("[time-vault/case] agent generation failed:", err);
        }
      } finally {
        try {
          agent?.close();
        } catch {
          /* ignore */
        }
      }
    }

    return Response.json({ ok: true, case: vaultCase, source: "ai" });
  } catch (err) {
    console.error("[time-vault/case]", err);
    return Response.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not generate case",
      },
      { status: 500 },
    );
  }
}
