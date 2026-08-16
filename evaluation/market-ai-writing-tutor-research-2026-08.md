# 竞品桌面调研：AI 写作辅导产品（面向国际学校优等生）

> **配套文档**：主分析报告见 [writing-studio-coaching-ux-2026-08.md](writing-studio-coaching-ux-2026-08.md)
> **调研时间**：2026-08-15 · 桌面公开资料 + 2026 年 HCI 会议文献
> **视角**：面向 BASIS 国际学校优等生的 **Feedback / Coaching 体验设计**

---

## 1. 调研范围与方法

- **范围**：写作反馈与辅导类 AI 产品（教学语境），重点考察：反馈粒度、是否代写、苏格拉底用法、修改闭环、进度呈现、对高能力学生的适配。
- **产品名单**：
  - 商业：Grammarly、Write & Improve（剑桥）、NoRedInk、Turnitin Draft Coach、Khanmigo Writing Coach、Writable、CoGrader、GradingPen、ProWritingAid、Google Gemini in Docs。
  - 研究原型（2025–2026 HCI）：Critical Inker（MIT/CHI'26）、Writor（CHI'26）、FeedbackWriter、Friction。
- **证据来源**：各产品官方文档/帮助中心、2026 年评测文章、CHI 2026 论文。

---

## 2. 产品深度分析

### 2.1 Grammarly —— 即时、锚定、一键应用（机制修正的标杆）

- **定位**：全场景编辑助手；实时语法/拼写/语气/清晰度。
- **反馈粒度**：词/句级；下划线锚定在原文；点击见解释 + 一/多键替换；可忽略。
- **教学争议**：NoRedInk 评测认为 "Grammarly corrects writing rather than teaching it"——学生学会接受建议而不是理解建议。大学普遍视同拼写检查。
- **对本产品的启示**：机制类问题采用"即时下划线 + 点击解释 + 一键替换"是正确的（Spark 的 LanguageTool 集成已走这条路）；**不要**把观点/结构问题也做成这种"接受即改"，否则优等生会失去深度反思的机会，也引发 BASIS 学术诚信担忧。

### 2.2 Write & Improve（剑桥）—— 间接提示 + 重交循环（教学闭环的标杆）

- **定位**：刻意"不是文本编辑器，而是练习场"（practice environment）。
- **反馈方式**：算法对学习者语料（30M 词剑桥学习者语料）做监督学习，**只标记 ≥90% 确信的问题**（避免红笔过多）；对词级问题给**间接、半纠正式**提示，没有"正确答案"，逼学生自己决策。
- **评分**：CEFR 等级 + 与 prompt 相关性得分。
- **闭环**：写 → 提交 → 句级高亮+反馈+评分 → 修改 → 再提交 → **最近 10 次提交的进度图**。
- **对本产品的启示**：① 显式重交循环 + 进度图是"让学生感到在变强"的关键机制；② 高能力学生适合"提示而非答案"——这正是苏格拉底的正确打开方式，前提是提示必须具体到句级。

### 2.3 NoRedInk Guided Drafts —— 分构件脚手架 + 版本化修订轮次

- **定位**：3–12 年级语法/写作掌握型平台；Guided Drafts 是整篇写作功能。
- **设计**：学生按构件（引言/论点/主体/结论）分块写；左栏常驻 rubric + tutorials + exemplars + tips（just-in-time scaffolding）；构件可设必做/选做。
- **修订**：教师 "Send back for revisions" 退回 → 学生修订 → 系统保留**多版本历史**（下拉选择）。
- **对本产品的启示**：① 反馈与写作构件一一对应，学生清楚"这一块差在哪"；② "修订轮次 + 版本历史"让修改成为有据可查的过程。

### 2.4 Turnitin Draft Coach —— Run/Re-run 语义 + 问题列表 + 解释优先

- **定位**：Google Docs / Word Online 侧栏插件；Similarity / Citations / Grammar 三检查。
- **交互**：Run check → 问题列表 → 点击问题 → 详细解释 + 修改建议 → 改完 → **Run New Check** 重跑。Sim 检查每文档限 3 次，刻意鼓励"改充分再查"。
- **性质**：形成性、私有、不提交老师。
- **对本产品的启示**：① "重跑"语义让学生对修改循环有掌控感；② 问题列表 + 逐条解释 + 建议，是最直接的问题呈现方式；③ 限次可转化为"重点检查配额"。

### 2.5 Khanmigo Writing Coach —— 锚定文本的苏格拉底（问答与文本的连接）

- **定位**：Khan Academy 免费写作教练；教师端实时进度追踪。
- **核心交互**（Sal Khan TED 演示）：学生问 "Does my evidence support my claim?" → AI **高亮文章具体段落**并说 *"On this passage, this doesn't quite support your claim… can you tell us why?"*——问题严格锚定文本片段，且要求学生解释。
- **边界**："It doesn't give them information they should research themselves. It doesn't provide content."（教师反馈）。
- **对本产品的启示**：苏格拉底问题可以保留，但**必须高亮对应文本**，并让学生用自己话解释——这正是 Spark Mentor 聊天缺失的"锚定"。

### 2.6 Writable / CoGrader / GradingPen —— 量规对齐 + 证据引用 + 规模化

- **定位**：教师批量量规评分与反馈（AI 生成）；部分产品含学生端辅导入口。
- **设计**：按 rubric 生成反馈，**引用文内证据**；支持西班牙语等多语言。
- **对本产品的启示**：BASIS 场景应让 rubric 维度（topic/detail/vocab/grammar）与证据引用严格对应——"这段导致了 2 分"，而不是孤立分数。当前 Spark 的 `evidence` 字段已具备，只是 UI 未利用。

### 2.7 Critical Inker（MIT Media Lab, CHI 2026）—— 与本项目痛点最直接相关的研究原型

