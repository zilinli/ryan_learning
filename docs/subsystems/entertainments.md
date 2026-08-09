# Entertainments · Engine Design & Test Plan

> Version 0.2 · 2026-08-09  
> Scope: `/entertain` page — Chess / Xiangqi / Go / Sudoku / Sokoban / Klotski + AI

---

## 1. Open-Source Research Summary

| Game | Reference | UI pattern | Test pattern |
|------|-----------|------------|--------------|
| Chess | [jhlywa/chess.js](https://github.com/jhlywa/chess.js) + Lichess Chessground | Logic ≠ UI; FEN + SAN; Vitest `__tests__/moves.test.ts` | `moves()`, `move()`, checkmate fixtures |
| Xiangqi | [lengyanyu258/xiangqi.js](https://github.com/lengyanyu258/xiangqi.js) + [xiangqiground](https://github.com/west-shell/xiangqiground) | Pieces on **intersections**; SVG grid + river + palace X | Legal-move gen + check/checkmate |
| Go | [SabakiHQ/go-board](https://github.com/SabakiHQ/go-board) | `analyzeMove` → suicide / ko / capturing | Capture count, ko, suicide reject |
| Sudoku | sudokukit / Omarmahmoud711 solver | Pure-TS generator; unique-solution check | Count solutions ≤1 after dig |
| Sokoban | ecyrbe/sokoban | Undo stack; level ASCII | Push / blocked / win |
| Klotski | CoderLim/klotski-solver | Drag pieces; Cao Cao exit | Collision + win at exit |
| AI | Cursor SDK (`run.stream()` + `onDelta`) | Legal-move list in prompt; local heuristic fallback | Parse move; fallback ∈ legal |

### Key bugs found in v1 (before this plan)

1. **AI 500**: used `run.messages()` — not in Cursor SDK; correct API is `run.stream()` / `onDelta` (same as tutor chat).
2. **Xiangqi grid missing**: CSS cell-grid, no SVG lines/river/palace; pieces not on intersections.
3. **No engine unit tests** after rewrite → regressions uncaught.

---

## 2. Architecture

```
src/lib/entertain/          ← pure logic (no React) — UNIT TESTED
  chess: chess.js (npm)
  xiangqi.ts / go-logic.ts / sudoku.ts / sokoban.ts / klotski.ts
  game-ai.ts                ← SDK + extractMove + heuristic fallback

src/components/*Game.tsx    ← UI only; calls lib + /api/entertain-ai
src/app/api/entertain-ai/   ← thin POST wrapper
```

**AI contract**

```
POST { game, boardState, moveHistory, playerColor, legalMoves[] }
→ { move, explanation }
```

If Cursor SDK fails → `pickHeuristicMove(game, legalMoves)` must return ∈ `legalMoves`.

---

## 3. Test Plan (Vitest, node env)

### 3.1 Chess (`chess-engine.test.ts`) — via chess.js

| ID | Case |
|----|------|
| C1 | Start position has 20 legal moves |
| C2 | `e4` then `e5` updates FEN |
| C3 | Scholar's mate ends in checkmate |
| C4 | Illegal move throws |

### 3.2 Xiangqi (`xiangqi.test.ts`)

| ID | Case |
|----|------|
| X1 | Initial board: red/black kings + 5 pawns each side |
| X2 | Red chariot from a0-equivalent can move along file |
| X3 | Horse blocked by 蹩马腿 cannot jump |
| X4 | Elephant cannot cross river |
| X5 | Advisor stays in palace |
| X6 | `getAllLegalMoveStrings(red)` non-empty at start |
| X7 | Moving into check is illegal |
| X8 | Select + move updates turn to black |

### 3.3 Go (`go-logic.test.ts`)

| ID | Case |
|----|------|
| G1 | Empty board place black then white |
| G2 | Capture single stone (liberty=0) |
| G3 | Suicide rejected |
| G4 | Simple ko: recapture same point rejected |
| G5 | Two passes → scoring |
| G6 | `getLegalGoMoves` excludes occupied |

### 3.4 Sudoku (`sudoku.test.ts`)

| ID | Case |
|----|------|
| S1 | Generated solution is full 1–9 valid |
| S2 | Puzzle cells ⊆ solution; empties match difficulty band |
| S3 | `isSolved` true only when board == solution |
| S4 | Conflict detection finds duplicate in row |

### 3.5 Sokoban (`sokoban.test.ts`)

| ID | Case |
|----|------|
| K1 | Level 0 loads with player |
| K2 | Walk into wall = no-op |
| K3 | Push box onto target |
| K4 | Undo restores prior grid |
| K5 | Level count ≥ 5 |

### 3.6 Klotski (`klotski.test.ts`)

| ID | Case |
|----|------|
| L1 | Init has Cao Cao at (0,1) size 2×2 |
| L2 | Illegal overlap rejected |
| L3 | Legal slide increases moveCount |
| L4 | Undo works |
| L5 | Win when Cao Cao at exit (3,1) |

### 3.7 Game AI (`game-ai.test.ts`)

| ID | Case |
|----|------|
| A1 | `extractMove` chess SAN |
| A2 | `extractMove` xiangqi `r,c-r,c` |
| A3 | `extractMove` go `r,c` / pass |
| A4 | Heuristic always returns member of legalMoves |
| A5 | Chess heuristic prefers captures when present |

### Self-verify gate

```bash
npm test -- src/lib/entertain
# All entertain tests PASS before deploy
```

---

## 4. UI fixes (driven by research)

- **Xiangqi**: SVG board (9×10 intersections, river 楚河漢界, palace diagonals, star marks); pieces absolute on intersections.
- **Go**: Explicit SVG grid lines + star points (already partially done; verify).
- **Chess**: Keep Unicode on alternating squares (chess.js validated).
- **AI**: Fix stream API + always send `legalMoves` + client-side random-legal fallback if HTTP fails.

---

## 5. Delivery checklist

- [ ] Design doc (this file)
- [ ] Engine unit tests green
- [ ] AI parse/heuristic tests green
- [ ] Xiangqi SVG grid shipped
- [ ] Chess/Go/Xiangqi send `legalMoves`
- [ ] `npm test` entertain suite pass
- [ ] `npm run build` pass (smart-build)
- [ ] PM2 restart + git push
