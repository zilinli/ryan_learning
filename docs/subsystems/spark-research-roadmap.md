# Spark 竞品调研路线图落地（P0→P3）

> 基准报告：`/root/AI教学产品调研与Spark分析报告.md` §9 路线图。
> 状态：全部 12 项已实现（2026-08-13），每项带 vitest 单元测试。

## V2 四维学习飞轮（三阶段）— 全部实现

> 基准报告：`evaluation/Spark_四维学习力深度调研报告_V2_2026-08-13.md` §10 路线图。
> 设计：**[spark-v2-flywheel.md](spark-v2-flywheel.md)**（三阶段飞轮总设计）。
> 状态：P0（主动出击 + 信号转活 + 兴趣反哺）、P1（BKT 先验分层 + 每周 Launchpad + 广度导航 + 兴趣作品闭环）、P2（好奇心干预 + 动态连接卡 + 作品墙 + 快速路径扩容 + 课程序列分离 + 数据归因）全部完成（2026-08-13），1525 单测通过。
> 验收锚点：答错后 AI 主动邀请复盘；连续秒答出现成长时刻；探索主题延续上次兴趣；优秀学生更快上探；每周一屏节奏；广度地图可导航；家长周报含归因。

### V2-P0 — 主动出击 + 信号转活

- `proactive-nudge.ts`：`recentWrongAnswer` / `shouldProactiveInvite`（答错未复盘或闲置 ≥5 分钟触发，每会话一次，dismiss 不骚扰）/ `buildProactiveInviteLine`（"I saw X was a bit tricky — want to spend 2 minutes together?" + "Not now"）。
- `useTutorSession`：`classifyTurnOutcome === "incorrect"` 时 `noteProactiveOpportunity`；暴露 `proactiveInvite` 状态。
- `ChatThread`：顶部非阻塞邀请条（复用 emotionLine 横幅样式），"Let's review" 发送错题复盘 kickoff，"Not now" dismiss。
- **flowMoment**：`recordFlowTurn` 返回 advice 后 `setFlowMoment(flowAdviceLabel(flowAdvice))`；step-up/step-down 追加进 `coachNote` 注入 prompt；ChatThread emotionLine 下方一行成长时刻，可 dismiss，下条消息前自动清除。
- **兴趣反哺**：`pickExploreTopics(mem, limit, interests?)` 评分 = 技能重叠 + 兴趣 count 加权 + 本周已探索主题优先衍生；kickoff 在已知兴趣时加"因为你上次喜欢 X，我准备了它的邻居 Y"。

### V2-P1 — 深度分层 + 每周节奏

- **BKT 先验分层**（`bkt.ts` `bktPriorTier`）：high-prior 学生 pInit/pLearn 更高、pSlip 更低；`detectPriorTier` 由年级超前 / 前置已掌握 / 历史正确率判定；`autoAdvanceCheck` 高先验更灵敏。
- **每周 Launchpad**（`weekly-launchpad.ts`）：聚合深潜 / 连接卡 / Feynman / 周目标 → `WeeklyLaunchpadView`；ChatThread 空状态「This week」聚合卡一行状态条，点击进入对应流程。
- **广度导航**（`breadth-map.ts` `buildSubjectBridges`）：已掌握技能 → `adjacent` 跨学科未探索技能 → (from→to) 去重、最强锚点获胜；LearningDashboard 展示"you know X → try Y"路径，点击跳转聊天。
- **兴趣→作品闭环**（`creationOffer`）：探索会话末尾检测 enjoy/like/喜欢 信号 → ChatThread 轻量卡 "Want to turn it into a mini creation?" → Studio/Journal。

### V2-P2 — 语言干预精修 + 数据归因

