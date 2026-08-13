# Spark 深度分析报告落地（P0→P2）— 优等生深度体验

> 基准报告：`evaluation/Spark_竞品调研与优等生体验深度分析_2026-08-13.md` §9/§10 路线图。
> 状态：全部 13 项已实现（2026-08-13），每项带 vitest 单元测试，已 build + pm2 重启 + 健康检查。
> 交付约定：`docs/TODO.md` 勾选 → 推 develop → `npm run build`（smart-build）→ pm2 重启 + 健康检查。

## P0 数据修复 + 让饱和的优等生"重新有路可走"

### P0-1 归因链路修复（先决，决定周报可信度）

根因：`mergeSourceCounts` 用求和合并，而同步协议发送全量快照并双向合并 → 计数几何级虚增；`attributionBySource` 用窗口筛技能但汇总终身累计计数。

- `src/lib/learning-memory.ts`
  - `mergeSourceCounts` 改为**幂等**（`Math.max` 合并，与 `attempts` 对齐），避免快照互推虚增。
  - `SkillMastery` 新增 `sourceCountsWeek` / `sourceWeekKey`；`touch` 写周桶并处理周滚动；`normalizeSkill` 正确规范化。
  - `attributionBySource` 改为**周窗口**内滚动统计（技能 `sourceWeekKey` 落在本周 + 计数取周桶），让周报 Top3 名副其实。
  - `mergeLearningMemory` 的 `gapHistory` 合并去重（按 `skillId`，天数并集、取较晚 expiry）。
- 新增一次性清洗脚本 `scripts/reset-attribution.mjs`：把现有 `data/learning-memory.json` 中 `sourceCounts` clamp 到 ≤ `attempts`，`gapHistory` 去重。
- 测试：`learning-memory.test.ts` 补 mergeSourceCounts 幂等、attributionBySource 周窗口、mergeLearningMemory gapHistory 去重；`parent-digest.test.ts` / `family-report.test.ts` 数据带周桶。

### P0-2 高掌握度"饥饿循环"

根因：无 `highMasteryMode`；饱和时 opener 退化为对已掌握技能的泛化 zpd 卡；`ChatThread` 的 `adjacentOpener && !sessionOpener` 让相邻推荐卡被当日 opener 压制。

- `src/lib/session-opener.ts`：新增 `highMasteryMode` 判定（pKnown≥0.8 技能占比 ≥60%，`isHighMasteryMode`）；命中时 opener 类型切换为 **challenge**（`pickChallengeSkills`）+ 相邻新技能（`recommendAdjacent`）+ 深挖为什么，文案 "你今天会的东西不少——来点更难的？"；`rotateSessionOpener` 保留该模式。
- `src/components/TutorShell.tsx`：`onOpenerTry` 处理 `challenge` 类型 opener，直接进入挑战会话。
- `src/components/ChatThread.tsx`：高掌握模式下相邻推荐卡不再被 opener 压制；"Challenge me!" 升为主视觉（`accent="action"`，teal→橙）；Quick questions 卡在挑战 opener 时显示 "Go harder 🏆"。
- 测试：`session-opener.test.ts` 补 highMasteryMode 饱和/非饱和用例（`useFakeTimers`）。

### P0-3 视觉默认 nudge

- 已核查：`priorTier:high` 已默认 reactive（`proactive-nudge.ts`），Retry 按钮已有发光高亮。
- `proactive-nudge.ts`：high 先验学生仅错题后**一次**机会（recent-wrong），无 idle 推题。
- 测试：`proactive-nudge.test.ts` 更新 high-prior 用例。

## P1 作业闭环 + 自我发现

### P1-1 错题本 → 本周组卷

- `src/lib/wrong-answer-store.ts`：`buildWeeklyQuiz(accountId, count)` 选最近 3-5 道错题（按技能去重，错误计数加权）；`buildWeeklyQuizKickoffMessage` 生成聊天 kickoff；`markWrongAnswersRedone` 回写后移除；`buildWeeklyQuizPrintHtml` 可打印题卷。
- `src/components/WrongAnswerBook.tsx`："Make this week's quiz" 按钮 → 屏幕内题卷（问题 + 引导提示）→ 完成后回写 BKT 并标记重做；打印视图复用 `learning-portfolio.ts` 打印模式。
- 测试：`wrong-answer-store.test.ts` 补组卷选择 / kickoff / 回写用例。

### P1-2 整页 OCR 批改入库

- `src/lib/image-ocr.ts`：`parseWorksheetItems` 把 OCR 文本拆为逐题列表；`worksheetGradingBlock` / `worksheetGradingBlockFromSummaries` 生成"整页逐题批改"指令。
- `src/app/api/chat/route.ts`：OCR 后调用批改块注入 `buildTutorPrompt`；`src/lib/prompts.ts` 支持 `worksheetGrading`。
- 效果：模型逐题判定对错 → 错题自动 `addWrongAnswer` 入库 → 页尾"重做这 N 道"按钮。
- 测试：`image-ocr.test.ts` / `prompts.test.ts` 补逐题解析与注入用例。

