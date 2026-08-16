# Arcade Pack — Nitro Rush · Sky Patrol · Balloon Float (+ Snake)

> Version 1.0 · 2026-08-16  
> Scope: `/entertain` Arcade category — NFS-inspired racing, Nintendo-inspired vertical shmup + Balloon Fight–style floater; re-surface existing Snake.

---

## 1. Problem

Arcade on `/entertain` only shipped **Blocks**. Learners asked for:

1. **Racing** with Need for Speed–style speed / nitro feel  
2. **Plane battle** with Nintendo vertical-shooter clarity  
3. Other **kid-safe Nintendo-classic** mechanics when they fit

Constraints: pure TS engines (unit-testable), no trademarked names/assets, child-friendly (no gore), mobile touch buttons + keyboard, same hub registration pattern as Blocks.

---

## 2. Research summary (P1)

| Source | Takeaway |
|--------|----------|
| Nitro Rush (MIT canvas racer) | Multi-lane scroll road, obstacle spawn, **nitro** drain/regen, collision = crash, HUD speed |
| HinaTech vertical shooter tutorial | Bullet arrays + fire interval, enemy spawn interval shrinks with score, AABB / circle hits, reverse-iterate splice |
| Nintendo classics (age-fit) | **Balloon Fight** → flap to rise, gravity, pop foes; avoid DK violence; **Snake** already in repo — classic arcade, wire into hub |

**Naming (no IP):** `nitro-rush` · `sky-patrol` · `balloon-float` · `snake`.

---

## 3. Approach

Same architecture as Blocks / Snake:

```
src/lib/entertain/{nitro-rush,sky-patrol,balloon-float,snake}.ts  ← pure tick engines
src/components/{NitroRush,SkyPatrol,BalloonFloat,Snake}Game.tsx   ← UI + interval/rAF
EntertainPage GAMES + TITLES + switch
types.ts GameId
```

### 3.1 Nitro Rush (NFS vibe)

- 4 lanes; player lane index; traffic cars with `lane` + `y` (0 top → 1 bottom of playfield).
- Each tick: scroll traffic by `speed`; spawn ahead; steer L/R; **Shift / button** = nitro (speed×boost while charge > 0).
- Crash if same lane and `|y - playerY|` small; score = distance; difficulty from score.

### 3.2 Sky Patrol (Nintendo shmup vibe)

- Player `x` in columns (or 0…width-1); auto or tap **fire**; enemies spawn at top and move down; bullets move up.
- Hit enemy → score + remove; enemy hits player → over.
- Soft power: fire rate / spawn rate scale with score (1942/Xevious clarity, original sprites).

### 3.3 Balloon Float (Balloon Fight vibe)

- Continuous `x,y`; **flap** adds upward velocity; gravity each tick; walls wrap or bounce.
- Touch enemy balloon from above (or bump) to pop (+score); hit spikes/water at bottom → over.
- Kid-safe: balloons pop, no weapons.

### 3.4 Snake

- Engine + `SnakeGame` already exist; register under Arcade.

---

## 4. Key files

| File | Role |
|------|------|
| `src/lib/entertain/nitro-rush.ts` (+ `.test.ts`) | Racing engine |
| `src/lib/entertain/sky-patrol.ts` (+ `.test.ts`) | Shmup engine |
| `src/lib/entertain/balloon-float.ts` (+ `.test.ts`) | Floater engine |
| `src/lib/entertain/snake.ts` (existing) | Snake engine |
| `src/components/*Game.tsx` | React UIs |
| `src/lib/entertain/types.ts` | `GameId` union |
| `src/components/EntertainPage.tsx` | Hub cards + render |

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| Trademark / asset lookalikes | Original names; geometric CSS/SVG cars & planes |
| Continuous physics hard to test | Discrete `tick(state)` API; inject RNG for spawn tests |
| Mobile playability | On-screen steer / flap / fire like TetrisGame |
| Edit budget / scope creep | No bosses/multiplayer v1; Snake rewire only |

---

## 6. Test design

### Unit (Vitest)

| ID | Suite | Case |
|----|-------|------|
| NR1 | nitro-rush | Init: lane mid, status playing, nitro full |
| NR2 | nitro-rush | Steer clamps to lane bounds |
| NR3 | nitro-rush | Nitro active raises speed and drains charge |
| NR4 | nitro-rush | Same-lane overlap → over |
| NR5 | nitro-rush | Clear distance increases score |
| SP1 | sky-patrol | Init player + empty bullets/enemies |
| SP2 | sky-patrol | Fire adds bullet with cooldown |
| SP3 | sky-patrol | Bullet–enemy AABB removes both + score |
| SP4 | sky-patrol | Enemy–player hit → over |
| BF1 | balloon-float | Flap increases vy upward |
| BF2 | balloon-float | Gravity reduces vy / lowers y |
| BF3 | balloon-float | Pop enemy from above → score |
| BF4 | balloon-float | y below floor → over |
| SN* | snake | Existing suite remains green |

### Integration / manual

- Hub shows four Arcade cards; deep-link `?game=nitro-rush` etc.
- Keyboard + touch controls; New Game after over.
- Visual: readable on phone portrait.

### Gate

```bash
npm test -- src/lib/entertain/nitro-rush.test.ts src/lib/entertain/sky-patrol.test.ts src/lib/entertain/balloon-float.test.ts src/lib/entertain/snake.test.ts
```

---

## 7. Related

- [entertainments.md](./entertainments.md) — hub architecture  
- Existing `tetris.ts` / `snake.ts` patterns  
