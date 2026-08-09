/**
 * Cursor SDK integration for game AI moves.
 * Creates a lightweight agent (no harness tools) to suggest the next best move.
 */

import { Agent } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "../default-api-key";

function requireApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!key) throw new Error("No Cursor API Key configured");
  process.env.CURSOR_API_KEY = key;
  return key;
}

interface GameAiOptions {
  game: "chess" | "xiangqi" | "go";
  boardDescription: string;
  playerColor: string;
  moveHistory: string;
  signal?: AbortSignal;
}

/**
 * Ask the Cursor SDK Agent for the best next move in a board game.
 * Returns the move string (algebraic notation for chess, Chinese notation for xiangqi,
 * coordinates for go).
 */
export async function getGameAiMove(options: GameAiOptions): Promise<{
  move: string;
  explanation: string;
}> {
  const apiKey = requireApiKey();

  const gameIntro: Record<string, string> = {
    chess: "You are a chess engine. The board uses standard algebraic notation (a1-h8).",
    xiangqi: "You are a Chinese Chess (象棋) engine. Red pieces are uppercase (R=車 N=馬 B=相 A=仕 K=帥 C=炮 P=兵), Black pieces are lowercase (r=車 n=馬 b=象 a=士 k=將 c=砲 p=卒).",
    go: "You are a Go (围棋) engine on a 9×9 board. Coordinates are like A1-H9, 1-9, etc.",
  };

  const formatInstruction: Record<string, string> = {
    chess: 'Reply with ONLY the move in standard algebraic notation (e.g., "Nf3", "e4", "O-O", "Qxd4"). Do NOT include any explanation.',
    xiangqi: 'Reply with ONLY the move in format "fromRow,fromCol-toRow,toCol" (0-indexed, top-left is 0,0). Example: "6,4-5,4". Do NOT include any explanation.',
    go: 'Reply with ONLY the move in format "row,col" (0-indexed, top-left is 0,0). Example: "4,4". If you want to pass, reply with "pass". Do NOT include any explanation.',
  };

  const prompt = `${gameIntro[options.game]}

You are playing as ${options.playerColor}. The current board state:

${options.boardDescription}

Move history:
${options.moveHistory || "(no moves yet)"}

${formatInstruction[options.game]}`;

  let agent: SDKAgent | null = null;

  try {
    agent = await Agent.create({
      apiKey,
      model: { id: process.env.CURSOR_MODEL?.trim() || "auto" },
      name: `${options.game}-ai`,
      local: {
        cwd: process.cwd(),
        settingSources: [],
      },
    });

    const run = await agent.send(prompt, {
      signal: options.signal,
    });

    let fullText = "";
    for await (const message of run.messages()) {
      if (message.role === "assistant" && message.content) {
        fullText += (typeof message.content === "string" ? message.content : "");
      }
    }

    // Parse the move from the response
    const move = extractMove(fullText.trim(), options.game);
    const explanation = fullText.trim().split("\n")[0] || "";

    return { move, explanation };
  } finally {
    try {
      agent?.close();
    } catch {
      // ignore
    }
  }
}

function extractMove(text: string, game: "chess" | "xiangqi" | "go"): string {
  // Strip markdown formatting
  const clean = text.replace(/```[\s\S]*?```/g, "").replace(/[*_`]/g, "").trim();

  if (game === "chess") {
    // Match standard algebraic notation
    const match = clean.match(
      /\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)\b/,
    );
    return match ? match[1] : clean.split("\n")[0]?.trim() || "";
  }

  if (game === "xiangqi") {
    const match = clean.match(/(\d+,\d+)[-–>]\s*(\d+,\d+)/);
    return match ? `${match[1]}-${match[2]}` : clean.split("\n")[0]?.trim() || "";
  }

  if (game === "go") {
    if (clean.toLowerCase().includes("pass")) return "pass";
    const match = clean.match(/(\d+)\s*[,;、/\s]\s*(\d+)/);
    return match ? `${match[1]},${match[2]}` : clean.split("\n")[0]?.trim() || "";
  }

  return clean;
}