- **好奇心语言干预**：`buildExploreKickoffMessage` / `buildDeepDiveKickoff` 固定追加知识缺口指令（先抛反直觉事实或未解之谜，再进苏格拉底阶梯）。
- **动态连接卡**：`buildDynamicConnectionOffer(mem, accountId)` — 双学科各 ≥1 个 pKnown≥0.8 的已掌握技能 → 最近掌握技能对锚点；空状态动态卡优先于周连接卡。
- **Everyone 作品墙轻互动**：`JournalEntry.praise`（count + notes 每人一条 ≤120 字）；`praiseJournalEntry` + `PATCH /api/journal`（禁自赞）；JournalTimeline Everyone 视图 `PraiseChip`（点赞 + 一句话点评）。
- **快速路径扩容**（`local-facts.ts`）：公式（周长/面积/勾股/体积）、百分比速算、学科名词释义、历史时间线速查；中英双语、确定性、命中即返回不走 LLM。
- **课程序列 vs 对话分离**：`planExploreSequence` / `planOneExploreTopic` 纯函数（规则选主题 + ZPD 起点，不调 LLM）；LLM 只负责对话。
- **核心归因**：`SkillMastery.sourceCounts` / `lastSource`（opener/challenge/deepDive/connection/wrongbook/variant/explore/homework/proactive）；`recordLearningTurnMemory` 记录来源；`attributionBySource` 聚合；家长周报新增 `sourceAttribution` + "Main drivers" 行，回答"这周孩子从哪个机制学得最多"。

### 测试（V2）

- 新增：`proactive-nudge.test.ts` / `flow-signals.test.ts`（扩展）/ `explore-catalog.test.ts`（扩展）/ `bkt.test.ts`（扩展）/ `weekly-launchpad.test.ts` / `breadth-map.test.ts`（扩展）/ `connection-card.test.ts`（扩展）/ `journal` route PATCH 测试 / `learning-memory.test.ts`（归因）/ `parent-digest.test.ts`（归因）/ `local-facts.test.ts`（扩展）。
- 全量 `npm test`：1525 passed / 189 files（唯一失败为已知 `console-composer-camera` flaky 测试，按计划跳过）。

## 四维学习力路线图（2026-08-13）— P0/P1 全部 + P2 全部已实现

> 基准报告：`evaluation/Spark_四维学习力深度调研报告_2026-08-13.md`（兴趣/心流/深度/广度四维）。
> 状态：P0（兴趣自主选择回路 · 心流信号采集与难度微调 · 快速路径「问即答」）、P1（每周深度探究日 · 错题→变式→概念提升 · 每周跨学科连接卡 + 学科广度足迹地图）与 P2 体验精修（一键即玩卡片 · 学习/游戏专注护栏 · 领域间自动推荐）全部完成（2026-08-13），带 vitest 单元测试。

### P0.1 — 兴趣自主选择回路（报告 §8.1）

- `explore-catalog.ts`：12 个孩子友好探索主题（`ExploreTopic`），每条映射到既有 `SkillDef`，提供 ZPD 语境化 kickoff（`buildExploreKickoffMessage`）。
- `interest-store.ts`：`recordInterest` / `recentInterests`（localStorage，按账号命名空间），形成「兴趣档案」，供开场卡与 Me 页展示。
- `ChatThread` 空状态渲染「Today, I want to explore…」主题 chips；点击 → 新会话自动发送探索 kickoff。

### P0.2 — 心流信号采集 + 难度动态微调（报告 §8.2 / §9.2.1）

- `flow-signals.ts`：`FlowState` 追踪连对/连错/快答/慢答；`flowAdviceFor` 输出 step-up / step-down / hold；`recordFlowTurn` 按 `answerLatencyMs` 与正确性更新。
- `TutorShell` 计算每条助理回复的 `answerLatencyMs` → `recordFlowTurn`；`challenge-mode.ts` 消费 flow advice：快答连对升档更快，慢答/犹豫累计触发降档。
- `challengeGauge`：孩子可见的掌握度进度条（`ChallengeLevel` + `growthLine`「成长时刻」话术）。

### P0.3 — 快速路径扩容到「问即答」（报告 §8.2）

- `local-facts.ts` 扩容：`tryArithmeticTable`（小算术表）、`tryTemperature`（摄氏/华氏互转）、`tryFractionDecimal`（常见分数小数）、`tryShapesFormulas`（矩形/正方形周长面积）、`tryDoubleTriple`（双倍/三倍）。全部确定性、本地、中英双语，拒绝歧义输入回退 Agent。

