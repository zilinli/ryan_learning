# Spark V2 四维学习飞轮 — 三阶段实施设计

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)
> Status: **implemented** · 2026-08-13
> Source: [`evaluation/Spark_四维学习力深度调研报告_V2_2026-08-13.md`](../../../evaluation/Spark_四维学习力深度调研报告_V2_2026-08-13.md) §10 路线图
> Plan: `.cursor/plans/v2_学习飞轮三阶段实施_d99f57ce.plan.md`（仅作参考，不改动）

---

## 1. Overview

V2 报告把"组件存在"变成"真正被用"，把散件串成三个飞轮：

| 阶段 | 主题 | 目标 |
|------|------|------|
| P0 | 主动出击 + 信号转活 | 答错后 AI 主动邀请复盘；秒答出现成长时刻；探索主题延续兴趣 |
| P1 | 深度分层 + 每周节奏 | 优秀学生更快上探；每周一屏看到节奏；广度地图可导航；兴趣→作品闭环 |
| P2 | 语言干预精修 + 数据归因 | 好奇心被语言干预；连接卡动态生成；作品墙轻互动；家长周报回答"学得最多的机制" |

验收锚点（报告 §10）：答错后 AI 主动邀请复盘；连续秒答出现成长时刻文案；探索主题开始延续上次兴趣；优秀学生体验到"更快上探"；每周一屏看到本周节奏；广度地图可导航；家长周报出现四维归因。

---

## 2. P0 — 主动出击 + 信号转活

### 2.1 9.2.2 主动出击（non-blocking invite）

**文件** `src/lib/proactive-nudge.ts`、`src/components/tutor/useTutorSession.ts`、`src/components/ChatThread.tsx`、`src/components/TutorShell.tsx`

**机制**：
- `recentWrongAnswer(accountId)` — 读最近错题（复用 `buildWrongAnswerReviewSet` / `loadWrongAnswers`），判断近 3 轮内答错且无跟进。
- `shouldProactiveInvite(accountId)` — 答错未复盘、或闲置 ≥5 分钟返回页面时触发；一次会话仅一次；dismiss 后不升级骚扰。状态存 `PROACTIVE_KEY`（`browser-kv`，按账户命名空间）。
- `buildProactiveInviteLine(items)` — 文案："I saw X was a bit tricky — want to spend 2 minutes together?" + "Not now"。

**UI**：ChatThread 顶部非阻塞邀请条（复用 emotionLine 横幅样式）。"Let's review" → `handleSend(buildWrongReviewKickoffMessage(items))`；"Not now" → dismiss。

**接线**：`useTutorSession.handleSend` 内 `classifyTurnOutcome === "incorrect"` 时 `noteProactiveOpportunity(accountId)`（仅记录，不弹窗）；暴露 `proactiveInvite` 状态；TutorShell 接线回调。

### 2.2 9.2.1 flowAdviceLabel 转活 + 心流接入普通对话

**机制**：`recordFlowTurn` 返回 advice 后 `setFlowMoment(flowAdviceLabel(flowAdvice))`；把 step-up/step-down 追加进 `coachNote`（在 `emotionPromptLines()` 之后）注入 prompt，让普通对话也感知难度信号。

**UI**：ChatThread 在 emotionLine 横幅下方渲染一行成长时刻（"That was fast — you're ready for a harder spin" / "Let's make the next one a little gentler"），可手动 dismiss，下一条消息前自动清除。

### 2.3 9.1.1 兴趣数据反哺推荐

**机制**：`pickExploreTopics(mem, limit, interests?)` 增加第三入参。评分 = 技能重叠 + 兴趣 `count` 加权 + "本周探索过的主题优先衍生主题"（如 dinosaurs → 古生物/地质）。`buildExploreKickoffMessage` 在已知兴趣时加一句："因为你上次喜欢 X，我准备了它的邻居 Y"。

**接线**：`TutorShell` 空状态 `planExploreSequence(learningMemory, loadInterests(accountId))`。

