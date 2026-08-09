import { describe, expect, it } from "vitest";
import {
  getLegalGoMoves,
  initGo,
  passTurn,
  placeStone,
} from "./go-logic";

describe("Go engine", () => {
  it("G1: place black then white", () => {
    let s = initGo(9);
    s = placeStone(s, { row: 3, col: 3 });
    expect(s.board[3][3]).toBe("black");
    expect(s.turn).toBe("white");
    s = placeStone(s, { row: 3, col: 4 });
    expect(s.board[3][4]).toBe("white");
  });

  it("G2: capture single stone", () => {
    let s = initGo(9);
    // Surround white at (1,1) with black stones on (0,1)(1,0)(1,2)(2,1)
    s = placeStone(s, { row: 0, col: 1 }); // B
    s = placeStone(s, { row: 0, col: 0 }); // W filler
    s = placeStone(s, { row: 1, col: 0 }); // B
    s = placeStone(s, { row: 0, col: 2 }); // W filler
    s = placeStone(s, { row: 1, col: 2 }); // B
    s = placeStone(s, { row: 2, col: 0 }); // W filler
    s = placeStone(s, { row: 2, col: 1 }); // B
    s = placeStone(s, { row: 1, col: 1 }); // W — one liberty left? actually after B at 2,1 white at 1,1 has liberty?
    // Reset with a cleaner capture sequence
    s = initGo(9);
    // White stone at (0,0) corner — capture with black at (0,1) and (1,0)
    s = { ...s, turn: "white" };
    s = placeStone(s, { row: 0, col: 0 }); // W
    expect(s.board[0][0]).toBe("white");
    s = placeStone(s, { row: 0, col: 1 }); // B
    s = placeStone(s, { row: 2, col: 2 }); // W elsewhere
    s = placeStone(s, { row: 1, col: 0 }); // B captures
    expect(s.board[0][0]).toBeNull();
    expect(s.capturedWhite).toBe(1);
  });

  it("G3: suicide rejected", () => {
    let s = initGo(9);
    // Fill around (0,0) with white so black suicide
    s = { ...s, turn: "white" };
    s = placeStone(s, { row: 0, col: 1 });
    s = placeStone(s, { row: 5, col: 5 }); // B filler
    s = placeStone(s, { row: 1, col: 0 });
    // Now black to play at (0,0) would be suicide
    expect(s.turn).toBe("black");
    const before = s;
    const after = placeStone(s, { row: 0, col: 0 });
    expect(after).toBe(before);
    expect(after.board[0][0]).toBeNull();
  });

  it("G4: simple ko — immediate recapture rejected", () => {
    // Classic ko shape on 9×9
    // . B W .
    // B . B W
    // . B W .
    let s = initGo(9);
    const setup: Array<["black" | "white", number, number]> = [
      ["black", 1, 0],
      ["white", 1, 3],
      ["black", 0, 1],
      ["white", 0, 2],
      ["black", 2, 1],
      ["white", 2, 2],
      ["black", 1, 2],
      ["white", 5, 5], // filler
    ];
    for (const [color, r, c] of setup) {
      s = { ...s, turn: color };
      s = placeStone(s, { row: r, col: c });
    }
    // White captures at (1,1) taking black at (1,2)? Let's use a minimal known ko.
    // Simpler: place white at 2,2, blacks around, etc.
    // Use engine lastCaptured: after single capture, reverse capture of that point is ko.
    s = initGo(9);
    // Build: black stones at (1,0)(0,1)(1,2)(2,1); white at (1,1) captured by filling last liberty... 
    // Actually for ko: 
    //   positions where W captures B, then B cannot immediately recapture the W stone.
    s = initGo(5);
    // Board:
    //   . W B .
    //   W B . B
    //   . W B .
    const cells: Array<[number, number, "black" | "white"]> = [
      [0, 1, "white"],
      [0, 2, "black"],
      [1, 0, "white"],
      [1, 1, "black"],
      [1, 3, "black"],
      [2, 1, "white"],
      [2, 2, "black"],
    ];
    s = initGo(5);
    for (const [r, c, color] of cells) {
      s.board[r][c] = color;
    }
    s = { ...s, turn: "white", lastCaptured: null };
    // White plays (1,2) capturing black (1,1)
    s = placeStone(s, { row: 1, col: 2 });
    expect(s.board[1][1]).toBeNull();
    expect(s.board[1][2]).toBe("white");
    // Black tries to recapture at (1,1) — ko
    const before = s;
    const koAttempt = placeStone(s, { row: 1, col: 1 });
    expect(koAttempt).toBe(before);
  });

  it("G5: two passes → scoring", () => {
    let s = initGo(9);
    s = passTurn(s);
    expect(s.status).toBe("playing");
    s = passTurn(s);
    expect(s.status).toBe("scoring");
  });

  it("G6: legal moves exclude occupied", () => {
    let s = initGo(9);
    s = placeStone(s, { row: 4, col: 4 });
    const legal = getLegalGoMoves(s);
    expect(legal).not.toContain("4,4");
    expect(legal.length).toBeGreaterThan(50);
  });
});