### P1-3 Me Hub → 兴趣雷达 + 好奇心地图

- `src/lib/interest-store.ts`：`buildCuriosityMap(interests, entries)` 生成"本周好奇心地图"（一句话 + 3 个兴趣词，基于探索计数）。
- `src/components/InterestRadar.tsx`：新卡（3-5 兴趣词 + 最近探索主题 + 好奇心地图），挂载 `MeHome`。
- 测试：`interest-store.test.ts` 补 buildCuriosityMap 用例（排序 / headline / 空数据）。

### P1-4 家长周报加"兴趣 + 方向"栏

- `src/lib/parent-digest.ts`：新增 `interestFocus`（本周持续好奇的主题，按 count 取 Top3）+ `nextChallenge`（吃 P0-1 归因：`recommendAdjacent` 且 from 技能本周已掌握 → 建议下一周挑战 Y，`label` + `line`）。
- `src/lib/family-report.ts`：`buildFamilyReport` 接受 `interests`，`buildNarrative` 输出 "Curiosity this week" / "Next stretch"。
- `src/components/FamilyControlsPage.tsx`：hydrate 兴趣 + 新栏渲染。
- 测试：`parent-digest.test.ts` / `family-report.test.ts` 补 interestFocus / nextChallenge 用例。

### P1-5 进度页 → 我的知识版图

- `src/lib/dashboard-stats.ts`：`buildDashboardExtras(mem, now)` 纯函数 = `attributionBySource`（来源维度）+ `recommendAdjacent`（相邻推荐），可单测。
- `src/components/LearningDashboard.tsx`：空态不再因 0 技能全隐藏（探索足迹常显）；加 "How you learned this week"（Top5 来源 ×count）与 "What's next"（已掌握 X → 隔壁 Y，点击 `stashPracticeKickoff` 直达）。
- 测试：`dashboard-stats.test.ts` 补来源维度排序 / 周窗口排除 / 相邻推荐 / 空数据用例。

## P2 趣味与成长叙事

### P2-1 成长时刻视觉化

- `src/lib/skill-dots.ts`：`weekStartOf` + `litThisWeek`（本周 `lastSeen` 且非 grey 的技能）。
- `src/components/SkillDots.tsx`：顶部 "🎉 You lit N dots this week — level up!" 横幅 + 本周点亮圆点 `animate-pulse`。
- 测试：`skill-dots.test.ts` 补 litThisWeek 周窗口用例。

### P2-2 鼓励带归因

- `src/components/JournalTimeline.tsx`：`PraiseAttribution` — 孩子自己的时间线上显示 "Mom liked your ▶ Rocket launch — '好棒！'"（读 `entry.praise.notes` 最新一条 + 最近创作标题）。
- 触发条件：仅 Mine 视图、有 praise notes。

### P2-3 季度方向报告

- `src/lib/direction-report.ts`：`buildSelfDescription(name, interests, creations)` 生成 "Ryan · Space explorer · becoming a filmmaker" + 一句 blurb；`load/save/clearCustomDescription` 本地持久化（可编辑、可 🎲 重生成）。
- `src/components/DirectionCard.tsx`：MeHome 顶部动态自我描述卡（编辑 textarea / Surprise me）。
- 测试：`direction-report.test.ts` 覆盖兴趣昵称 / 作品方向 / 空档案 / 存储键。

### P2-4 实验室跨内容推荐

- `src/lib/cross-lab.ts`：`suggestNextLab(from, tags)` 关键词路由（space→NatGeo、animals/nature→BBC、history→BBC、society/creativity/psychology→RSA、science/technology→TED）+ 兜底路由；`LAB_GAME_PARAM` 供跳转。
- `src/components/CrossLabSuggest.tsx`：观看/阅读页底部 "Next stop · NatGeo Lab — 看了 black hole → 去 NatGeo 看恒星" 卡，挂载 TED watch / NatGeo read / BBC watch / RSA watch。
- 测试：`cross-lab.test.ts` 覆盖路由 / 不推荐当前 lab / 兜底 / 空标签。

### P2-5 几何交互可视化

- `src/lib/geometry-svg.ts`：`describeGeometryShapes(spec, indexes)` — 把 step.highlight 数字转成人话（"triangle A·B·C" / "segment base = 5 cm" / "12"）。
- `src/components/GeometryStepPlayer.tsx`：新增 "Where to look" 高亮形状 chips + 测量标注 callout（`step.note`，coral 高亮）+ 步骤切换 `fade-up` 动画。
- 测试：`geometry-svg.test.ts` 补 describeGeometryShapes 用例（标签 / 兜底 / 越界）。

## 收尾

- `docs/TODO.md` 勾选全部条目；新增本文档 + `docs/DESIGN.md` 链接。
- `npm run test` 全绿 → `npm run build`（smart-build）→ pm2 重启 → curl 健康检查（`/`、`/me`、`/me/journal`、`/family`、`/dashboard`、`/studio` 全 200）。
