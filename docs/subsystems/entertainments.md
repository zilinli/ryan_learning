# Entertainments · Engine Design & Test Plan

> Version 0.8 · 2026-08-11  
> Scope: `/entertain` — Chess / Xiangqi / Go / Gomoku / Ultimate TTT / Blocks / Snake / Sudoku / Sokoban / Klotski; **Studio · learning** (`?hub=studio`) — TED Lab / Writing Studio / My Creations

---

## 1. Open-Source Research Summary

| Game | Reference | UI pattern | Test pattern |
|------|-----------|------------|--------------|
| Chess | [jhlywa/chess.js](https://github.com/jhlywa/chess.js) + Lichess Chessground | Logic ≠ UI; FEN + SAN | `chess-local.ts` minimax + 5-level difficulty |
| Xiangqi | [lengyanyu258/xiangqi.js](https://github.com/lengyanyu258/xiangqi.js) + [yingwang/chinese_chess](https://github.com/yingwang/chinese_chess) + PST eval blogs | Pieces on **intersections**; SVG | `xiangqi-local.ts` material+PST α-β, 5 levels |
| Go | [SabakiHQ/go-board](https://github.com/SabakiHQ/go-board) | suicide / ko / capturing | `go-local.ts` liberty/capture heuristics |
| Gomoku | ZoliQua/Gomoku-Game pattern AI | 15×15 freestyle | `gomoku-local.ts` open-four / block |
| **Ultimate TTT** | [Wikipedia rules](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe); [jacobcohn/ultimate-tic-tac-toe-ai](https://github.com/jacobcohn/ultimate-tic-tac-toe-ai); [thehav0k/ultimate-tic-tac-toe](https://github.com/thehav0k/ultimate-tic-tac-toe); [colinschepers MCTS](https://github.com/colinschepers/UltimateTicTacToeJS); [Math with Bad Drawings](https://mathwithbaddrawings.com/2013/06/16/ultimate-tic-tac-toe/) | 3×3 of 3×3; highlight active board; big X/O overlay | Legal routing + board win + meta win + local α-β |
| Blocks | oTetris / react-tetris-ts (Tetris™ name avoided) | grid + rAF/interval | lock / clear / rotate |
| Snake | classic queue body | WASD / arrows | wall / grow / reverse reject |
| Sudoku | sudokukit | Pure-TS generator | unique solution |
| Sokoban | ecyrbe/sokoban | Undo stack | Push / win |
| Klotski | CoderLim/klotski-solver | Cao Cao exit | Collision + win |

**AI policy (v0.6):** Chess / Xiangqi / Go / Gomoku / Ultimate TTT use **client-side local AI only**. Difficulty: `easy` | `medium` | `hard` | `expert` | `master`. **Default UI level = `hard`.**

### 1.2 Difficulty upgrade research (2026-08-09 → v0.6 challenge pass)

**Problem:** v0.5 still felt too easy — `hard`/`expert`/`master` shared depth **3** on Xiangqi (and Chess hard stayed at 2), so higher pills did not increase challenge.

| Source | Finding |
|--------|---------|
| [yingwang/chinese_chess](https://github.com/yingwang/chinese_chess) (browser) | 5 levels by **search depth**: Beginner 2 · Intermediate 3 · Advanced 4 · Professional 5 · Master 7. α-β, iterative deepening, TT, killer/history, quiescence. |
| [yingwang/chinese_chess_mobile](https://github.com/yingwang/chinese_chess_mobile) | Pikafish NNUE depths 3–20. Deferred (WASM/binary + RAM). |
| [js-chess-engine](https://www.npmjs.com/package/js-chess-engine) | Levels 1–5 map to base depth + adaptive + **quiescence**; Expert ≈ 4 ply + q-search. |
| [lhttjdr/xiangqi](https://github.com/lhttjdr/xiangqi) | PVS / NegaScout / ID / history — confirms depth + ordering >> material-only. |
| Stanford CS221 Xiangqi poster | Depth-1 minimax fails forks/mate-in-2; move ordering unlocks depth 2+. |
| Tencent Cloud Xiangqi tutorials | **PST** + MVV-LVA + quiescence ≈ +1 strength tier without extra ply. |

**Decision for Spark v0.6 (pure TS, ID timebox, no Pikafish):**

| Level | Xiangqi depth | Chess depth | Eval / extras |
|-------|---------------|-------------|---------------|
| `easy` | 1 (top-half scored) | random legal | Weak / noisy |
| `medium` | 2 | 2 | Material + PST |
| `hard` | 3 + ID | 3 + ID | Capture-first; default UI |
| `expert` | **4** + ID + quiescence | **4** + ID + quiescence | Mobility (XQ); check bias (Chess) |
| `master` | **5** + ID + quiescence | **4** + ID + deeper q + budget | Strongest local; ~≤700ms soft budget |

Go: atari/liberty threat scoring + deeper reply sample on expert/master.  
Gomoku: higher defend weight + wider candidate radius + stronger reply lookahead.  
UTTT: α-β depths 2/3/4/5/6 with ID timebox on expert+.

**Risks:** Depth 5 Xiangqi without TT can stutter → iterative deepening + soft budgets; tests D4/D9 bound medium/hard latency; D7/D8 assert depth ladder + expert quiescence.

### 1.1 Ultimate Tic-Tac-Toe — feasibility (2026-08-09)

| Question | Finding |
|----------|---------|
| Rules stable? | Yes — Wikipedia / Math-with-Bad-Drawings standard: move sends opponent to matching small board; finished board → free choice; meta 3-in-row wins. |
| Fit our stack? | **High** — pure TS reducer like Gomoku; ~81 cells; no WASM/Rust needed for casual play. |
| AI approach? | Literature prefers **MCTS** for strength; for this app (4GB host, &lt;100ms UX) use **material/threat heuristic + shallow α-β** (jacobcohn / thehav0k Hard pattern). Easy=random; Medium=depth 2; Hard=depth 3 + ordering. |
| Dependencies? | **None** — avoid AGPL ultimatexo / npm AI packages; own MIT-style engine under `src/lib/entertain/`. |
| Risks | Wrong “sent to finished board” free-move rule; UI not highlighting active board → unplayable. Mitigate with U1–U12 tests + active-board CSS. |

### Key bugs found in v1 (before this plan)

1. **AI 500**: used `run.messages()` — not in Cursor SDK; correct API is `run.stream()` / `onDelta` (same as tutor chat).
2. **Xiangqi grid missing**: CSS cell-grid, no SVG lines/river/palace; pieces not on intersections.
3. **No engine unit tests** after rewrite → regressions uncaught.
4. **Chess unusable (v2)**: `board[r]` used rank index from square label (`r=7` for a8) but `chess.js` `board()[0]` is rank 8 — pieces drawn on wrong ranks so clicks never matched the piece shown. Fixed via `squareFromVisual` / `pieceAtVisual`.
5. **AI too slow**: Cursor SDK per-move. Industry practice (chess.js + local minimax / Web Worker) — Chess now uses **client-side local AI only** (`chess-local.ts`), typically &lt;50ms.

---

## 2. Architecture

```
src/lib/entertain/          ← pure logic (no React) — UNIT TESTED
  chess: chess.js (npm)
  xiangqi.ts / go-logic.ts / gomoku.ts / uttt.ts / …
  *-local.ts                ← client AI (easy|medium|hard)
  game-ai.ts                ← legacy SDK helper (board games no longer call it)

src/components/*Game.tsx    ← UI only; local AI via *-local.ts
```

### 2.1 Ultimate TTT data model

```ts
type Player = "X" | "O";
type Cell = Player | null;
type BoardWinner = Player | "draw" | null;

interface UtttState {
  boards: Cell[][];          // 9 boards × 9 cells
  winners: BoardWinner[];    // per small board
  activeBoard: number | null; // 0–8, or null = free choice
  turn: Player;
  status: "playing" | "X_win" | "O_win" | "draw";
  lastMove: { board: number; cell: number } | null;
  moveCount: number;
}
```

Move string: `"board,cell"` (e.g. `"4,8"` = center board, bottom-right cell).

**Legal move rules (normative)**

1. First move: any empty cell on any unfinished board (`activeBoard === null`).
2. Otherwise must play in `activeBoard` if that board is unfinished.
3. If target board is won/drawn/full → free choice among unfinished boards.
4. After placing in cell `c`, next `activeBoard = c` (or `null` if board `c` finished).
5. Small board win → set `winners[b]`; meta 3-in-row → game win; no legal moves → draw.

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

### 3.8 Ultimate Tic-Tac-Toe (`uttt.test.ts` + `uttt-local.test.ts`)

| ID | Case |
|----|------|
| U1 | Init: 9 empty boards, `activeBoard=null`, turn X, status playing |
| U2 | First move anywhere legal; illegal out-of-range rejected |
| U3 | Playing cell `c` sets next `activeBoard=c` |
| U4 | Sent to finished board → free choice (`activeBoard=null`) |
| U5 | Cannot place in occupied cell or finished small board |
| U6 | Small-board three-in-row sets `winners[b]` |
| U7 | Full small board with no winner → `winners[b]="draw"` |
| U8 | Meta three-in-row → `X_win` / `O_win` |
| U9 | No legal moves left → `draw` |
| U10 | `getLegalMoves` ⊆ empty cells on allowed boards only |
| U11 | Local AI easy/medium/hard always returns ∈ legal |
| U12 | Hard AI takes immediate meta-winning move when available |
| U13 | `applyMove` increments `moveCount` and flips turn |

### 3.9 Difficulty upgrade (`xiangqi-local.test.ts` / `chess-local.test.ts` + siblings)

| ID | Case |
|----|------|
| D1 | All 5 levels return ∈ legal moves (Xiangqi + Chess) |
| D2 | Xiangqi hard/expert/master captures hanging rook when available |
| D3 | Chess hard+ captures hanging queen when available |
| D4 | Xiangqi medium move under 400ms from early midgame |
| D5 | Depth monotonicity: `searchDepth(easy) < medium < hard < expert ≤ master` |
| D6 | `usesQuiescence(expert\|master) === true`; hard false |
| D7 | Xiangqi `searchDepth(master) >= 5` and Chess `searchDepth(expert) >= 4` |
| D8 | Go expert/master return legal; capture when hanging stone available |
| D9 | Xiangqi hard move under 800ms from opening reply |
| D10 | UTTT `searchDepth` ladder easy…master strictly increasing |

### Self-verify gate

```bash
npm test -- src/lib/entertain
# All entertain tests PASS before deploy
```

---

## 4. UI (Ultimate TTT)

- Outer 3×3 of inner 3×3 grids; gap between boards.
- **Active board** highlighted (teal ring / mist fill); inactive boards dimmed when constrained.
- Won boards show large translucent X / O overlay; drawn boards show “=” or muted fill.
- Last-move cell ring; mode + difficulty pills (same as Chess/Gomoku).
- Human = X, AI = O in vs-AI mode.

---

## 5. Delivery checklist

- [x] Design doc (this file, v0.4 UTTT section)
- [x] Engine unit tests green (prior games)
- [x] Ultimate TTT engine + AI + UI
- [x] U1–U13 tests green
- [x] Hub card + `GameId`
- [x] `npm test` entertain suite pass (82)
- [x] `npm run build` pass (smart-build)
- [x] PM2 restart + git push

---

## 6. Studio — TED Lab + Writing Studio (v0.8)

### 6.1 Product shape

**Studio · learning** is a separate hub (`/entertain?hub=studio`), not nested under Entertainments games:

| Card | Id | One-liner |
|------|-----|-----------|
| TED Lab | `ted-lab` | Watch a talk. Then argue with it. |
| Writing Studio | `lyric-studio` | Write. Polish. Stage → song · image · video. |
| My Creations | `creations` | Songs, images, videos & TED challenges. |

Sidebar: Family|Dashboard row · Studio|Entertainments row · Code Agent bottom.

**Account chrome:** `StudioAccountBar` on Studio hub, Entertainments hub, and every game/studio TopBar. TED + Writing call `recordStudioLearningTurn` → per-account `learning-memory` (subjects for Dashboard).

### 6.2 TED Lab

- **Play:** official TED iframe only (`embed.ted.com`) — TED usage policy forbids scraping video files.
- **Catalog:** curated JSON in `ted-catalog.ts` (~40 talks); client search/filter; paste `ted.com/talks/{slug}` URL.
- **Transcript:** `GET /api/ted/transcript?slug=` — server fetch + `data/ted-cache/`; used for challenge generation only (no transcript browser UI).
- **Challenge:** `POST /api/ted/challenge` — advanced listening items (`literal` / `structure` / `critique` / `retell`); LLM when available, else `buildFallbackChallenge`.
- **Pedagogy:** BASIS / international-school tone — claim–evidence–implication, steelman, retell; not babyish MC.

### 6.3 Writing Studio Stage + deAPI text2X

- Writing pad → Coach (`POST /api/lyric-studio/coach` with `target`) → **modality structure** → Stage tabs: **Song / Image / Video**.
  - `target: music` (default) → `[Verse]` / `[Chorus]` lyrics + style caption
  - `target: image|video` → visual / cinematic prompts (never lyric section tags)
  - Generate rejects lyric-shaped prompts for image/video (`assertVisualPromptOk`)
- Local fallback: `src/lib/entertain/studio-structure.ts`
- **Primary (overseas):** [deAPI.ai](https://docs.deapi.ai) via `DEAPI_API_KEY`:
  - `POST /api/v2/audio/music` (txt2music)
  - `POST /api/v2/images/generations` (txt2img)
  - `POST /api/v2/videos/generations` (txt2video)
  - Jobs polled at `GET /api/v2/jobs/{request_id}` (send a normal User-Agent; Cloudflare blocks bare script UAs).
- **Unified route:** `POST /api/studio/generate` with `{ kind: "music"|"image"|"video", ... }`.
- **Song fallback:** Bailian Fun-Music → Volc GenSong (prepaid/postpaid). Volc often returns `ServerIpLimit` on non-CN egress.
- Legacy: `POST /api/lyric-studio/generate` still works for music-only.
- Unconfigured: lyrics-only drafts still save; generate returns 503.

### 6.4 My Creations

- Account JSON: `data/accounts/{id}/creations.json`
- Types: `ted_challenge` | `song` | `image` | `video`; media via `/api/media/{mediaId}`
- APIs: `GET/POST/DELETE /api/creations`
- **Audio retention:** studio blobs use `sessionId: "lyric-studio"` and must **not** be pruned by chat `pruneOrphanMedia`. See [studio-creations-audio-mobile.md](./studio-creations-audio-mobile.md).

### 6.5 Explicit non-goals

Scrape/download TED video; local music inference on spark-tutor host; streaks/leaderboards; public sharing.

### 6.6 Studio self-verify

```bash
# Unit tests (mocked providers)
npm test -- src/lib/deapi-client.test.ts src/lib/music-generate.test.ts \
  src/lib/entertain src/lib/fun-music-client.test.ts src/lib/media-store.song.test.ts \
  src/app/api/creations src/app/api/lyric-studio src/app/api/ted \
  'src/app/api/media/[mediaId]/route.audio.test.ts'

# Live probe (needs DEAPI_API_KEY in .env.local)
npx tsx scripts/smoke-deapi.ts
```
