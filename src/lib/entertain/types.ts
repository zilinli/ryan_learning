export type GameId =
  | "chess"
  | "xiangqi"
  | "go"
  | "gomoku"
  | "uttt"
  | "blocks"
  | "snake"
  | "sudoku"
  | "sokoban"
  | "klotski";

export type GameCategory = "board" | "arcade" | "puzzle";

export interface GameMeta {
  id: GameId;
  title: string;
  titleZh: string;
  category: GameCategory;
  description: string;
  descriptionZh: string;
  /** Whether AI opponent is available */
  hasAi: boolean;
  /** Min players */
  players: 1 | 2;
  icon: string;
}

export type GameStatus =
  | "playing"
  | "white_win"
  | "black_win"
  | "red_win"
  | "black_xiangqi_win"
  | "draw"
  | "solved"
  | "stuck";

export interface AiMoveRequest {
  game: "chess" | "xiangqi" | "go";
  boardState: string;
  moveHistory: string;
  playerColor: string;
  /** Optional list of legal moves for validation + local fallback */
  legalMoves?: string[];
}

export interface AiMoveResponse {
  move: string;
  explanation?: string;
}
