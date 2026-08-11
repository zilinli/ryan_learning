import { NextRequest, NextResponse } from "next/server";
import { getGameAiMove } from "@/lib/entertain/game-ai";
import type { AiMoveRequest, AiMoveResponse } from "@/lib/entertain/types";
import { checkApiRateLimit, RATE_PRESETS } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const limited = checkApiRateLimit(request, "entertain-ai", RATE_PRESETS.entertain);
  if (limited) return limited;

  try {
    const body = (await request.json()) as AiMoveRequest & {
      legalMoves?: string[];
    };

    if (!body.game || !["chess", "xiangqi", "go"].includes(body.game)) {
      return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
    }

    const { move, explanation } = await getGameAiMove({
      game: body.game,
      boardDescription: body.boardState,
      playerColor: body.playerColor,
      moveHistory: body.moveHistory,
      legalMoves: body.legalMoves,
      signal: request.signal,
    });

    if (!move) {
      return NextResponse.json({ error: "AI returned empty move" }, { status: 502 });
    }

    const response: AiMoveResponse = { move, explanation };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI move failed";
    console.error("[Entertain AI]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
