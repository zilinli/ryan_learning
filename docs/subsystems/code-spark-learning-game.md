# Code Spark — 年级分层编程学习游戏

> Date: 2026-08-16 · Status: implementing  
> GameId: `code-spark` · First card in Learning Games on `/entertain`

## Problem

学生想用兴趣向编程玩法入门，但 Learning Games 里没有编程条目；主对话提到编程时也无法弹出可 **Run** 的交互（对比 ScratchJr / Code.org Sprite Lab）。

## Approach

轻量**积木跑图**（不嵌完整 Blockly/Scratch iframe）：

1. 按账号 **age + grade** 分档解锁指令与关卡规模（ScratchJr → Scratch / CSF 进阶）。
2. 拼指令条 → **Run** → 逐步动画看机器人走格；错了可改程序重跑（Answer-Until-Correct）。
3. 主对话：编程关键词 → `suggestGame` → `InlineGamePanel`；助手可发 `~~~intent {"kind":"game","gameId":"code-spark"}`；无 fence 时用用户文案兜底弹出。

### Band table（兴趣娱乐为主）

| Band | Profile cue | Blocks | Grid | Focus |
|------|-------------|--------|------|-------|
| `early` | grade ≤ 2 **or** age ≤ 7 | `forward` `left` `right` | 4×4 | 序列 / 因果 |
| `elementary` | grade 3–5（默认 Ryan G4） | + `repeat` (2–4) | 5×5 | 循环 |
| `middle` | grade ≥ 6 **or** age ≥ 12 | + `ifClear` | 6×6 | 条件 + 稍长路径 |

Difficulty 1–5 still modulates obstacle count / path length within the band (BKT `pKnown` optional; default mid).

### Core loop

Build → **Run** → watch snapshots → goal / bump / out-of-fuel → edit → Run again.

## Key files

| File | Role |
|------|------|
| `src/lib/entertain/code-spark.ts` | Pure: band, level gen, `runProgram`, validate |
| `src/lib/entertain/code-spark.test.ts` | Unit tests |
| `src/components/CodeSparkGame.tsx` | UI + Run animation + BKT turn |
| `src/lib/game-recommend.ts` | Coding keywords → `code-spark` (priority) |
| `src/lib/intent-fence.ts` | Programming keywords → game intent |
| `InlineGamePanel` / `EntertainPage` / `types` | Register first Learning Game |

## Risks

- Scope creep into full IDE — **mitigate**: fixed opcode set, no free text code.
- Chat false-positive on “play” vs coding — coding regex is **specific** (`code`/`scratch`/`编程`/…); general play still uses other games.
- Static SSR `/entertain` — keep page free of `searchParams` (see entertain-static-ssr-fix).

## Test design

### Unit
- `bandFromProfile` age/grade boundaries
- `runProgram`: reach goal, hit wall, repeat expands, ifClear branches
- `suggestGame` / `detectIntentFromText` coding → `code-spark` / `game`

### Integration
- Vitest suites above; `tsc` via normal CI path on commit

### Manual
- `/entertain`：Code Spark 为 Learning Games 第一张卡；Run 可见逐步移动
- 主对话发送「教我写个循环 / Scratch」→ 弹出 Inline Code Spark
- 切换账号到低年级 → 仅三向指令、无 repeat
