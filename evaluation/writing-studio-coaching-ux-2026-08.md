# Writing Studio · Feedback & Coaching 体验深度分析报告

> **项目**：Spark AI Tutor（`codes/ryan_learning`）
> **页面**：`/studio?game=writing-studio` 写作工作室
> **目标用户**：国际学校（BASIS 体系）优等学生
> **报告日期**：2026-08-15
> **范围**：重点分析 Feedback 与 Coaching（辅导）部分；Lab Discussion 作为次级发现
> **方法**：代码走查 + 竞品桌面调研（2026-08）+ 人机交互（HCI）研究文献对照

---

## 目录

1. [背景与核心问题](#1-背景与核心问题)
2. [目标用户画像：BASIS 优等生](#2-目标用户画像basis-优等生)
3. [现状诊断：Feedback / Coaching 流程走查](#3-现状诊断feedback--coaching-流程走查)
4. [竞品调研：市面上最好的 AI 写作辅导产品](#4-竞品调研市面上最好的-ai-写作辅导产品)
5. [关键设计规律提炼](#5-关键设计规律提炼)
6. [差距分析：Spark 与成熟设计的对照](#6-差距分析spark-与成熟设计的对照)
7. [改造建议（按优先级，映射到代码）](#7-改造建议按优先级映射到代码)
8. [验收指标](#8-验收指标)
9. [风险与对策](#9-风险与对策)
10. [结论](#10-结论)

---

## 1. 背景与核心问题

### 1.1 用户反馈（原话要点）

> "主要是 spot 出来之后，辅导部分问的问题不止回答之后怎么修改" —— 即：**Spots（局部问题）标注出来之后，Coaching 部分的提问只停留在问答层面，答完之后学生依然不知道具体该怎么改**。问答与修改之间的桥接是断裂的。
>
> "另外各种 lab 的 discussion 也有类似的情况，但是那个可能还勉强能说过去" —— Lab（BBC/RSA/NatGeo/TED）的 Socratic 讨论存在同类问题，但因上下文不同（讨论目的是训练推理而非修改文本），尚可接受，作为次级发现处理。

### 1.2 核心结论（先行摘要）

对当前写作工作室的走查发现，Feedback/Coaching 部分存在 **5 个结构性体验问题**：

| # | 问题 | 严重度 |
|---|------|--------|
| P1 | **问答不收敛**：Mentor 对话被 prompt 强制"永远以一个问题结尾"，没有通向修改的出口 | 高 |
| P2 | **Spot 修改桥接断裂**：学生回答的内容被直接替换进文本（`applyWritingFix` 粗暴 substring 替换），可能产生病句；无预览、无解释、无对比 | 高 |
| P3 | **三个反馈表面并存**：评分报告面板 / Mentor 聊天 / Spot 修复对话 三套 UI 同时存在，学生不知道用哪个、如何衔接 | 中高 |
| P4 | **评分维度与行动脱钩**：维度 tip、evidence 引用、fix issue 三者互相独立，不能从"分数"跳到"具体改哪里" | 中 |
| P5 | **缺少"答 → 改 → 看 → 重评"闭环**：没有修改前后对比、没有进度感、没有"改完再 Coach 一次看分数变化"的回路 | 中高 |

市面上成熟产品（Write & Improve、Turnitin Draft Coach、NoRedInk Guided Drafts、Khanmigo Writing Coach、以及 HCI 研究原型 Critical Inker / Writor）已经验证了解决这类问题的成熟范式：**问题必须锚定在具体文本上，且对话必须能收敛为一个可执行、可预览、可撤销的文本修订**（"verbalize → comment marker → revision"）。

---

## 2. 目标用户画像：BASIS 优等生

BASIS Independent Schools 体系的关键特征（据官网课程指南）：

- **加速课程**：Honors 是最低层级，大量课程直接对标 AP（9 年级起修 AP）；需要跨文体分析性写作（literary analysis、argumentative、rhetorical analysis）。
- **毕业要求**：Honors Diploma 需要 Capstone 课程 B- 以上；强调"多稿写作、基于研究分析、独立探究"。
- **学习者特质**：高能力、高自主、擅长且习惯于深度思考；对"无目的摩擦"容忍度低——如果提问不能让他们的文章实际变好，提问会被视为"玩具"；同时，对"AI 直接代写"有真实的学术诚信敏感（BASIS 校规对 AI 使用严格）。

对这类学生的辅导设计含义：

1. **苏格拉底式提问必须是有价值的摩擦（productive friction）**：问题要尖锐、具体、锚定文本，并且回答之后要能看到"这篇文章确实在变好"。
2. **尊重作者主体性**：不代写、不灌输；但必须提供"把思考转化为修订"的清晰通路（preview → apply → undo）。
3. **要挑战感，也要进度感**：优等生需要明确的目标、进度、以及"重评后分数变化"的正反馈闭环。

---

## 3. 现状诊断：Feedback / Coaching 流程走查

### 3.1 当前信息流（代码还原）

```
写Pad → 停顿3.2s(≥40字符) 或 手动点 Coach
      → POST /api/writing-studio/coach (action=coach)
      → 返回 { coach(text), report(BasisCoachReport) }
      → applyCoachResult() 落地三件事：
          1. setCoachReport()  → 渲染 WritingCoachPanel（评分报告）
          2. buildWritingFixIssues() → 生成 ≤8 个 Spot fix 队列
          3. openMentor=true → 打开 WritingMentorDialogue（Mentor 聊天）
```

三个 UI 表面：

| 表面 | 组件 | 内容 |
|------|------|------|
| 评分报告 | `WritingCoachPanel` | 总分环形图 + headline + 词/句统计 + "Think with Spark"首问 + 四维度 tips（可折叠） |
| 辅导对话 | `WritingMentorDialogue` | 聊天：opener = 表扬+一个问题；每答一问，Coach 再回"表扬+一个新问题" |
| 局部修复 | `WritingFixDialogue` | 逐条 Spot：问题 + placeholder + Apply（把回答替换进文本）+ Skip |

### 3.2 问题 P1：问答不收敛，永远"还有一个问题"

Mentor 的 prompt 是问题根源：

```161:166:src/lib/entertain/basis-mentor-session.ts
    "1) Specific praise for ONE thing in THEIR reply first (use their words);",
    "2) ONE clarifying question about feelings, detail, or clarity;",
    "3) At most ONE tiny craft nudge using THEIR words — never rewrite their sentence for them;",
    "4) STOP and wait. End with exactly one clear question.",
    "Never dump a scored report. Never rewrite the whole draft. Never be babyish.",
```

- 每一轮都强制"以一个问题结尾"，**对话没有内置收敛条件**，只有当模型自己觉得"reasoning holds together"才可能结束——而这在 Mentor 流程里甚至没有对应的指令（Lab 讨论里才有 `coherent` 检测）。
- 本地兜底 `localMentorReply` 同样是"再抛一个问题"：

```126:131:src/lib/entertain/basis-mentor-session.ts
  const followUps: Record<BasisDimensionId, string> = {
    topic: `Good — hold onto “${their}”. Now: what feeling belongs to that moment, in one word?`,
    detail: `I can almost see “${their}”. What sound or smell sits next to it?`,
    vocab: `“${their}” is sharper. Can you swap one more filler word nearby for something only you'd say?`,
    grammar: `Clearer. Read that line aloud once — where do you want to pause or end it?`,
  };
```

**学生体验**：答了三轮问题，每次得到的都是一个新的问题，看不到"这跟我改文章有什么关系"。唯一的桥接是聊天框下方的"Add last answer to pad"（把上一条回答原样追加为 pad 新一行），既隐蔽，又只是"追加"而非"修改"：

```157:171:src/components/WritingMentorDialogue.tsx
  const appendLastIdea = () => {
    const lastYou = [...turns].reverse().find((t) => t.role === "you");
    if (!lastYou) return;
    const chunk = lastYou.text.trim();
    if (!chunk) return;
    onDraftChange(draft.trim() ? `${draft.trimEnd()}\n${chunk}` : chunk);
```

对一个优等生来说，"我把想法说出来 → 它只是被堆到文章末尾"不是写作辅导，而是聊天玩具。

### 3.3 问题 P2：Spot 修改桥接断裂（答非所改）

Spot 修复的核心逻辑在 `basis-fix-session.ts`。提问模板：

```96:121:src/lib/entertain/basis-fix-session.ts
  if (dim === "topic") {
    return {
      question: `Your opening feels fuzzy${quoted ? ` (“${quoted}”)` : ""}. In one concrete sentence: what is this piece mainly about — who, where, what moment?`,
      placeholder: "e.g. After the fight I walked home alone in the rain…",
    };
  }
  if (dim === "detail") {
    return {
      question: tip.includes("camera")
        ? tip
        : `“${quoted || "this line"}” is vague. Replace it with one detail a camera could film (object + action).`,
      placeholder: "e.g. washing dishes at the kitchen sink",
    };
  }
```

回答会被**原样替换**进文本：

```253:277:src/lib/entertain/basis-fix-session.ts
/** Apply student reply: replace the issue span (or append if span missing). */
export function applyWritingFix(
  draft: string,
  issue: WritingFixIssue,
  studentReply: string,
): string {
  const reply = studentReply.trim().replace(/\s+/g, " ");
  if (!reply) return draft;

  // Prefer exact index if still matches
  if (
    issue.start >= 0 &&
    issue.end <= draft.length &&
    draft.slice(issue.start, issue.end) === issue.span
  ) {
    return `${draft.slice(0, issue.start)}${reply}${draft.slice(issue.end)}`;
  }
```

**问题演示**（detail 维度）：原句 `I like the thing about school`，spot 标出 `thing`，学生按提示回答 `washing dishes at the kitchen sink`，应用后得到：

> `I like the washing dishes at the kitchen sink about school` ❌

- 替换是按**字符 span** 进行的，而提问要求的是"一个可拍摄的细节短语"，两者维度不匹配（单词 vs 短语 vs 整句）。
- **没有修改预览**：应用前看不到合并后的句子效果。
- **没有解释**：学生不知道 AI 认为这里哪里不好、为什么这样改可以。
- **没有撤销/对比**：改错无法回退，也无法对比 before/after。
- 位置 remap 也依赖字符串精确匹配（`draft.indexOf(i.span)`），学生先改了别处导致文本漂移后，后续 fix 会失效：

```109:114:src/components/WritingFixDialogue.tsx
      const remapped = nextIssues.map((i) => {
        if (i.status !== "open" || !i.span) return i;
        const idx = nextDraft.indexOf(i.span);
        if (idx < 0) return i;
        return { ...i, start: idx, end: idx + i.span.length };
      });
```

### 3.4 问题 P3：三个反馈表面并存，认知负担高

- Coach 完成时 `applyCoachResult` 会同时准备报告、fix 队列，并自动打开 Mentor 聊天：

```315:335:src/components/WritingStudio.tsx
      if (opts?.openMentor) {
        const draftSnap = draftRef.current.trim();
        const force = opts.forceNewSession === true;
        const midChat = mentorUserActiveRef.current && mentorOpenRef.current;
        if (force || !midChat) {
          if (
            force ||
            !mentorOpenRef.current ||
            draftSnap !== lastAutoMentorDraftRef.current
          ) {
            setMentorSessionKey((k) => k + 1);
            lastAutoMentorDraftRef.current = draftSnap;
            setMentorUserActive(false);
          }
          setMentorOpen(true);
          setFixOpen(false);
          setShowHighlights(false);
          setMobileTab("feedback");
          padTextareaRef.current?.blur();
        }
      }
```

- 于是 Feedback 面板里同时存在：报告面板（含"Think with Spark"问题和"Answer in coach chat"按钮）、Mentor 聊天（又一个问题）、右上角 Spots 计数按钮（又一套对话）。三个入口都是"问问题"，但它们的**分工、衔接、优先级完全不可见**。
- 移动端下每次停顿自动 Coach 还会 `setMobileTab("feedback")` + `blur()`，打断正在写作的流程。

### 3.5 问题 P4：评分维度与行动脱钩

- `WritingCoachPanel` 中每个维度有 score、tip、evidence 引用，但点击维度不会跳转到对应文本位置，也不会打开对应的 Spot 修复。
- `report.questions`（Think with Spark 首问）与 fix 队列是两套独立生成的逻辑（`buildQuestions` vs `coachQuestion`），学生可能在报告里看到一个话题、聊天里被问另一个话题、Spots 里又处理第三个。

### 3.6 问题 P5：缺少"改 → 看 → 重评"闭环

- 修完 8 个 Spot 或答完聊天后，系统只说"Nice — N fixes applied to the Writing Pad. Stage it when ready"，**没有让分数/维度重新滚动的路径**。
- 虽然后端在 draft 变化 3.2s 后会重新自动 Coach，但 Mentor 聊天被 `mentorUserActive` 保护不再重置，评分变化也**没有任何视觉提示**（没有进度图、没有"分数从 3.2 → 3.8"）。
- Write & Improve 的"写 → 反馈 → 改 → 重交 → 看进度图"循环、Turnitin Draft Coach 的"Run Check → 改 → Run New Check"语义在本产品中缺失。

### 3.7 次级发现：Lab Discussion 同类问题（可接受但可改进）

- `lab-discuss.ts` 的 `discussReplyAgentPrompt` 同样"Ask at most ONE question"，本地兜底 `buildLabDiscussReplyLocal` 也以一个问题结尾。
- 出口依赖 `detectTedCoherenceSignal` 在 AI 回复中做关键词检测（`coherent` 状态），判定"thinking holds together"后点亮 "Ready — next question"。
- 因为是"讨论推理"而非"修改文本"，问答即目的，所以"勉强能说过去"。但学生仍然缺乏**可见的推理 checklist / 进度**和**明确的可达成的出口标准**。

---

## 4. 竞品调研：市面上最好的 AI 写作辅导产品

### 4.1 产品版图（按"反馈定位"分类）

| 类别 | 代表产品 | 反馈粒度 | 是否代写 | 修改闭环 |
|------|----------|----------|----------|----------|
| 即时机制修正器 | Grammarly、Turnitin Draft Coach (Grammar Guide)、LanguageTool | 词/句级、即时、锚定文本 | 直接给建议，一键应用 | 弱（接受即改） |
| 间接提示式教学 | Write & Improve（剑桥）、NoRedInk | 句级高亮 + 提示（不给正确答案） | 否，要求学生自己改 | 强（重交 + 进度图） |
| 量规对齐评分反馈 | Writable、EssayGrader/CoGrader、Khanmigo Writing Coach、GradingPen | 维度/量规级，带证据引用 | 混合 | 中 |
| 苏格拉底脚手架研究原型 | **Critical Inker**（MIT）、**Writor**、FeedbackWriter、Friction | 论证级，锚定具体论断 | 严格不代写 | 强（verbalize→修订标记） |
| 文档内协作 | Google Gemini in Docs、"Help me write"、Notion AI | 段落级重写建议 | 是（可拒绝） | 中 |

### 4.2 逐产品深度分析（与本次痛点最相关）

#### (a) Write & Improve（剑桥大学）—— 间接反馈 + 重交循环

- **设计哲学**："It's a practice environment, not a text editing facility."（不是编辑器，是练习场）。
- **间接、半纠正式的反馈**：不给"别这么做，要这么做"，只标注"这里需要你注意 + 为什么"，**没有正确答案**，要求学习者自己决定怎么改。
- **控制反馈量**：算法"非常谨慎，只标记 90% 确信的问题"，避免红笔过多的挫败感。
- **循环**：`Write → Submit → 句级高亮 + 错误反馈 + 与 prompt 相关性评分 + CEFR 等级 → 修改 → 重新提交 → 分数与反馈更新`。
- **进度**：最近 10 次提交的**进度图**（progress graph），让学生看到自己在变好。

> **对 Spark 的启示**：① 机制类问题（语法/拼写）用"提示而不是答案"、句级高亮；② 必须显式提供"改完再提交看分数变化"的循环；③ 用进度图给优等生"变强"的实证。

#### (b) Turnitin Draft Coach —— "Run Check → 看问题 → 解释 → 改 → 重跑"

- 在 Google Docs/Word Online 中以侧边栏存在：Similarity / Citations / Grammar 三种检查。
- **语义**：每次点击问题 → 看到详细解释 + 修改建议 → 改完 → **Run New Check** 重跑。Sim 检查每个文档限 3 次，刻意鼓励"改到差不多再查"。
- 结果私有、不提交给老师，定位是"形成性学习工具"。

> **对 Spark 的启示**：① "Run / Re-run" 的显式语义让修改循环可被学生主动控制；② 问题列表 + 点击进解释 + 建议，是最直接的问题呈现方式；③ 限次策略可以转化为"重点检查配额"。

#### (c) NoRedInk Guided Drafts —— 分块写作 + 版本化修订

- 学生按**构件**（引言/论点/主体段/结论）逐块写，左栏一直可见 rubric、tutorials、exemplars、tips（just-in-time scaffolding）。
- 教师可"**Send back for revisions**"把稿件退回给学生，学生修订后再交；系统保留**多版本历史**（dropdown）。
- 题外话：NoRedInk 的差异化在于"让学生理解为什么对，而不是接受改正"。

> **对 Spark 的启示**：① 反馈按写作构件/维度组织；② 明确"修订轮次"（revision round）概念与版本历史；③ 脚手架（tips/exemplars）与写作面板并置。

#### (d) Khanmigo Writing Coach（Khan Academy）—— 锚定文本的苏格拉底

- 核心演示："Does my evidence support my claim?" → AI 不只给反馈，还**高亮文章里的具体段落**并说 *"On this passage, this doesn't quite support your claim… can you tell us why?"* —— **问题严格锚定到具体文本片段**。
- 反馈对齐标准（structure / clarity / evidence），不只语法；教师端实时追踪进度、标记需要介入的学生。
- "It doesn't give them information they should research themselves. It doesn't provide content. It DOES help them organize their writing and allows them to ask questions."（教师原话）。

> **对 Spark 的启示**：苏格拉底问题可以保留，但**必须高亮对应的文本片段**，让学生知道"问的就是这里"。

#### (e) Grammarly / ProWritingAid —— 即时、锚定、可应用

- 即时下划线 + 点击看解释 + 一键接受/忽略；ProWritingAid 提供全文档报告（多维度）与逐条解释。
- 局限（NoRedInk 的评价）："Grammarly corrects writing rather than teaching it"——学生学会接受建议而非理解建议。

> **对 Spark 的启示**：机制类反馈用"即时 + 锚定 + 可应用"；但不要用这个模式处理结构/观点类问题。

#### (f) Writable / EssayGrader / CoGrader / GradingPen —— 量规对齐 + 证据引用

- 教师端批量按 rubric 打分，反馈锚定到评分依据（evidence quote）；部分产品给学生端 tutoring portal。

> **对 Spark 的启示**：BASIS 场景应把 rubric（topic/detail/vocab/grammar）与**证据引用**严格对应——"这段 evidence 导致了 2 分"，而不是给一个孤立的分数。

#### (g) 研究原型：Critical Inker（MIT，CHI 2026）—— 与本问题**最直接相关**

论文验证了用户投诉的正是其设计要解决的张力：

> "the Socratic Chatbot ... occasionally introduced friction by asking questions the user felt were already addressed."

其关键设计（直接对治 Spark 的 P1/P2）：

1. **问题锚定到具体论证关系**：不问泛泛的 "Is this claim supported?"，而是 *"You claim X because Y — but how does Y actually support X?"*。
2. **一次只处理一个问题**（progressive disclosure），配**进度条**。
3. **言语化要求（verbalization requirement）**：只在学生**自己说出问题所在**之后，系统才把学生的意图**转换为锚定在文本上的评论标记（comment marker / revision reminder）**：

> "Only after users verbalize the issue does the system add a comment marker as a revision reminder. A progress indicator shows completion across all identified issues."

4. **双模式**：Visual Feedback（直接红线 + 解释，可点开论证树）与 Socratic Chatbot（逐条引导）。**同一套分析、两种呈现**，让不同偏好的学生各取所需。

> **对 Spark 的启示**：这正是"问答→修改"断裂缺失的那一环——**回答之后系统应把回答凝练成一个可应用的修订标记（预览 → 确认 → 落进文本 → 打勾计入进度）**。

#### (h) 研究原型：Writor（写作中心教学法）—— 不代写但给读者视角

基于 10 位写作中心导师访谈 → 7 条设计准则，其中与本次直接相关的：

- **G1 具体表扬建立信心**：'I feel it's a bit abrupt that your paragraph starts directly with stats.' / 'Oh, I wanted them to pop!'——表扬要具体到作者的选择。
- **G4 读者视角反馈**：以读者身份表达"我读到这里以为……"，让学生获得受众意识。
- **G3 例子与类比**：用比喻/示例支撑过程，而非直接写内容。
- **G6 对话锚定文本**、**G7 询问作者想改什么**。
- 导师铁律：**一次最多给 4 个连续词**，强制保留作者声音。

> **对 Spark 的启示**：表扬锚定"作者自己的选择"（当前 `buildMentorPraise` 已部分做到）；提问应改为**读者视角**；且反馈系统应主动问学生"你想先改哪一块"（author intent），而不是系统自顾自排队。

#### (i) 研究原型：FeedbackWriter / Friction —— 量规锚定 + 可操作修订计划

- FeedbackWriter：每个 rubric 条目在文内**锚定一条反馈**；已满足的条目给表扬；未满足的用苏格拉底式提示；用户对建议拥有 adopt/edit/dismiss 的完全控制。
- Friction：跨草稿**可视化所有反馈**，帮助作者**排优先级并规划可执行的修订计划**。

### 4.3 面向"国际学校优等生"的产品定位参考

- 针对高能力学习者的产品普遍放弃"保姆式"与"无限问答"，转向：**挑战性任务 + 自主控制 + 深度反馈 + 显式进度**。
- BASIS 体系要求 AP 级分析性写作，意味着反馈需对齐**论证结构**（claim → evidence → reasoning），而不仅是语法与词汇（当前 Spark 的 4 维度里 `topic` 与 `detail` 已经贴近，但 UI 没有把论证结构可视化出来）。

---

## 5. 关键设计规律提炼

综合竞品与文献，写作辅导 Feedback/Coaching 的成熟范式可归纳为 7 条：

1. **反馈必须锚定文本（Text-anchored）**：每条反馈对应具体 span；支持"标记 ↔ 解释 ↔ 修改"三向跳转（Khanmigo 高亮 + 问题、Draft Coach 问题列表、Critical Inker 评论标记）。
2. **苏格拉底问题必须能收敛为修订（Socratic → Revision）**：`verbalize（说出问题）→ 生成评论/修订标记 → 预览 → 应用到文本`。对话不允许无限延长（Critical Inker、Writor G6/G7）。
3. **闭环 + 进度感（Loop + Progress）**：`改 → 重评 → 分数/进度变化`（W&I 进度图）；issue 级进度条（Critical Inker）；版本历史（NoRedInk）。
4. **一次一个问题，渐进披露（Progressive disclosure）**：不要 8 个 issue 一起压上来；每个问题有明确的当前 focus（Critical Inker 一次一条论证链）。
5. **摩擦必须是"有价值的摩擦"（Productive friction）**：对优等生尤其如此——问题必须尖锐、锚定、回答后能看到文章变好，否则就是玩具。
6. **解释而非代写（Explain, don't ghostwrite）**：不给整段重写；给读者视角（Writor G4）、例子与类比（G3）、量规证据（FeedbackWriter）；导师"≤4 连续词"规则保障作者声音。
7. **双轨制（Two-track）**：机制类（语法/拼写）→ 即时、锚定、一键应用（Grammarly/Draft Coach 式）；高阶类（观点/细节/结构）→ 引导反思但必须收敛到可执行修订。**不要对机制问题用苏格拉底，也不要对观点问题直接代改。**

---

## 6. 差距分析：Spark 与成熟设计的对照

| 成熟范式 | 市面上代表 | Spark 现状 | 差距 |
|----------|-----------|------------|------|
| 问题锚定具体文本 | Khanmigo、Critical Inker | Spot 高亮存在，但 Mentor 聊天不联动高亮；问题多为通用模板 | 高 |
| 答后转化为修订标记 | Critical Inker | 仅 "Add last answer to pad"（原样追加），或粗暴 span 替换 | **高（核心痛点）** |
| 修订预览/撤销/对比 | Grammarly、Draft Coach | 无 | 高 |
| 重评闭环 + 进度 | W&I 进度图、Draft Coach Run-New | 无显式入口，分数变化无提示 | 高 |
| 维度↔行动跳转 | Draft Coach 问题列表、Writable 证据 | 维度 tip 与 fix 队列脱钩 | 中高 |
| 单一统一的反馈入口 | Draft Coach 侧栏 | 三套表面并存 | 中高 |
| 对话收敛 / 出口 | Critical Inker 进度、Lab coherent | Mentor 无收敛条件 | 高 |
| 读者视角反馈 | Writor | 仅少量 praise 涉及作者选择 | 中 |
| 作者目标导向（先问想改什么） | Writor G7 | 无 | 中 |
| 双轨制（机制 vs 高阶） | Grammarly + Khanmigo 并存 | 机制已有 LanguageTool 下划线，高阶轨道不收敛 | 中 |

---

## 7. 改造建议（按优先级，映射到代码）

### P0-1：把"回答"转化为"可执行修订"（对治核心痛点 P1+P2）

**目标**：任何一次对话或 Spot 问答，结束后学生必须看到"从这里开始改"的具体出路，且修改是**预览 → 确认 → 可撤销**的。

**方案 A（改动最小，推荐先行）—— Spot 修复改为"修改预览"流：**

1. `src/lib/entertain/basis-fix-session.ts`：
   - `WritingFixIssue` 增加 `revisionType: "word" | "phrase" | "sentence" | "append"` 字段（由 `coachQuestion` 一并返回，按 dimension 决定）。
   - 新增 `mergeRevision(draft, issue, answer)`：按 `revisionType` 做合并——
     - `sentence`：整句替换（topic/grammar）；
     - `phrase`：在 span 前后补空格/标点安全合并（detail/vocab）；
     - 任何情况下把合并结果**同时返回给 UI 预览**，而不是直接落盘。
2. `src/components/WritingFixDialogue.tsx`：在 Apply 前展示 **Before / After** 预览块（原句带删除线或高亮 span、修改后句子），提供"Apply"和"Cancel"；Apply 后在该条旁标注"✓ 已应用 · 撤销"。
3. **撤销**：`WritingStudio` 保存一个 `draftHistory`（至少最近 5 个版本），撤销按钮回退到上一版。

**方案 B（中期）—— Mentor 对话接入"修订动作"：**

- `src/lib/entertain/basis-mentor-session.ts`：把 prompt 从"永远一个问题"改为**三步循环 + 出口**：
  1. 表扬（锚定作者原话）；
  2. 一个尖锐问题（锚定具体 span）；
  3. 学生回答后，Coach 显式总结"你说了 X，那我们把这句话改成……"并**返回结构化动作** `{ reply, edit?: { spanId, replacement } }`；
  4. 学生看到预览 → Apply / Edit / Skip → 该 issue 计入进度（✓）。
- `src/app/api/writing-studio/coach/route.ts`：`mentor` action 允许 LLM 返回可选 `edit` 字段（JSON 模式），本地兜底 `localMentorReply` 不产 edit（退化为纯对话）也不丢能力。

### P0-2：让对话收敛，提供进度与出口（对治 P1）

- **issue 级进度条**：`WritingFixDialogue` 头部与 `WritingMentorDialogue` 都显示 `Topic ✓ · Detail · Vocab · Grammar` chips，逐条打勾（对标 Critical Inker progress indicator、NoRedInk 构件）。
- **明确出口**：当焦点维度的问题解决后，Coach 明说"这条已经想清楚了 → 现在把它写进文章（Apply / Skip）→ 然后我们看下一条"。**对话不再无限问下去**，每轮结束要么产出 edit 动作，要么进入下一条 fix。
- **避免"已回答问题再被问"**：`askedRef` 已经存在（`WritingFixDialogue`），Mentor 侧同样记录已问过的 focusId，杜绝 Critical Inker 论文指出的"问学生已经答过的问题"。

### P0-3：统一反馈表面（对治 P3）

- `WritingStudio.tsx` 的 `feedbackBody` 改为**单一分层面板**：
  1. **Glance 层**：总分环形 + headline + 词/句统计（保留）。
  2. **What to fix 层**：Spots 列表（每条 = 维度 chip + 引用文本 + 严重度），点击跳转到 pad 高亮与预览。
  3. **Coach chat 层**：对话只负责"把问题想清楚"，但**每次 Coach 回复都携带指向某条 fix 的动作按钮**（"把这句写进文章"）。
- 去掉 `WritingCoachPanel` 里与聊天重复的 "Think with Spark / Answer in coach chat" 双入口，统一为一个主 CTA（`Continue with coach`）。
- 移动端自动打开 Mentor 前，改为**不打断写作**：只在 pad 上方显示一个非模态提示条 "Coach has 2 questions for you"（`padStatus` 复用即可），点击才进入 feedback 面板。

### P0-4：评分维度 ↔ 行动跳转（对治 P4）

- `WritingCoachPanel` 每个维度条目：
  - 分数带颜色（已有）；
  - evidence 引用（`d.evidence`）改为**可点击**，点击后：`setShowHighlights(true)` + 高亮对应 span + 滚动到该处（复用 `WritingPadHighlights` 的 `activeId` 机制）；
  - 新增 "Fix this" 小按钮，直接打开该维度对应的第一条 open fix。

### P0-5：重评闭环（对治 P5）

- `WritingStudio.tsx`：本地维护 `scoreHistory: number[]`（每次 coach 完成 push `report.overall`）。
- Fix 队列全部 resolved 后，显示入口 **"Run Coach to re-score"**（对应 Draft Coach 的 Run New Check），点按后：
  - 重新 `runCoach({ manual: true })`；
  - 在 `WritingCoachPanel` 头部渲染迷你趋势条 `3.2 → 3.6 → 3.9`（对标 W&I progress graph 的最简版），并给一句"比上次 +0.4"。
- 复用现有 `recordStudioLearningTurn` 的数据即足以支撑，无需新后端。

### P1-1：双轨制显式化

- 机制类（spelling/grammar）：保留 LanguageTool 即时下划线 + 一键替换（已有，体验已接近 Grammarly），**不要再套苏格拉底**——`coachQuestion` 中 grammar 维度保留"重写该句"即可，不必再问。
- 高阶类（topic/detail/vocab/structure）：走"引导反思 → 收敛到修订"的 P0-2 流程。

### P1-2：Lab Discussion 对齐（次级）

- 把 `coherent` 检测从"关键词嗅探"升级为**显式 checklist**：`claim + reason + evidence + trade-off` 逐项由 AI 判定并展示打勾（可用结构化输出，仿照 `BasisCoachReport` 的维度合并方式）。
- 每个讨论轮次同样收敛：学生回答后，AI 应给出"你的推理现在的缺口是 X，具体修法是 Y（在回答里补上……）"；达成后点亮 "Ready"。
- 该问题用户已标注"勉强能说过去"，建议作为 Slice 2，不在 P0 抢占。

### 7.1 最小改动清单（实施顺序）

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1 | `src/lib/entertain/basis-fix-session.ts` | `revisionType` + `mergeRevision()`（返回预览文本） |
| 2 | `src/components/WritingFixDialogue.tsx` | Before/After 预览 + Apply/Cancel + 撤销 |
| 3 | `src/lib/entertain/basis-mentor-session.ts` | Mentor prompt 三步循环 + `edit` 动作 + focus 去重 |
| 4 | `src/app/api/writing-studio/coach/route.ts` | `mentor` 返回可选 `edit` 结构化字段 |
| 5 | `src/components/WritingMentorDialogue.tsx` | 对话产出动作按钮 + issue 进度 chips |
| 6 | `src/components/WritingCoachPanel.tsx` | evidence 点击跳转 + Fix this + 趋势条 |
| 7 | `src/components/WritingStudio.tsx` | 单一面板分层、非模态提示、`scoreHistory` |
| 8 | `src/lib/entertain/lab-discuss.ts`（P1） | 讨论 checklist 收敛 |

---

## 8. 验收指标

| 指标 | 当前基准（推断） | 目标 |
|------|------------------|------|
| 对话/Spot 会话以"至少一次已应用的文本修订"结束的比例 | 低（无数据，需埋点） | ≥ 60% |
| 从第一个 Spot 到完成一次修订的耗时 | 未知 | ≤ 3 分钟 |
| "改完重评"的比例（Run Coach to re-score 使用率） | 无此入口 | ≥ 40% 会话 |
| 学生回答后产出的修订被接受（非取消/撤销）比例 | 无预览可比 | ≥ 70% |
| Mentor 对话平均轮数（不收敛是缺陷） | 高 | ≤ 3 轮即进入修订动作 |
| 移动端被打断次数（自动打开 feedback） | 每次停顿 | 0（非模态提示） |

建议在 `recordStudioLearningTurn` 或新增的轻量埋点中记录：`coach_run`、`mentor_turn`、`fix_applied`、`fix_cancelled`、`rescore_run`。

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| AI 生成的 edit 合并出病句 | 一律**先预览后应用**；`revisionType` 严格限定合并方式；合并逻辑保持纯函数并配单测 |
| 过度代写损害作者声音（BASIS 学术诚信敏感） | 修订内容必须是"学生自己的词"为主体；AI 只做拼接与标点/结构规整（Writor "≤4 连续词"精神）；预览里高亮"AI 改动部分" |
| 对话收敛后显得"机械" | 保留"想清楚了"的表扬；收敛是出口而非脚本；学生可随时 Enter 新对话 |
| 三个面板合并后信息密度过高 | 分层折叠（Glance 常显 / What to fix 常显 / Coach chat 按需展开） |
| 撤销历史内存 | 只保留最近 5 版 + 限长（>6000 字符不记历史） |
| 移动端布局回归 | 复用现有 `mobileTab` 机制，仅改 feedback 面板内部结构 |

---

## 10. 结论

1. Spark Writing Studio 已经具备正确的基本盘：BASIS 四维度、苏格拉底导师、grammar 即时下划线、spot 高亮、Stage 结构适配——**骨架是行业水准的**。
2. 当前最大的体验断裂在于 **"问答"与"修改"之间的桥**：对话被 prompt 锁定为"无限提问"，Spot 的 Apply 是粗暴的 span 替换，且三套反馈表面让学生无所适从。
3. 市面上成熟产品与 2026 年 HCI 研究的共识是：**苏格拉底问题必须锚定文本、必须收敛为可预览可撤销的修订动作、必须配进度感与重评闭环**（Critical Inker 的 "verbalize → comment marker → revision"，W&I 的重交循环，Draft Coach 的 Run/Re-run，NoRedInk 的修订轮次与版本历史）。
4. 按第 7 节的 P0-1 ~ P0-5 落地（最小改动集中在 `basis-fix-session.ts` + `WritingFixDialogue.tsx` + `basis-mentor-session.ts` 三个文件），即可直接解决用户反馈的核心痛点；Lab Discussion 的对齐作为 P1 跟进。

> **一句话版本**：不是"少问问题"，而是"问的问题必须长出一只脚，踩进文章里"——答完必有预览、应用、撤销与进度。

---

### 附：主要参考资料

- Write & Improve（Cambridge）：writeandimprove.com；帮助文档 "How does Write & Improve work?"
- Turnitin Draft Coach 官方 FAQ / 学生指引（guides.turnitin.com）
- NoRedInk Guided Drafts（noredink.com / Help Center）
- Khanmigo Writing Coach / Student Essay Feedback（khanmigo.ai）
- Writable / CoGrader / GradingPen（学术趋势测评，academicaitrends.com 2026）
- Hugenroth, Danry & Maes (CHI 2026) *Critical Inker: Scaffolding Critical Thinking in AI-Assisted Writing Through Socratic Questioning*
- Liu, Gallagher, Sterman & August (CHI 2026) *From Crafting Text to Crafting Thought: Grounding AI Writing Support to Writing Center Pedagogy*
- Liu 等 *FeedbackWriter*（AI-Mediated Feedback Improves Student Revisions，2026）
- *Stop Writing for Me: Generative Refusal in AI Tools for Thought*（2026）
- BASIS Independent Schools 官网课程指南与课程手册（2022-2024）
- 项目内部：`docs/subsystems/writing-studio-pad-p0.md`、`docs/subsystems/ux-competitor-report-2026-08-feasibility.md`
