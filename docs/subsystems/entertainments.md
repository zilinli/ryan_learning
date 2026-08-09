# Entertainments（益智游戏）设计

> Version 0.1 · 2026-08-09  
> 入口：左侧导航 **Code Agent** 下方 → **Entertainments**  
> 目标：简约、统一主题、适合儿童/青少年的益智游戏；交互语言跟随现有语音/回复语言，默认英式英语。

---

## 1. 调研结论（简约成熟 UI）

参考方向（不嵌入第三方整站，只借鉴交互）：

| 参考 | 可借鉴点 |
|------|----------|
| Lichess / Chess.com 简约棋盘 | 清晰方格、选中高亮、合法走法点、移动端大触控 |
| sudoku.com / 简约数独 | 数字键盘、笔记模式可选、检查/新局 |
| 推箱子经典网页 | 关卡选择、撤销、重置、步数 |
| 华容道 HTML5 | 大色块滑块、最少步数提示可选 |
| 围棋 9×9 教学页 | 小盘面、禁入点提示、吃子高亮 |

**统一风格（对齐 Spark）**

- 使用现有 CSS 变量：`--surface` / `--ink` / `--teal` / `--line` / `--mist`
- 面板形态对齐 Code Agent：右侧全高抽屉（`z-30`），移动端可近全屏
- 卡片式游戏入口网格（2 列桌面 / 1 列手机），无花哨渐变与过量阴影
- 游戏区内边距充足，触控目标 ≥ 40px

---

## 2. 系统架构

```
HistorySidebar
  └─ Entertainments 按钮
       └─ EntertainmentsPanel (client)
            ├─ Hub: 游戏卡片列表
            └─ GameHost: 当前游戏 + 工具栏（返回 / 新局 / 撤销）
                 └─ Sudoku | Sokoban | Klotski | Chess | Xiangqi | Go
```

| 层 | 职责 |
|----|------|
| `src/lib/entertainments/*` | 纯逻辑：规则、关卡、生成器、i18n |
| `src/components/entertainments/*` | React UI |
| localStorage `spark.{accountId}.entertain.v1` | 各游戏进度（可选，v0.1 先内存+轻量 persist） |
| 服务端 | **无**（纯客户端，零额外 CPU/Swap） |

**语言**

- `uiLang` 来自当前 `voiceId` → `replyLangFromVoice`（`en|zh|yue|es|fr|teo|hak`）
- 默认文案：**英式英语**（British English）
- 客家/潮汕 UI 先回落繁体中文书面（与辅导一致）；棋类术语用对应语言常用说法

---

## 3. 游戏范围（v0.1 MVP）

| ID | 游戏 | 规则深度 | 备注 |
|----|------|----------|------|
| `sudoku` | 数独 | 完整 9×9 | 生成易/中/难 |
| `sokoban` | 推箱子 | 完整 | 内置 ≥5 关 |
| `klotski` | 华容道 | 完整 | 曹操逃出 |
| `chess` | 国际象棋 | 完整走法 | `chess.js`；人人对弈或对简易电脑（随机合法着） |
| `xiangqi` | 中国象棋 | 完整走法（无引擎） | 自研轻量规则；双人对弈 |
| `go` | 围棋 9×9 | 吃子+劫 | 教学盘；数子可选简化 |

后续（TODO）：更多关卡、AI 难度、残局谜题、成就。

---

## 4. UI 设计

### 4.1 Hub

- 标题：Entertainments / 益智游戏（按语言）
- 副标题：一行说明「Play puzzles · British English by default」
- 卡片：图标（简笔 SVG）+ 名称 + 一句简介
- 顶部关闭 / Esc

### 4.2 GameShell

- 顶栏：← Back · 游戏名 · New · Undo（若支持）
- 中部：棋盘/盘面（`aspect-square` 或自适应）
- 底栏：状态（步数、轮到谁、胜利）

### 4.3 无障碍

- 键盘：方向键（推箱子/华容道）、数字键（数独）
- `aria-label` 齐全；胜利时 `role="status"`

---

## 5. 测试设计

| 类型 | 内容 |
|------|------|
| 单元 | 数独生成 uniqueness 抽样；推箱子推/撤回；华容道碰撞；chess.js 开局着法；xiangqi 马蹩腿；go 吃子 |
| 组件 | Hub 渲染 6 卡；点开 Sudoku 显示盘面；Esc 关闭面板 |
| 手工 | 侧栏入口在 Code Agent 下；主题切换对比度；手机宽度 |

---

## 6. 资源占用

游戏全部在浏览器运行，**不加载 FormoSpeech / 不增加 Node 内存**。与「降 CPU/Swap」目标正交且友好。

---

## 7. 文件清单

- `docs/subsystems/entertainments.md`（本文）
- `docs/TODO.md` Phase Entertainments
- `src/lib/entertainments/**`
- `src/components/entertainments/**`
- `HistorySidebar.tsx` / `TutorShell.tsx` 接线