### P1.1 — 每周深度探究日（报告 §8.3 / §9.3.1）

- `deep-dive-week.ts`：`DEEP_DIVE_DAY`（本地每周三）；`pickDeepDiveAnchor` 从错题/掌握技能选锚点；`buildDeepDiveOffer` 生成 5E 结构 kickoff（Engage/Explore/Explain/Elaborate/Evaluate）；`markDeepDiveDone` 每周一次。
- `ChatThread` 每周深度项目卡（`--coral` 强调），支持 Start / Not today。

### P1.2 — 错题 → 变式 → 概念提升自动路径（报告 §8.4 / §9.3.2）

- `wrong-answer-store.ts`：`WrongAnswerAction = "variant" | "harder"`；`buildVariantKickoffMessage` 生成「换数字变式 / 升半级概念提升」kickoff；`stashVariantKickoff` / `consumeVariantKickoff` 单次交接。
- `WrongAnswerBook` 每条错题新增两个按钮：**Variant — new numbers** / **Harder — level up**，点击后回到空聊天自动开新会话。

### P1.3 — 每周跨学科连接卡 + 学科广度足迹地图（报告 §8.5 / §9.3.4）

- `connection-card.ts`：`CONNECTION_CARDS` 每周确定性选卡；`buildConnectionOffer` + `markConnectionShown`（每周一次）。
- `breadth-map.ts`：`buildBreadthFootprint` 输出 `SubjectFootprint[]`（已探索/未探索 + 各科锚点）；`stashSubjectStarter` / `consumeSubjectStarter` 一键把学科起点交接到聊天。
- `LearningDashboard` 新增「Your subject map」与「Your exploration footprint」区块。

### 测试

- 新增：`flow-signals.test.ts` / `explore-catalog.test.ts` / `interest-store.test.ts` / `deep-dive-week.test.ts` / `connection-card.test.ts` / `breadth-map.test.ts`；扩展 `local-facts.test.ts` / `challenge-mode.test.ts` / `wrong-answer-store.test.ts`。

## 四维学习力路线图（P2 体验精修）— 全部 3 项已实现

> 基准报告同 `Spark_四维学习力深度调研报告_2026-08-13.md` §10 第三阶段（体验精修）。
> 状态：9.1.2 一键即玩卡片、9.2.3 学习/游戏专注护栏、9.4.3 领域间自动推荐全部完成（2026-08-13），带 vitest 单元测试。
> 已完成无需重做：9.1.3 兴趣足迹可视化（`LearningDashboard`「Your exploration footprint」）、9.3.3 成长时刻标注（`challengeGauge.growthLine`）。

### P2.1 — 一键即玩卡片（报告 §9.1.2）

- `ChatThread` 空状态把原有文字按钮行升级为 **2×2 即时动作卡片网格**（`QuickActionCard`）：`⚡ Quick questions` / `🔀 Another topic` / `🏆 Challenge me!` / `📷 Snap homework`，每卡含 emoji 图标 + 标题 + 一句说明，点击直接触发既有 `onOpenerTry` / `onOpenerNext` / `onChallenge` / `onSnapHomework`。
- 探索主题 chips（`exploreTopics`）上浮到卡片网格上方，点击即发，无需打字。
- 卡片视觉：`--teal` / `--coral` 语义色 + 触摸目标 ≥ 44px，保持 `max-w-md` 空状态与移动优先。

### P2.2 — 学习/游戏专注护栏（报告 §9.2.3）

- `focus-guardrail.ts`：
  - `activeWorksheetPlan(accountId?, conversations?, activeId?)` — 从当前账号的 active conversation 读取 `worksheetPlan`（复用 `isWorksheetComplete` / `formatProgressLabel`），返回 `{ total, current, remaining }` 或 null。
  - `buildFocusGuardrail` — 生成非阻断文案（"Homework still has N questions — finish, then play?"），**不锁、不罚**。
  - `dismissFocusGuardrail(accountId)` / `dismissedFocusGuardrailToday(accountId)` — 当天轻提示只出一次，尊重自主。
  - `resolveGuardrailAccountId` — 账号解析：显式 → URL `?account=` → 活动账号 store → `acct_ryan`。
