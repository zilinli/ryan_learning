export type GameId =
  | "chess"
  | "xiangqi"
  | "go"
  | "blocks"
  | "nitro-rush"
  | "sky-patrol"
  | "balloon-float"
  | "snake"
  | "sudoku"
  | "sokoban"
  | "klotski"
  | "ted-lab"
  | "writing-studio"
  | "natgeo-lab"
  | "bbc-lab"
  | "rsa-lab"
  | "creations"
  | "fraction-voyager"
  | "eco-genesis"
  | "time-vault"
  | "force-bay"
  | "energy-chain"
  | "orbit-scout";

export type GameCategory = "board" | "arcade" | "puzzle" | "studio";

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
