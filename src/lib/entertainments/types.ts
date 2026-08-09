export type EntLang = "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak";

export type GameId =
  | "sudoku"
  | "sokoban"
  | "klotski"
  | "chess"
  | "xiangqi"
  | "go";

export type GameMeta = {
  id: GameId;
  /** British English title (canonical) */
  titleEn: string;
  blurbEn: string;
};