- `HistorySidebar` Games 链接旁：存在未完成 worksheet 且今日未 dismiss 时渲染一行非阻断提示条（含 Back to homework / Not now），不拦截跳转。
- `EntertainPage` Games hub 顶部（`activeGame === null` 时）渲染同一护栏横幅，含「Back to homework」与「Not now」。
- 数据读取跨页面共用：护栏数据直接从 localStorage（当前账号 active conversation record）读取，`/entertain` 独立页面也能读到。

### P2.3 — 领域间自动推荐（报告 §9.4.3）

- `skill-catalog.ts`：`SkillDef` 新增可选 `adjacent?: string[]`（相邻技能 id）。已为高分技能补齐相邻关系：分数→比例、等值分数→比例、几何测量→物理/体积、天文→物理/生态、生态→生物/环境、代数 I→物理、统计→科学方法/代数、化学→物理/生物、物理→天文/几何、议论文→文本分析、文本分析→议论文、古代文明→世界史、世界史 II→美国史 等。
- `adjacent-recommend.ts`：
  - `recommendAdjacent(mem)` — 找 pKnown≥0.8 的高掌握技能 → 取其 `adjacent` 中未掌握技能 → 优先「未触碰」再「跨学科」→ 返回 1 个 `{ fromSkillId, fromLabel, skillId, label, line }`。
  - `buildAdjacentKickoffMessage(rec, mem)` — 生成「你已掌握 X，要不要顺路看看邻居 Y？」的 ZPD 入门 kickoff。
  - `buildAdjacentOpener(mem)` — 包装为 `SessionOpener`（`kind: "zpd"` + `kickoffOverride`）。
- `TutorShell` 空状态 `useEffect`：`messages` 为空时尝试 `buildAdjacentOpener`；`ChatThread` 在 `sessionOpener` 为空时渲染「A neighbor to explore」卡片，点击发送 kickoff。

### 测试（P2）

- 新增：`focus-guardrail.test.ts`（未完成→剩余数 / 已完成→null / 无计划→null / 单复数文案 / 今日 dismiss 门控 / 多账户隔离）、`adjacent-recommend.test.ts`（高掌握→推荐相邻未掌握 / 无相邻→null / 优先未触碰 / 跳过已掌握 / 空记忆 / kickoff 含双技能名 / zpd opener 包装）。
- 扩展：`skill-catalog.test.ts`（所有 `adjacent` 引用必须是真实技能且不自指；fractions→ratios 与 earth-moon-sun→physics 等头条配对）。

## 新增需求（优先）

### R.0 — Me 时间线删除单条记录

- `journal-store.ts` 新增 `removeJournalMadeBlock(accountId, entryId, creationId)`：
  仅移除对应 `made` 块；若 entry 仍剩正文保留卡片，否则整条删除。
- `DELETE /api/journal` 支持可选 `creationId`（不影响 My Creations 中的创作本身）。
- `JournalTimeline.tsx` 每张 Wrote/Empty day/Related 卡加 `DeleteChip`（两击确认：首次变「Sure?」）。

#### R.0b — 删除控件可发现（触屏）

**Problem:** R.0 的垃圾桶默认 `opacity-0`，仅 `group-hover` / focus 可见；手机/平板无 hover，孩子感觉「没有删除」。

**Approach:** 与 My Creations 一致——常显文案按钮（图标 + Delete/Remove）；保留两击确认；触摸目标 ≥44px；卡片标题留右内边距避免重叠。

**Key files:** `src/components/JournalTimeline.tsx`（`DeleteChip`）

**Risks:** 误触 → 两击 + 4s 自动取消；删除不可恢复 → 文案明确。

**Test design:**
- Unit: 已有 `journal-store` / `DELETE /api/journal`（不变）。
- Manual: Me peek + `/me/journal` 在触屏上每张卡右上角可见 Delete；点一次 Sure?，再点后条目消失。

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
