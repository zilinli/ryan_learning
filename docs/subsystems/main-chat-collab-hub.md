# Spark 主对话框协作中枢(Design)

> Date: 2026-08-16 · Status: implemented
> Source: 「Spark 主对话框协作中枢实现计划」

## 目标

把主对话框从"纯对话"升级为**协作中枢**:LLM 通过隐藏 fence 自动识别四类需求,在对话流内直接内嵌对应能力,并把 Lab 挑战带回对话继续讨论。

| 形态 | 触发 | 渲染 |
| --- | --- | --- |
| 写作 | `~~~intent {"kind":"writing"}` | InlineWritingPanel(BASIS 四维评分 + 逐句修复 + mentor + 保存日记 + 一键转媒体) |
| 媒体 | `~~~intent {"kind":"media"}` | InlineMediaPanel(structure → `/api/studio/generate` 三态生成) |
| 游戏 | `~~~intent {"kind":"game"}` | InlineGamePanel(内嵌学习游戏,不跳转) |
| Lab | `~~~intent {"kind":"lab"}` | LabRecommendCard(推荐卡 → `/studio?game=<id>` 跳转) |

## 意图检测

### `src/lib/intent-fence.ts`

- `parseIntentFence(text)` / `stripIntentFence(text)`:解析 `~~~intent {json} ~~~`(inline)与 block 两种形态,仿 `worksheet-plan` fence。最后一条有效 fence 生效。
- `detectIntentFromText(text)`:前端关键词兜底(改作文→writing;做首歌/生成图片→media;无聊/想玩→game;想看视频→lab)。
- 单元测试 `intent-fence.test.ts`(12 例)。

### `src/lib/prompts.ts` 注入

在 tutor 规则区新增「Collaboration intents」:当学生明确想要写作/创作/放松/阅读时,允许在回复末尾输出**至多一条**隐藏 fence。fence 不朗读、不向学生解释;正常回复必须自洽完整。

## 前端面板

### InlineWritingPanel(`components/tutor/`)

- 草稿:优先 intent fence 的 `text`,否则最近一条用户消息。
- `POST /api/writing-studio/coach {action:"coach"}` → 复用 `WritingCoachPanel` 渲染 BASIS 评分。
- 逐句修复:复用 `buildWritingFixIssues` + `WritingFixDialogue`。
- mentor 对话:复用 `WritingMentorDialogue`(action:"mentor")。
- 保存:`POST/PUT /api/journal`(当日日记)。
- 「Make it into…」song/image/video → 交给 InlineMediaPanel。

### InlineMediaPanel(`components/tutor/`)

- 先 `action:"structure"`(歌词/视觉提示词),再 `POST /api/studio/generate`,三态 UI(结构→生成中→done/error),成功自动入 My Creations。

### InlineGamePanel(`components/tutor/`)

- 内嵌学习游戏(`h-[60vh]` 容器 + 内部滚动 + Fullscreen 链接)。游戏组件自包含,经 `recordStudioLearningTurn` 自动回写 BKT。
- 推荐由 `src/lib/game-recommend.ts`(关键词路由)给出。

### LabRecommendCard(`components/tutor/`)

- 推荐卡(标题 + 一句话 + 跳转按钮 `href=/studio?game=<id>` + Not now),渲染位置同 creationOffer 卡片。
- 推荐由 `src/lib/lab-recommend.ts`(主题 → 最佳 Lab)给出。

## Lab 双向回环(写入端激活)

- **TED**:`TedLab.tsx` 内联讨论区新增「Continue in the main chat」→ `stashTedChallengeKickoff` + `stashTedChallengeResume`,跳回 `/`。主对话 `consumeTedChallengeKickoff` 自动发送 `buildTedChallengeKickoffMessage` 开始苏格拉底讨论;`detectTedCoherenceSignal` 后出 tedReturn 横幅回 Lab。消费端早已就绪(useTutorSession),本次补齐写入端。
- **BBC / NatGeo / RSA**:新增 `src/lib/entertain/lab-challenge-handoff.ts`(仿 TED 结构,含 kickoff 构造/解析/coherence 检测),`MediaLabChallengeView.tsx` 加同一按钮。主对话侧在 useTutorSession 的 TED handoff 消费旁并行消费 `labChallengeKickoff`。

## 主对话接线

- `useTutorSession.ts`:
  - assistant 消息完成时 `parseIntentFence(fullText)` → `setCollabOffer({intent, draft, gameRecommendation?, labRecommendation?})`。
  - TTS 朗读用 `stripIntentFence`(渐进 buffer diff),fence 不读出。
  - pinned 内容用 `stripIntentFence` 后入库。
  - `handleDismissCollab` 关闭;新会话/切换会话清空。
- `ChatThread.tsx`:`stripHiddenFences` 追加 `stripIntentFence`;`CollabPanels` 组件按 intent.kind 渲染四种面板/卡片(media 未指定 kind 时先开写作面板,再转媒体)。
- `TutorShell.tsx`:透传 `collabOffer` / `onDismissCollab`。

## 测试

- `intent-fence.test.ts`、`game-recommend.test.ts`、`lab-recommend.test.ts`、`lab-challenge-handoff.test.ts` 全部通过(42 例,含既有 worksheet-planner)。

## 部署

`build`(smart-build.mjs)→ pm2 startOrReload → health 检查。
