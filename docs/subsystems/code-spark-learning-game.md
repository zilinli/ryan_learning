# Code Spark — 趣味闯关 + Python 进阶

> Date: 2026-08-16 · Status: implementing (v1.1 gamify + Python)  
> GameId: `code-spark` · First card in Learning Games on `/entertain`

## Problem

积木跑图已能入门，但趣味与高阶衔接不足：

1. 缺少 Code.org / Swift Playgrounds 式「闯关叙事 + 星级反馈」；
2. 缺少 CodeCombat 式「写真实 Python 驱动角色」；
3. 缺少 freeCodeCamp 中文社区式「网页/语言技能轨道」的可见进阶线索。

## Approach

保留轻量积木引擎（不嵌 Blockly / 不首版塞 Pyodide WASM），叠加三层体验：

### A. 趣味闯关（Code.org + Swift Playgrounds）

- 每关 **RPG 任务名** + 一句剧情 brief（不是冷冰冰的 prompt）。
- 通关后按程序长度给 **1–3 星**（效率奖励，非排行榜焦虑）。
- 顶部显示当前 **技能轨道** 芯片（Sequence → Loops → Conditionals → Python）。

### B. 积木 ↔ Python（CodeCombat 风格）

- UI 模式：`Blocks` | `Python`。
- **受限 Python DSL**（纯 TS 解析）映射到同一套 `CodeOp` / `runProgram`：
  - `move_forward()` / `turn_left()` / `turn_right()`
  - `for i in range(N):` + 缩进 body（N = 2|3|4）
  - `if clear():` + 缩进 body
- 积木可一键「Show as Python」帮助过渡；高阶学生默认 Python。
- **不做**完整 CPython：无任意 `import`、无 `eval`；安全、可测、零 WASM 体积。
- 远期可选：Pyodide REPL 作为独立 Lab（本设计明确延期）。

### C. 技能轨道（freeCodeCamp 中文启发）

可见轨道（UI 标签，与 band 绑定）：

| Track | Band cue | Focus |
|-------|----------|-------|
| Foundations | early | 序列 / 因果 |
| Loops | elementary | `repeat` / `for` |
| Branching | middle | `if clear` |
| Python Hero | advanced | 文本代码闯关 |

Band 扩展：`advanced` = grade ≥ 8 **or** age ≥ 14（默认可切 Blocks；Python 优先展示）。

### Band table

| Band | Profile cue | Blocks / Python | Grid | Focus |
|------|-------------|-----------------|------|-------|
| `early` | grade ≤ 2 **or** age ≤ 7 | blocks only | 4×4 | 序列 |
| `elementary` | grade 3–5 | + repeat / for | 5×5 | 循环 |
| `middle` | grade 6–7 **or** age ≥ 12 | + ifClear | 6×6 | 条件 |
| `advanced` | grade ≥ 8 **or** age ≥ 14 | Python 默认 + 全指令 | 6×6 | 文本代码 |

## Key files

| File | Role |
|------|------|
| `src/lib/entertain/code-spark.ts` | band, levels, run, **Python DSL**, stars, mission titles |
| `src/lib/entertain/code-spark.test.ts` | Unit tests incl. Python parse |
| `src/components/CodeSparkGame.tsx` | Blocks/Python UI + stars + track chips |
| `src/lib/game-recommend.ts` | coding / python keywords |

## Risks

- Scope creep → full IDE / Pyodide — **mitigate**: fixed DSL only; document Pyodide as future Lab.
- Python indent errors frustrate kids — **mitigate**: starter template + clear parse errors + Blocks fallback.
- Star pressure — **mitigate**: stars celebrate efficiency; Answer-Until-Correct still primary; no leaderboard.

## Test design

### Unit
- `bandFromProfile` includes `advanced`
- `parsePythonProgram`: forwards, for-range, if-clear, indent errors
- `opsToPython` round-trips simple programs
- `rateStars` efficiency thresholds
- existing `runProgram` / `validateProgram` regression

### Integration
- Vitest on `code-spark.test.ts`; recommend still maps `python` → `code-spark`

### Manual
- `/entertain` Code Spark：任务名 + 星级；切 Python 写 `for` 通关
- 高年级账号默认 Python 模式
- 主对话「学 Python」仍弹出 Inline Code Spark
