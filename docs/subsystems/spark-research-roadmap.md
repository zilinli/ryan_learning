# Spark 竞品调研路线图落地（P0→P3）

> 基准报告：`/root/AI教学产品调研与Spark分析报告.md` §9 路线图。
> 状态：全部 12 项已实现（2026-08-13），每项带 vitest 单元测试。

## 新增需求（优先）

### R.0 — Me 时间线删除单条记录

- `journal-store.ts` 新增 `removeJournalMadeBlock(accountId, entryId, creationId)`：
  仅移除对应 `made` 块；若 entry 仍剩正文保留卡片，否则整条删除。
- `DELETE /api/journal` 支持可选 `creationId`（不影响 My Creations 中的创作本身）。
- `JournalTimeline.tsx` 每张 Wrote/Empty day/Related 卡加 `DeleteChip`（两击确认：首次变「Sure?」）。

## 阶段一：体验激活

### R.1 — 主动开场卡增强（§8.1）
- 开场卡按钮：「再给我一题」→ `rotateSessionOpener` 切换下一个 practiceTarget；「今天想拍作业」打开拍照。
- `SessionOpener.challengeLine`：给已掌握技能一条高阶提示（`buildChallengeLine`）。

### R.2 — 本地快速路径扩容（§8.2）
- `local-facts.ts`：单位换算（km/m、kg/g、L/mL、h/min）、路程=速度×时间、平方/立方表、2 的幂、简单百分比/一半。支持中英双语、小数输入。
- 接入 `useTutorSession`：与 `tryLocalRecall` 并列短路（有附件时不走）。

### R.3 — 孩子可见的成长可视化（§8.3）
- `SkillDots`（绿=掌握 ≥0.8 / 黄=复习中 / 灰=新），点开显示 2-3 个强项 + 2-3 个待加强（`summarizeSkillDots`），挂 `MeHome`。

## 阶段二：优等生挑战性

### R.4 — 显式挑战模式 + 难度爬升（§8.4）
- `challenge-mode.ts`：`pickChallengeSkills`（BKT ≥80%）、连对升档（3→2、6→3 级）、localStorage 连胜 / sessionStorage 会话、`recordChallengeOutcome` 按回合更新。
- 开场卡「Challenge me!」→ `buildChallengeKickoffMessage` 注入会话 kickoff。

### R.5 — "如果……会怎样"深挖（§8.5）
- 回复底部「继续深挖」三动作：换一种方法 / 边界条件 / 跨学科连接（`buildDeepDivePrompt` + `DeepDiveControl`），复用现有会话发送机制。

### R.6 — 错题本闭环（§8.9）
- `wrong-answer-store.ts`：持久化错题（问题/学生答案/技能/时间），`addWrongAnswer` 在 outcome=incorrect 处挂钩。
- `WrongAnswerBook`（挂 `MeHome`）：按技能分组、重做 3 题（sessionStorage kickoff → 空聊天自动开场）、单条删除。

## 阶段三：趣味与家庭

### R.7 — 每周「讲给家人听」（§8.6 Feynman）
- `feynman-task.ts`：按周（周一）选最强已练技能生成 kid/parent 提示；`markFeynmanDone` 本地打卡。
- 周报 `buildParentWeeklyDigest` 追加 `feynmanTask` 行；`FamilyControlsPage` 渲染 Teach-back 卡片。

### R.8 — 短周期小目标（§8.8）
- `weekly-goal.ts`：周一起算「本周掌握 3 个新技能」；`reconcileWeeklyGoal` 以每周首次打开时的已掌握集合为 baseline，之后新跨 0.8 阈值的技能计入；`WeeklyGoalCard` 挂 `MeHome`；回合后自动 reconcile。

### R.9 — 家长周报成长故事（§8.10）
- `ParentWeeklyDigest.breakthrough`：由本周 top gain + `recentWins[0]` + 最新本周 session digest 拼出「本周最大突破」成长叙事；`family-report` 叙事含该段落；Family 页绿色高亮卡展示。

### R.10 — 读一段给我听（§8.11）
- `reading-assessment.ts`：STT 转写 vs 目标段落的位置对齐准确率 + 漏读词列表（CJK 按字切分）。
- `ReadAlongPractice`：选段落 → Listen（speech-player TTS）→ Mic（`MicTranscribeButton` → `/api/transcribe`）→ 评分反馈；挂 `MeHome`。

## P3 stretch — 几何交互可视化（§8.7）

- `GeometryStep`（caption + highlight 形状索引 + note 量标注）写入 `GeometrySpec.steps`。
- `buildGeometrySvg(spec, { stepIndex })`：非高亮形状 `<g opacity="0.25">` 变暗；底部橙色 callout 渲染序号 + `note` 标注 + 步骤说明。
- `draw_geometry` 工具 schema 增 `steps`；`geometrySpecToMarkdown` 在 steps 存在时追加 ```` ```geom-steps JSON ```` fence。
- `GeometryStepPlayer`：Overview + 每步一张图，Prev/Next + 步骤点 + 「Read aloud」TTS；`MarkdownMessage` 识别 `geom-steps` fence 渲染。

## 交付

- 全部：vitest 单元测试（feynman-task / weekly-goal / reading-assessment / parent-digest / geometry-svg / local-facts / skill-dots / challenge-mode / wrong-answer-store / session-opener / prompts 等）。
- 文档：本设计文档 + `docs/TODO.md` SPARK-ROADMAP 章节 + `docs/DESIGN.md` 指针。
- 发布：build → pm2 restart → health 检查。