---

## 3. P1 — 深度分层 + 每周节奏

### 3.1 9.3.1 BKT 参数按先验分层

**文件** `src/lib/bkt.ts`、`src/lib/learning-memory.ts`、`src/components/tutor/useTutorSession.ts`

- `bktPriorTier(params, tier)`：high-prior 学生用更激进档（pInit 更高、pLearn 更高、pSlip 更低）。
- `LearningMemory.priorTier?: "standard" | "high"`；`detectPriorTier(profile, mem)`（grade 高于教材 / 前置技能已掌握 / 历史正确率高 → high）。
- `bktUpdate` / `autoAdvanceCheck` 调用处传 `priorTier`；高先验提高 `autoAdvanceCheck` 灵敏度（更快"上探"）。

### 3.2 9.3.2 每周 Launchpad（统一周卡）

**文件** `src/lib/weekly-launchpad.ts`、`ChatThread.tsx`、`TutorShell.tsx`

聚合 `loadDeepDiveStatus` / `buildConnectionOffer` / `loadFeynmanDone` / `loadWeeklyGoal` → `WeeklyLaunchpadView`（每项 done + kickoff 动作）。ChatThread 空状态顶部「This week」聚合卡：一行状态条（Deep dive ✅/❌ · Connection ✅/❌ · Feynman ✅/❌ · Goal 2/3），点击进入对应流程（复用 `buildDeepDiveKickoff` / 连接卡 kickoff / feynman kickoff / weekly-goal）。

### 3.3 9.4.1 广度「导航」

**文件** `src/lib/breadth-map.ts`、`src/components/LearningDashboard.tsx`

`buildSubjectBridges(mem)`：对每个已掌握技能，看 catalog `adjacent` 技能；当相邻技能属于不同学科且未掌握 → "you know X → try Y over there" 的门；按 (from→to) 去重、最强锚点（最高 pKnown）获胜。输出 `SubjectBridge[]`。LearningDashboard 展示路径，点击未探索节点生成入门问题并跳转聊天。

### 3.4 9.1.3 兴趣「选择 → 作品」闭环

**文件** `useTutorSession.ts`、`ChatThread.tsx`、`TutorShell.tsx`

探索会话末尾检测"喜欢这个话题"信号（outcome correct 且用户文本含 enjoy/like/喜欢 等）→ `creationOffer`。ChatThread 追加轻量卡 "Want to turn it into a mini creation? (draw / write / explain)"，点击跳转 Studio/Journal（复用 `creations-store` / journal 流程）。

---

## 4. P2 — 语言干预精修 + 数据归因

### 4.1 9.1.2 好奇心语言干预

`buildExploreKickoffMessage` 与 `buildDeepDiveKickoff` 的 prompt 固定追加知识缺口指令——"先抛出一个反直觉事实或未解之谜，制造我说'为什么'的冲动，再进苏格拉底阶梯"。理论依据：CURIOBOT（alphaXiv 2026）语言干预可提升 2.4× 探索。

### 4.2 9.4.2 连接卡动态生成

**文件** `src/lib/connection-card.ts`、`TutorShell.tsx`

`buildDynamicConnectionOffer(mem, accountId)`：当 BKT 出现「两个不同学科均已掌握（pKnown ≥ 0.8）」时，锚点改为最近掌握技能对（复用 `buildConnectionOffer` 数据结构），生成跨学科"一个隐藏想法"探索卡。`markConnectionShownForOffer` 每周一次。TutorShell 空状态：动态卡优先级高于周连接卡。

### 4.3 9.4.3 Everyone 作品墙轻互动

**文件** `src/lib/entertain/journal-model.ts`、`journal-store.ts`、`src/app/api/journal/route.ts`、`src/components/JournalTimeline.tsx`

