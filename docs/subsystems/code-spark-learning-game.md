# Code Spark — Blocks-first 闯关 + Python Bridge

> Date: 2026-08-16 · Status: implementing (v2 blocks-first refactor)  
> GameId: `code-spark` · First card in Learning Games on `/entertain`  
> Research seed: [知乎 · 5–14岁 8 个免费国外编程站](https://zhuanlan.zhihu.com/p/148424141) + 站内深度调研

## Problem

v1 已有积木跑图 + 受限 Python DSL，但仍有偏差：

1. **`advanced` band 默认 Python** — 与少儿编程主流路径（积木启蒙 → 文本进阶）相反；
2. 积木与 Python 是「二选一切换」，缺少 Scratch/MakeCode 式 **对照翻译（bridge）**；
3. 通关后缺少 CodeCombat 式「同一关再写一遍文本」的 remake 动机；
4. 文案偏「Python Hero」，弱化了 Code.org / Scratch / Blockly 的积木主路径。

## Research summary (P1)

原文推荐的 8 站隐含年龄阶梯：

| # | Site | Age cue | Modality | Takeaway for Code Spark |
|---|------|---------|----------|-------------------------|
| 1 | **Code.org** | 4–15 | 游戏化积木闯关、按年级、Hour of Code | 任务叙事 + 即时 Run + 证书/星级反馈 |
| 2 | **ScratchJr** | 5–7 | 图形块、无文本 | `early`：仅序列积木、极简 UI |
| 3 | **Scratch** | 6–12 | 视觉积木、创作/社区 | 积木是默认母语；创造力 > 语法 |
| 4 | **Blockly Games** | 8+ | 一关一概念、立刻看结果 | band 解锁 ops；每步概念聚焦 |
| 5 | **CodeCombat** | 10+ | **文本** Python/JS + RPG | Python **保留**，但是**进阶轨**，非默认 |
| 6 | Code Monster | ~12 | 双栏代码→结果 | 对照预览启发 |
| 7–8 | Codecademy / Khan | 14+ | 专业文本课 | 远期 Lab，本游戏不做 |

补充证据：Weintrop & Wilensky（积木组学习增益更高）；CircuitMess / Kids Coding Tutor — **先积木再 Python 是翻译不是跳跃**；MakeCode/Tynker — 双模对照是过渡标配。

**产品约束（用户）：** Python 必须保留；**默认永远是 Blocks**（类似 Scratch/Code.org），不按年龄把文本设为默认。

## Approach (v2)

### A. Blocks-first（硬规则）

- `defaultEditorMode(*)` → **始终 `"blocks"`**（含 `advanced`）。
- Band 只决定 **关卡尺寸 / 可用积木 / 文案难度**，不决定编辑器默认模式。
- Python 始终可选手动切换；从不自动进文本模式。

### B. Python Bridge（对照 + Remake）

- 积木模式下显示可折叠 **See as Python** 预览（`opsToPython` 实时对照）——对齐 MakeCode / Code Monster「一边改一边看」。
- 积木通关后 CTA：**Try in Python**（同关 remake：把当前 program 写入 textarea）+ **Next mission**。
- 技能轨道末段改名：**Python Bridge**（原 `python-hero` → `text-bridge`），表示「翻译轨」而非「默认文本英雄」。

### C. 关卡阶梯（对齐原文年龄隐喻）

| Band | Profile cue | Ops | Grid | Focus |
|------|-------------|-----|------|-------|
| `early` | grade ≤ 2 **or** age ≤ 7 | forward/left/right | 4×4 | ScratchJr 式序列 |
| `elementary` | grade 3–5 | + repeat | 5×5 | Scratch / Blockly 循环 |
| `middle` | grade 6–7 **or** age ≥ 12 | + ifClear | 6×6 | Blockly 条件 |
| `advanced` | grade ≥ 8 **or** age ≥ 14 | 全指令；**仍默认 Blocks** | 6×6 | 可选手动进 Python Bridge |

仍保留受限 Python DSL（无 `eval` / 无 Pyodide）；远期完整 CPython Lab 延期。

### D. UX 细节

- 积木色块分区（Motion / Control / Sensing）— Scratch 色觉提示，不嵌 Blockly WASM。
- 嵌套 body 缩进展示，贴近视觉积木栈。
- 卡片/推荐文案：Blocks first，Python optional bridge。

## Key files

| File | Role |
|------|------|
| `src/lib/entertain/code-spark.ts` | band/levels/run、DSL、`defaultEditorMode`→blocks、`text-bridge` track |
| `src/lib/entertain/code-spark.test.ts` | 默认模式 + track + DSL 回归 |
| `src/components/CodeSparkGame.tsx` | Blocks-first UI、See as Python、Remake CTA |
| `src/lib/game-recommend.ts` / `EntertainPage.tsx` | 文案 |

## Risks

- 大龄学生觉得积木「不真实」→ **mitigate**：显眼 Python Bridge 切换 + Remake CTA，不强制锁死。
- 双栏预览挤占手机屏 → **mitigate**：默认折叠预览；通关后再强调 Python。
- Scope creep → 真 Blockly/Scratch 编辑器 → **mitigate**：保持轻量 chip/stack；不引 WASM。

## Test design

### Unit
- `defaultEditorMode` 对所有 band 返回 `"blocks"`
- `trackFromBand("advanced") === "text-bridge"`；`trackLabel` = `Python Bridge`
- 既有 `parsePythonProgram` / `opsToPython` / `runProgram` 回归

### Integration
- Vitest `code-spark.test.ts`；`game-recommend` 仍映射 coding → code-spark

### Manual
- 任意年级打开 Code Spark → **默认 Blocks**
- 拼积木时打开 See as Python，预览同步
- 积木通关 → Try in Python 同关 remake 再 Run
- 手动切 Python 仍可用 DSL 通关
