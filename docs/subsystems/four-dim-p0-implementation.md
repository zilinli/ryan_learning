# Four-Dimension Learning P0 Implementation — Design & Test Plan

> Version 1.0 · 2026-08-17
> Source: `evaluation/four-dimension-learning-best-practices-2026-08.md`（四维学习力业界优秀实践深度调研）
> Pipeline: P0 Intake → P1 Research → P2 Design → P3 Plan → P4 Implement → P5 Release → P6 Deploy
> 相关: [spark-v2-flywheel.md](spark-v2-flywheel.md)（四维飞轮） · [spark-research-roadmap.md](spark-research-roadmap.md)（V2/V3 实施）

---

## 1. Intake — 需求分析

### 1.1 背景

Spark 四维框架（兴趣 · 心流 · 深度 · 广度）机制已较完整，但业界调研（§3-§4）显示差距在「数据闭环深度」与「干预精细化」。本轮选取报告 §7 中 **P0 三项低成本高杠杆建议**落地：

| ID | 需求 | 对应维度 | 业界依据 |
|----|------|---------|---------|
| P0-1 | 错题间隔复测排程（1/3/7 天到期队列） | 深度 | Roediger & Karpicke 2010 检索练习；Agarwal「easy learning → easy forgetting」 |
| P0-2 | 跨会话心流延续（上次高光 → 下次 opener 引用） | 专注 | 心流理论「延续感」；Khanmigo 内嵌式主动提示 |
| P0-3 | 「解释你的思路」轻提示（判对错前可跳过追问） | 深度 | Khanmigo cognitive onloading；Spark L1.5 已有雏形 |

### 1.2 用户故事

- **P0-1**：Ryan 本周错了 3 道分数加减。系统在 1 天后（而非立刻）用变式题复测；3 天后若仍未掌握再测；7 天后已掌握则自动降频。「到期复测」出现在错题本与每周 Launchpad。
- **P0-2**：Ryan 上次会话秒答连对 5 题（flow 事件）。下次打开聊天，opener 用一句话引用（"上次你连对 5 道速度题，这次我们试试更快"），可关闭。
- **P0-3**：Ryan 提交答案后，系统先问"你是怎么算出这个的？"（≤1 句，可跳过），再判对错；答对但思路混乱时也触发（对齐 Khanmigo「explain your thinking」）。

### 1.3 非目标（本轮不做）

- 交互可视化微件（P2）、通知时机 bandit（P2）、兴趣-技能关联图可视化（P1）、主题星图（P1）、四维周报（P1）→ 列为后续 roadmap。

---

## 2. Design — 系统设计（含测试设计）

### 2.1 P0-1 错题间隔复测排程

**现状**：错题本（wrong-answer-store）支持 Redo / Variant / Harder，但无时间维度排程。

**设计**：
- `src/lib/schedules.ts`（新）：
  - `retentionStages = [1, 3, 7]`（天）
  - `scheduleReview(skillId, stageIndex)` → `nextReviewAt`；掌握（pKnown ≥ 0.8）后不再排队
  - `dueReviews(wrongbook, now)` → 到期复测列表（按 overdue 排序）
- `wrong-answer-store` 条目增加 `reviewStage` / `nextReviewAt`（向后兼容：缺省视为 stage 0）
- 错题本 UI：新增「到期复测」区块；Launchpad 聚合 dueReviews 为一张卡
- **测试设计**：
  - T1 到期计算：stage 0→1 为 1 天；答对晋级 stage，答错重置 stage 0
  - T2 掌握降频：pKnown≥0.8 不再产生 due
  - T3 兼容：旧条目无 reviewStage 字段不崩溃，视为 stage 0
  - T4 排序：overdue 更久者在前
  - T5 全量 `npm test` 回归

### 2.2 P0-2 跨会话心流延续

**现状**：`flow-signals.ts` 记录 flowMoment（会话内）；学习记忆跨会话持久化已有（learning-memory）。

**设计**：
- `flow-signals.ts` 增加 `lastFlowMoment`（会话结束写入 learning memory，含 label + 摘要 + 时间）
- opener 构建：`buildOpenerWithFlowContinuity(mem)` → 若 24h 内有 flow 事件且未 dismiss，返回 ≤1 句引用；`dismissFlowContinuity()` 持久化忽略标记
- ChatThread 空状态：有延续句时显示在 opener 卡下方，可 dismiss
- **测试设计**：
  - T1 24h 内 flow 事件 → 返回延续句；超过 24h 或无事件 → 不返回
  - T2 dismiss 后不再出现（持久化）
  - T3 延续句 ≤1 句且包含具体内容（技能/数字）
  - T4 序列化兼容：旧记忆无 lastFlowMoment 不崩溃

### 2.3 P0-3 「解释你的思路」轻提示

**现状**：L1.5「ask why before marking」在提示词中；无独立 UI 与跳过机制。

**设计**：
- `prompts.ts`：L1.5 提示改为可独立触发的 `explainPrompt(skill)`（≤1 句，如 "你是怎么算出 7/12 的？"）
- 判定：对高难度题（BKT pInit 中/高）或答对但 responseTime 异常快时触发；学生可点「跳过」继续判分
- ChatThread：判分前轻提示条 + 跳过按钮；跳过计入一次计数，同题不重复追问
- **测试设计**：
  - T1 触发条件：pInit 中/高或秒答 → 触发；低难度慢答 → 不触发
  - T2 跳过：点跳过 → 正常判分，同题不再追问
  - T3 提示文案 ≤1 句
  - T4 回归：全量测试通过

### 2.4 发布与部署

- P5 Release：本地 commit → push `origin/develop`（P0 报告 + 实现）
- 合并 `develop` → `master` 并 push（两个分支都更新）
- P6 Deploy：SSH `cursor-server` → `git pull` → `npm run build`（smart-build）→ `pm2 restart spark-tutor` → health check `GET :3000` → 200

---

## 3. Plan — 执行清单（docs/TODO.md 同步）

- [ ] 3.1 写 `src/lib/schedules.ts` + wrong-answer-store 扩展（P0-1）
- [ ] 3.2 flow-signals 跨会话延续 + opener + dismiss（P0-2）
- [ ] 3.3 explain 提示触发 + 跳过（P0-3）
- [ ] 3.4 单元测试 T1-T5 ×3 组 + `npm test` 全量
- [ ] 3.5 本地 commit → push develop → merge master → push 两分支
- [ ] 3.6 服务器 pull → build → pm2 restart → health 验证

---

## 4. 验收标准

1. `npm test` 全量通过（含新增测试）
2. 三个功能在 UI 可操作（到期复测 / 心流延续句 / 解释提示+跳过）
3. GitHub `develop` 与 `master` 均含本轮提交
4. 线上 `spark-tutor-for-ryan.duckdns.org` 健康检查 200，新功能可见