- `JournalEntry.praise?: JournalPraise`（count + notes 每人一条 ≤120 字，无排行榜）。
- `praiseJournalEntry(targetAccountId, id, from)`：点赞/改点评写回；`scope=all` 聚合携带 `authorName`。
- `PATCH /api/journal`：`{ targetAccountId, fromAccountId, id, note }`；禁自赞；失败 400/404。
- JournalTimeline Everyone 视图每张卡加 `PraiseChip`（赞 + 一句话点评），非 Everyone 视图保持删除入口。

### 4.4 9.2.3 快速路径扩容

**文件** `src/lib/local-facts.ts`

扩展 `tryLocalFacts` 覆盖优秀学生常问"为什么"类：常见公式（正方形周长/圆周长面积/三角面积/勾股/立方体积）、比例/百分比速算、学科名词释义、历史时间线速查。全部确定性、本地、中英双语、拒绝歧义输入回退 Agent。

### 4.5 9.3.3 课程序列 vs 对话分离

**文件** `src/lib/explore-catalog.ts`

`planExploreSequence(mem, interests)` / `planOneExploreTopic` 抽成纯函数（规则选主题 + ZPD 起点，不调 LLM）；LLM 只负责对话。`ExplorePlan` = 主题 + zpdSkill + anchorSkills + kickoff。`deep-dive-week.ts` 深潜锚点选择同样为显式两步结构。

### 4.6 核心归因建设

**文件** `src/lib/learning-memory.ts`、`src/lib/parent-digest.ts`、`src/lib/family-report.ts`

- `LearningSource = "opener" | "challenge" | "deepDive" | "connection" | "wrongbook" | "variant" | "explore" | "homework" | "proactive"`。
- `SkillMastery.sourceCounts?` / `lastSource?`；`recordLearningTurnMemory` 接受 `source` 并累计。
- `attributionBySource(mem, now, windowMs)` 聚合周窗口内各机制学习回合数；`sourceLabel` 人读标签。
- `ParentWeeklyDigest.sourceAttribution` + text 中 "Main drivers" 行 → 家长周报回答"这周孩子从哪个机制学得最多"。

---

## 5. Data / Storage

全部新状态走既有 localStorage `browser-kv`，按 accountId 命名空间：

| Key | 用途 |
|-----|------|
| `spark.proactive.<accountId>` | 主动邀请触发/静默状态 |
| 复用 `connectionCardStorageKey` | 动态连接卡每周一次标记 |
| 复用 deep-dive / feynman / weekly-goal keys | Launchpad 聚合 |
| 复用 `wrongAnswerStorageKey` / `interest-store` | 主动出击 + 兴趣反哺 |

`praise` 写入服务器侧 `data/journal/<accountId>.json`（复用 `journal-store` 原子写）。

---

## 6. UI 一览

- ChatThread 顶部：proactive 邀请条（非阻塞、可 dismiss）
- emotionLine 下方：flowMoment 成长时刻行
- 空状态：This week 聚合卡 + 动态连接卡 + 探索主题 chips + 2×2 快速动作卡
- LearningDashboard：学科广度桥梁列表（you know X → try Y）
- JournalTimeline Everyone：PraiseChip（赞 + 一句话点评）
- Family 周报：sourceAttribution 归因条

---

## 7. Testing

- 新增：`proactive-nudge.test.ts`、`weekly-launchpad.test.ts`；扩展 `flow-signals.test.ts`、`explore-catalog.test.ts`、`bkt.test.ts`、`breadth-map.test.ts`、`connection-card.test.ts`、`learning-memory.test.ts`、`parent-digest.test.ts`、`local-facts.test.ts`、`src/app/api/journal/route.test.ts`。
- 全量回归：`npm test` → 1525 passed / 189 files（唯一失败为已知 `console-composer-camera` flaky 测试，按计划跳过）。

---

## 8. Release

- 提交 develop → 合并 master → 推 GitHub 两分支。
- `npm run build`（smart-build.mjs）→ 按既有约定确认在线无客户高峰后 `pm2 restart` → health 检查。
