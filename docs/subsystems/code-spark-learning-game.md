# Code Spark — Blocks-first 闯关 + Python Bridge (+ Brilliant coaching)

> Date: 2026-08-16 · Status: shipping (v3 Brilliant concept-coaching)  
> GameId: `code-spark` · First card in Learning Games on `/entertain`  
> Research seeds:
> - [知乎 · 5–14岁 8 个免费国外编程站](https://zhuanlan.zhihu.com/p/148424141)
> - [Brilliant · Learn Coding](https://brilliant.org/topics/coding/) / [CS path](https://brilliant.org/cs/)

## Problem

v2 已做到 Blocks-first + Python Bridge，但仍有偏差：

1. **反馈偏结果口令**（Bump / Stuck），缺少 Brilliant 式「用白话讲清概念错在哪」；
2. **技能轨道命名**偏 FCC（Foundations / Loops），未对齐 Brilliant「Thinking in Code → Algorithmic Thinking」心智模型；
3. **关卡提示偏操作**（Tap tiles），弱化「先像程序员一样想」；
4. **主对话触发词偏窄** — Brilliant 常见词（computational thinking / variables / functions / 计算思维 / 变量 / 函数）未必弹出 Code Spark。

## Research summary (P1)

### A. 少儿站阶梯（v2 已吸收）

| Site | Takeaway |
|------|----------|
| Code.org / Scratch / Blockly | 积木默认、一关一概念、即时 Run |
| CodeCombat | Python 为进阶轨，非默认 |
| MakeCode | Blocks ↔ 文本对照 |

### B. Brilliant coding / CS（v3 新增）

| Brilliant signal | Code Spark mapping |
|------------------|--------------------|
| Interactive lessons in **plain English (not syntax)** | `conceptFocus` + coach copy 先讲逻辑 |
| **Think like a programmer** before syntax | Mission prompt 改为「先想路径/条件」 |
| Custom **intelligent feedback** | `coachFeedback()` 按 bump/fuel/stuck + band 给概念提示 |
| Path: Thinking in Code → … → Algorithmic Thinking → Python | Track labels 重命名；Python Bridge 仍可选 |
| Personalized ramp | 保留 band × pKnown difficulty |

**产品约束（不变）：** 默认永远 Blocks；Python 保留为 Bridge。

## Approach (v3)

### A. Concept focus（每关一个白话概念）

| Band | Track label (UI) | `conceptFocus` |
|------|------------------|----------------|
| `early` | Thinking in Code | Sequence — order of steps |
| `elementary` | Loops & Patterns | Repeat without rewriting |
| `middle` | Algorithmic Thinking | Decide before you move |
| `advanced` | Python Bridge | Same idea, typed words |

### B. Intelligent coach feedback

- `coachFeedback(level, run, program)` → 成功时按星级夸概念；失败时按 reason + 可用 ops 给下一步（不用堆语法错误）。
- `validateProgram` 走 coach 文案。

### C. Chat trigger hardening

- `intent-fence` / `game-recommend` 扩展 Brilliant 词：variable(s), function(s), computational thinking, CS, for/while, 计算思维, 变量, 函数, 条件, 计算机…
- Coding 命中时 `detectIntentFromText` **直接带** `gameId: "code-spark"`，避免 fallback 随机游戏。
- `prompts.ts` 同步：编程/CS/Brilliant 式话题优先 fence `gameId: code-spark`。

## Key files

| File | Role |
|------|------|
| `src/lib/entertain/code-spark.ts` | conceptFocus、trackLabel、coachFeedback |
| `src/lib/entertain/code-spark.test.ts` | coach + track + trigger 回归 |
| `src/components/CodeSparkGame.tsx` | 概念芯片 + coach 结果区 |
| `src/lib/game-recommend.ts` / `intent-fence.ts` / `prompts.ts` | 主对话触发 |
| `src/components/EntertainPage.tsx` | 卡片文案 |

## Risks

- Coach 文案过长挤手机 → 单句 + 可选短 hint。
- 触发词过宽误开游戏（如「function of x」数学）→ 英文词用 `\\b`；中文保持编程域；数学「函数」可能误触，接受为可玩 coding 过渡。
- Scope creep（真 Brilliant 课表 / 变量关）→ v3 只做文案+反馈+触发，不新增长远 Python Lab。

## Test design

### Unit
- `trackLabel` Brilliant 命名
- `generateLevel` 含非空 `conceptFocus`
- `coachFeedback`：goal / bump / fuel / stuck 各有概念句
- `detectIntentFromText("computational thinking")` → `{ kind:"game", gameId:"code-spark" }`
- `suggestGame({ text: "学变量和函数" })` → code-spark

### Integration
- Vitest：`code-spark.test.ts`、`intent-fence.test.ts`、`game-recommend.test.ts`

### Manual
- 主页聊「我想学编程 / computational thinking / 变量」→ InlineGamePanel Code Spark
- 任意 band 打开 → 见 Thinking in Code 等轨道 + 概念芯片
- 故意撞墙 → coach 白话提示；通关 → 星级 + 概念表扬
