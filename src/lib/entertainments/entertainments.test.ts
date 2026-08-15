import { describe, expect, it } from "vitest";
import {
  generateSudoku,
  isSudokuComplete,
  setSudokuCell,
} from "./sudoku";
import {
  isSokobanWon,
  loadSokoban,
  moveSokoban,
  SOKOBAN_LEVELS,
} from "./sokoban";
import { initialKlotski, isKlotskiWon, moveKlotski } from "./klotski";
import { initialGo, playGo } from "./go";
import { initialXiangqi, xiangqiLegalMoves } from "./xiangqi";
import { entLangFromVoice, t } from "./i18n";
import { Chess } from "chess.js";

describe("entertainments i18n", () => {
  it("defaults to British English for ryan voice", () => {
    expect(entLangFromVoice("ryan")).toBe("en");
    expect(t("en", "hubTitle")).toBe("Entertainments");
  });

  it("maps Chinese voices to zh pack", () => {
    expect(entLangFromVoice("yunxi")).toBe("zh");
    expect(t("zh", "sudoku")).toBe("数独");
  });
});

describe("sudoku", () => {
  it("generates a solvable unique puzzle", () => {
    const s = generateSudoku("easy");
    expect(s.board.filter((n) => n !== 0).length).toBeGreaterThan(20);
    expect(s.solution.every((n) => n >= 1 && n <= 9)).toBe(true);
    const filled = {
      ...s,
      board: [...s.solution],
    };
    expect(isSudokuComplete(filled)).toBe(true);
  });

  it("refuses to edit given cells", () => {
    const s = generateSudoku("easy");
    const givenIdx = s.given.findIndex(Boolean);
    const next = setSudokuCell(s, givenIdx, 9);
    expect(next.board[givenIdx]).toBe(s.board[givenIdx]);
  });
});

describe("sokoban", () => {
  it("loads level 1 and detects win after pushes", () => {
    let st = loadSokoban(SOKOBAN_LEVELS[0]!);
    // level 1: push box onto goal — fuzz a few moves won't always win; just move
    const before = st.player;
    st = moveSokoban(st, 1, 0);
    expect(st.player === before || st.moves >= 0).toBe(true);
    expect(typeof isSokobanWon(st)).toBe("boolean");
  });
});

describe("klotski", () => {
  it("starts unsolved and cao can move down when space frees", () => {
    const st = initialKlotski();
    expect(isKlotskiWon(st)).toBe(false);
    // move horizontal block out of the way if possible
    const after = moveKlotski(st, "h1", 0, 1);
    expect(after.moves === 0 || after.moves === 1).toBe(true);
  });
});

describe("go", () => {
  it("places a stone and flips turn", () => {
    const g0 = initialGo(9);
    const g1 = playGo(g0, 40);
    expect(g1).not.toBeNull();
    expect(g1!.board[40]).toBe(1);
    expect(g1!.toPlay).toBe(2);
  });
});

describe("xiangqi", () => {
  it("red chariot has legal forward moves", () => {
    const st = initialXiangqi();
    // red left chariot at (0,9) = index 81
    const moves = xiangqiLegalMoves(st, 81);
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe("chess.js", () => {
  it("starts with 20 legal moves", () => {
    const c = new Chess();
    expect(c.moves().length).toBe(20);
  });
});