- **动机**：防止 LLM 写作助手导致"认知失能"（cognitive deskilling）；用苏格拉底提问 + 论证结构分析支撑反思。
- **两种模式**：
  1. **Visual Feedback**：直接红线下错误 + 解释；可点开论证树逐层探查。
  2. **Socratic Chatbot**：一次只针对一个论证关系提问，问题**锚定具体论断**（"You claim X because Y — but how does Y actually support X?"），**不做直接纠错**。
- **关键机制（verbalization requirement）**：**只有学生自己说出问题所在之后，系统才把学生的意图转换为锚定在文本上的评论标记（comment marker / revision reminder）**，并配**整体进度指示器**（跨全部问题的完成度）。
- **实测发现**：Socratic 模式让学生"let me think for myself"，但会偶发"问已经答过的问题"的摩擦（friction）；效率与投入存在张力。
- **技术**：多阶段 pipeline（结构抽取 → 逐关系验证 → 苏格拉底干预）；论证抽取与人类标注 91.2% 重合、有效性 87%；Claude Sonnet 4.5 延迟约 6.6s。
- **对本项目的启示（直接）**：这就是"问答→修改"断裂缺失的那一环。Spark 应在学生回答后：① 判定焦点问题是否已被想清楚；② 把回答**凝练成一个可预览的修订**（comment marker）；③ 计入进度。

### 2.8 Writor（CHI 2026）—— 写作中心教学法：不代写，但给读者视角

- **方法论**：10 位写作中心导师访谈 → 7 条设计准则，原型不产出可复制文本。
- **核心准则**：G1 具体表扬建立信心；G2 非指令性反馈；G3 例子与类比；G4 读者视角反馈；G5 帮助理解任务；G6 对话锚定文本；G7 询问作者想改什么。
- **导师铁律**：一次最多给作者 **4 个连续词**（"P3 …strict rule in giving students no more than four continuous words"），强制保留作者声音。
- **专家评审**：30 位写作教师/导师/AI 研究员；非指令性反馈获最高评价（尤其来自对 AI 持怀疑的教师）。
- **对本项目的启示**：① 表扬应锚定"作者自己的选择"（Spark `buildMentorPraise` 已部分做到）；② 提问用**读者视角**（"我读到这里以为……"）；③ 系统应主动问"你想先改哪一块"，而不是系统单方面排队。

### 2.9 FeedbackWriter / Friction —— 量规锚定 + 可操作修订规划

- **FeedbackWriter**：每条 rubric 在文内锚定一条反馈；已满足给表扬、未满足用苏格拉底提示；用户对建议有 adopt/edit/dismiss 的完全控制。随机试验显示 AI 反馈显著提升学生修订质量。
- **Friction**：跨草稿可视化所有反馈，帮作者**排优先级、规划可执行修订**。
- **对本项目的启示**：反馈要锚定 + 可操作 + 可拒绝；给优等生"修订规划"视图而不是无限问答。

---

## 3. 交叉对比表

| 产品 | 反馈粒度 | 代写程度 | 苏格拉底用法 | 修改闭环 | 进度呈现 | 对优等生适配 |
|------|----------|----------|--------------|----------|----------|--------------|
| Grammarly | 词/句 | 建议+一键应用 | 无 | 弱 | 无 | 中（无挑战） |
| Write & Improve | 句级高亮 | 不代写（提示） | 间接提示 | **强（重交循环）** | **进度图（10 次）** | 高 |
| NoRedInk Guided Drafts | 构件/段落 | 不代写 | 脚手架+范例 | **强（修订轮次+版本）** | 构件完成度 | 高 |
| Turnitin Draft Coach | 词/句/引用 | 建议+解释 | 无 | **强（Run/Re-run）** | 检查状态 | 高 |
| Khanmigo Writing Coach | **段落级锚定** | 不代写 | **锚定文本的苏格拉底** | 中 | 教师端实时 | 高 |
| Writable/CoGrader | 量规+证据 | 混合 | 无 | 中 | 量规评分 | 高 |
| Critical Inker | **论证关系级** | 严格不代写 | **锚定论断+收敛+进度** | **强（verbalize→修订标记）** | **问题级进度条** | 高（research prototype） |
| Writor | 句/段读者视角 | 严格不代写 | 对话+例子+类比 | 中 | 无 | 高（research prototype） |
| FeedbackWriter | 量规锚定 | 提示式 | 苏格拉底提示 | 中 | 量规状态 | 高 |

---

## 4. 面向"国际学校优等生"的选型结论

1. **机制修正层**（语法/拼写/标点）：用 **Grammarly / Turnitin Draft Coach** 式"即时锚定 + 一键应用 + 解释"，Spark 的 LanguageTool 集成已覆盖。
2. **高阶辅导层**（观点/细节/结构/论证）：用 **Critical Inker + Khanmigo + Writor** 式"锚定文本的苏格拉底 + 收敛到修订动作 + 进度"，这是 Spark 当前最缺的。
3. **闭环与进度层**：用 **Write & Improve** 式"重评 + 进度图"、**NoRedInk** 式"修订轮次 + 版本历史"、**Draft Coach** 式"Run/Re-run"。
4. **对 BASIS 优等生的特殊性**：BASIS 强调 AP 级分析性写作与学术诚信——工具必须**保留作者声音（不代写）、提供挑战（尖锐问题）、给足自主（预览/接受/拒绝/撤销）**。纯问答式辅导在优等生群体中会迅速被判定为"玩具"；有收敛、有产出、有进度的辅导才是他们认可的"教练"。

---

*调研完成 2026-08-15 · 详见主分析报告 [writing-studio-coaching-ux-2026-08.md](writing-studio-coaching-ux-2026-08.md)*
