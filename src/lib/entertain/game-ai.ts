/**
 * Cursor SDK + local heuristic fallback for board-game AI moves.
 */

import { Agent } from "@cursor/sdk";
import type { SDKAgent } from "@cursor/sdk";
import { DEFAULT_CURSOR_API_KEY } from "../default-api-key";

function requireApiKey(): string {
  const key =
    process.env.CURSOR_API_KEY?.trim() || DEFAULT_CURSOR_API_KEY.trim();
  if (!key) throw new Error("No Cursor API Key configured");
  process.env.CURSOR_API_KEY = key;
  return key;
}

interface GameAiOptions {
  game: "chess" | "xiangqi" | "go";
  boardDescription: string;
  playerColor: string;
  moveHistory: string;
  /** Candidate legal moves — used for validation and local fallback */
  legalMoves?: string[];
  signal?: AbortSignal;
}

/**
 * Ask Cursor SDK for a move; fall back to local heuristic if SDK fails.
 */
export async function getGameAiMove(options: GameAiOptions): Promise<{
  move: string;
  explanation: string;
}> {
  const legal = options.legalMoves?.filter(Boolean) ?? [];

  try {
    const result = await askCursorAgent(options);
    if (result.move) {
      // Prefer a legal move if we have candidates
      if (legal.length === 0 || legal.includes(result.move)) {
        return result;
      }
      // Try to fuzzy-match
      const fuzzy = legal.find(
        (m) =>
          m.toLowerCase() === result.move.toLowerCase() ||
          m.replace(/[-–>]/g, "") === result.move.replace(/[-–>]/g, ""),
      );
      if (fuzzy) return { move: fuzzy, explanation: result.explanation };
    }
  } catch (err) {
    console.warn(
      "[Entertain AI] Cursor SDK failed, using local fallback:",
      err instanceof Error ? err.message : err,
    );
  }

  // Local heuristic fallback
  if (legal.length > 0) {
    const move = pickHeuristicMove(options.game, legal, options.boardDescription);
    return { move, explanation: "local heuristic" };
  }

  throw new Error("No legal moves available for AI");
}

async function askCursorAgent(options: GameAiOptions): Promise<{
  move: string;
  explanation: string;
}> {
  const apiKey = requireApiKey();

  const gameIntro: Record<string, string> = {
    chess:
      "You are a chess engine. Reply with ONE move in standard algebraic notation.",
    xiangqi:
      'You are a Chinese Chess (象棋) engine. Reply with ONE move as "fromRow,fromCol-toRow,toCol" (0-indexed, top-left is 0,0).',
    go: 'You are a Go (围棋) engine on a 9×9 board. Reply with ONE move as "row,col" (0-indexed) or "pass".',
  };

  const legalHint =
    options.legalMoves && options.legalMoves.length > 0
      ? `\nLegal moves (pick exactly one):\n${options.legalMoves.slice(0, 40).join(", ")}`
      : "";

  const prompt = `${gameIntro[options.game]}

You play as ${options.playerColor}.

Board:
${options.boardDescription}

History: ${options.moveHistory || "(none)"}${legalHint}

Reply with ONLY the move, nothing else.`;

  let agent: SDKAgent | null = null;
  let fullText = "";

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
      onDelta: ({ update }) => {
        if (update.type === "text-delta" && update.text) {
          fullText += update.text;
        }
      },
    });

    // Correct SDK API: run.stream() not run.messages()
    for await (const event of run.stream()) {
      if (options.signal?.aborted) break;
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            if (block.text.length > fullText.length && block.text.startsWith(fullText)) {
              fullText = block.text;
            } else if (!fullText) {
              fullText = block.text;
            }
          }
        }
      }
    }

    await run.wait().catch(() => {});

    const move = extractMove(fullText.trim(), options.game);
    return { move, explanation: fullText.trim().slice(0, 120) };
  } finally {
    try {
      agent?.close();
    } catch {
      // ignore
    }
  }
}

/** Exported for unit tests. */
export function extractMove(text: string, game: "chess" | "xiangqi" | "go"): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`]/g, "")
    .trim();

  if (game === "chess") {
    const match = clean.match(
      /\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)\b/,
    );
    return match ? match[1] : clean.split(/\s|\n/)[0]?.trim() || "";
  }

  if (game === "xiangqi") {
    const match = clean.match(/(\d+)\s*,\s*(\d+)\s*[-–>]\s*(\d+)\s*,\s*(\d+)/);
    return match
      ? `${match[1]},${match[2]}-${match[3]},${match[4]}`
      : clean.split(/\s|\n/)[0]?.trim() || "";
  }

  if (game === "go") {
    if (/\bpass\b/i.test(clean)) return "pass";
    const match = clean.match(/(\d+)\s*[,;、/\s]\s*(\d+)/);
    return match ? `${match[1]},${match[2]}` : clean.split(/\s|\n/)[0]?.trim() || "";
  }

  return clean;
}

/**
 * Simple local AI: prefer captures / center / random among legal moves.
 * Good enough for casual play when Cursor SDK is unavailable.
 */
/** Exported for unit tests. Local AI when Cursor SDK unavailable. */
export function pickHeuristicMove(
  game: "chess" | "xiangqi" | "go",
  legal: string[],
  _board?: string,
): string {
  if (game === "chess") {
    // Prefer captures (contain 'x'), then checks (+), else random
    const captures = legal.filter((m) => m.includes("x"));
    if (captures.length) return captures[Math.floor(Math.random() * captures.length)];
    const checks = legal.filter((m) => m.includes("+") || m.includes("#"));
    if (checks.length) return checks[Math.floor(Math.random() * checks.length)];
    return legal[Math.floor(Math.random() * legal.length)];
  }

  if (game === "xiangqi") {
    // Prefer moves that land on an occupied square (capture) if we can detect from board
    const scored = legal.map((m) => {
      const parts = m.split("-");
      const to = parts[1]?.split(",").map(Number);
      let score = Math.random();
      if (to?.length === 2) {
        // Prefer center files
        score += 1 - Math.abs(to[1] - 4) * 0.1;
        // Prefer advancing (lower row number for black)
        score += (9 - to[0]) * 0.02;
      }
      return { m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].m;
  }

  if (game === "go") {
    // Prefer center / near existing stones
    const scored = legal.map((m) => {
      if (m === "pass") return { m, score: -1 };
      const [r, c] = m.split(",").map(Number);
      const centerDist = Math.abs(r - 4) + Math.abs(c - 4);
      return { m, score: 10 - centerDist + Math.random() };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].m;
  }

  return legal[Math.floor(Math.random() * legal.length)];
}
