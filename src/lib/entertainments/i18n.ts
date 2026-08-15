import type { EntLang, GameId } from "./types";
import { replyLangFromVoice, type TutorVoiceId } from "@/lib/voices";

/** Map tutor voice → entertainments UI language (default British English). */
export function entLangFromVoice(voiceId?: string): EntLang {
  const mode = replyLangFromVoice(voiceId as TutorVoiceId | undefined);
  if (
    mode === "zh" ||
    mode === "yue" ||
    mode === "es" ||
    mode === "fr" ||
    mode === "teo" ||
    mode === "hak"
  ) {
    return mode;
  }
  return "en";
}

type Dict = Record<string, string>;

const EN: Dict = {
  hubTitle: "Entertainments",
  hubSub: "Puzzles & board games · British English by default",
  back: "Back",
  close: "Close",
  newGame: "New",
  undo: "Undo",
  reset: "Reset",
  youWin: "Well done — you won!",
  turn: "Turn",
  moves: "Moves",
  level: "Level",
  check: "Check",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  vsCpu: "vs Computer",
  vsHuman: "Two players",
  sudoku: "Sudoku",
  sudokuBlurb: "Fill 1–9 so every row, column and box is unique.",
  sokoban: "Sokoban",
  sokobanBlurb: "Push each crate onto a target square.",
  klotski: "Klotski",
  klotskiBlurb: "Slide blocks so the big piece escapes.",
  chess: "Chess",
  chessBlurb: "Classic international chess on an 8×8 board.",
  xiangqi: "Xiangqi",
  xiangqiBlurb: "Chinese chess — generals, chariots and cannons.",
  go: "Go (9×9)",
  goBlurb: "Capture by surrounding — a friendly teaching board.",
};

const ZH: Dict = {
  ...EN,
  hubTitle: "益智游戏",
  hubSub: "谜题与棋类 · 界面语言跟随语音设置",
  back: "返回",
  close: "关闭",
  newGame: "新局",
  undo: "撤销",
  reset: "重置",
  youWin: "太棒了，过关！",
  turn: "轮到",
  moves: "步数",
  level: "关卡",
  check: "检查",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  vsCpu: "人机",
  vsHuman: "双人",
  sudoku: "数独",
  sudokuBlurb: "每行、每列、每宫填满 1–9 且不重复。",
  sokoban: "推箱子",
  sokobanBlurb: "把箱子推到目标点上。",
  klotski: "华容道",
  klotskiBlurb: "滑动方块，让最大块逃出。",
  chess: "国际象棋",
  chessBlurb: "经典 8×8 国际象棋。",
  xiangqi: "中国象棋",
  xiangqiBlurb: "将帅车马炮，楚河汉界。",
  go: "围棋（9路）",
  goBlurb: "气尽提子 · 适合入门的小棋盘。",
};

const ES: Dict = {
  ...EN,
  hubTitle: "Entretenimientos",
  hubSub: "Puzles y juegos de mesa",
  back: "Volver",
  close: "Cerrar",
  newGame: "Nueva",
  undo: "Deshacer",
  reset: "Reiniciar",
  youWin: "¡Bien hecho!",
  turn: "Turno",
  moves: "Movimientos",
  level: "Nivel",
  check: "Comprobar",
  easy: "Fácil",
  medium: "Medio",
  hard: "Difícil",
  vsCpu: "vs Ordenador",
  vsHuman: "Dos jugadores",
  sudoku: "Sudoku",
  sudokuBlurb: "Rellena 1–9 sin repetir en fila, columna o caja.",
  sokoban: "Sokoban",
  sokobanBlurb: "Empuja las cajas a los objetivos.",
  klotski: "Klotski",
  klotskiBlurb: "Desliza bloques para liberar la pieza grande.",
  chess: "Ajedrez",
  chessBlurb: "Ajedrez internacional clásico.",
  xiangqi: "Ajedrez chino",
  xiangqiBlurb: "Xiangqi — generales, carros y cañones.",
  go: "Go (9×9)",
  goBlurb: "Captura rodeando — tablero para aprender.",
};

const FR: Dict = {
  ...EN,
  hubTitle: "Divertissements",
  hubSub: "Puzzles et jeux de plateau",
  back: "Retour",
  close: "Fermer",
  newGame: "Nouvelle",
  undo: "Annuler",
  reset: "Réinitialiser",
  youWin: "Bravo — gagné !",
  turn: "Tour",
  moves: "Coups",
  level: "Niveau",
  check: "Vérifier",
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
  vsCpu: "vs Ordinateur",
  vsHuman: "Deux joueurs",
  sudoku: "Sudoku",
  sudokuBlurb: "Remplis 1–9 sans doublon ligne/colonne/carré.",
  sokoban: "Sokoban",
  sokobanBlurb: "Pousse les caisses sur les cibles.",
  klotski: "Klotski",
  klotskiBlurb: "Fais glisser pour libérer la grande pièce.",
  chess: "Échecs",
  chessBlurb: "Échecs internationaux classiques.",
  xiangqi: "Échecs chinois",
  xiangqiBlurb: "Xiangqi — généraux, chars et canons.",
  go: "Go (9×9)",
  goBlurb: "Capture par encerclement — plateau d'apprentissage.",
};

function pack(lang: EntLang): Dict {
  if (lang === "es") return ES;
  if (lang === "fr") return FR;
  if (lang === "zh" || lang === "yue" || lang === "teo" || lang === "hak") {
    return ZH;
  }
  return EN;
}

export function t(lang: EntLang, key: string): string {
  const d = pack(lang);
  return d[key] ?? EN[key] ?? key;
}

export function gameTitle(lang: EntLang, id: GameId): string {
  return t(lang, id);
}

export function gameBlurb(lang: EntLang, id: GameId): string {
  return t(lang, `${id}Blurb`);
}
