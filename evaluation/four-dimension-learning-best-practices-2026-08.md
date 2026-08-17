# 四维学习力业界优秀实践深度调研（兴趣 · 专注 · 深度 · 广度）

> **版本**：2026-08（V1）
> **范围**：以「提升学生热情兴趣、学习专注度、学习深度、学科广度」四个维度为纲，横向调研业界公认的优秀实践（Khan Academy / Khanmigo、Brilliant、Duolingo、BASIS 课程体系、Carnegie Learning、IXL 等），提炼可落地的机制设计，映射到 Spark 现有四维框架。
> **读者**：Spark 产品与工程（后续可转为 roadmap 输入）。
> **方法与局限**：公开资料抓取 + 学术元数据（OpenAlex）+ 厂商一手材料交叉验证；web 搜索引擎在本环境不可用，部分结论基于一手页面与学术摘要，细节以链接为准。

---

## 1. 摘要

Spark 的四维框架（兴趣 · 心流 · 深度 · 广度）方向正确，且已实现较多机制（兴趣自选回路、flow-aware 难度、每周深潜日、错题变式、跨学科连接卡、广度足迹）。本次调研的核心结论是：**业界头部产品近两年都在从「功能堆叠」转向「数据闭环 + 轻量干预」，并反复验证了三个原则**：

1. **集成优于隔离**：AI 辅导必须嵌入学生正在做的事（Khanmigo 从「附加工具」改为「内嵌于练习题」后，参与度显著改善；Sal Khan 2026-07 公开复盘）。
2. **提示思考优于给答案**：「认知装载（cognitive onloading）」替代「认知卸载（cognitive offloading）」——让学生解释思路、预测结果、自我修正，而不是被喂答案（Khanmigo、Brilliant、检索练习研究一致支持）。
3. **兴趣是引擎，难度是油门，反馈是方向盘**：自我决定理论（自主/胜任/联结）解释兴趣；心流理论（挑战-技能平衡）解释专注；检索练习与间隔重复解释深度；跨学科连接与知识图谱解释广度。

对 Spark 的具体增量建议（详见 §7）：把「心流信号」从会话内扩展为**跨会话状态机**；把「兴趣档案」升级为**可导航的兴趣知识图谱**；把「每周深潜」与错题本做**双向锚定**；把广度地图做成**进度可视化 + 奖励里程碑**；并补一个**家长可读的「四维周报」**。

---

## 2. 背景：为什么是这四个维度

BASIS 等国际学校 K-12 高材生的特点：基础扎实、学习能力强，但**时间被课程与课外活动压缩，热情与专注比「知识灌输」更稀缺**。四个维度对应四条独立但互通的杠杆：

| 维度 | 核心问题 | 关键理论 | 业界代表 |
|---|---|---|---|
| 兴趣（热情） | 为什么愿意学 | 自我决定理论（Deci & Ryan 2000）、好奇心缺口（Loewenstein） | Duolingo、Brilliant、Khan 兴趣化 |
| 专注（心流） | 为什么能沉浸 | 心流理论（Csikszentmihalyi）、挑战-技能平衡 | Khanmigo、Brilliant 自适应 |
| 深度 | 为什么记得牢、想得深 | 检索练习（Roediger & Karpicke 2010）、desirable difficulties（Bjork） | Khan 练习、Anki、AoPS |
| 广度 | 为什么能迁移 | 知识图谱、跨学科迁移（BASIS 课程设计） | BASIS 课程、Khan 学科图 |

---

## 3. 业界优秀实践分维度调研

### 3.1 兴趣 / 热情

#### 3.1.1 Duolingo：数据驱动的游戏化（已规模化验证）

- **机制**：连续打卡（streak）、经验值、排行榜、虚拟货币、角色与表情包，全部围绕「最小承诺 + 即时反馈」设计；通知采用多臂老虎机（bandit）算法优化发送时机（Yancey & Settles, KDD 2020）。
- **研究结论**：游戏化对学习有中等正向效应，但**设计质量决定成败**（Sailer & Hommer 2019 元分析，OpenAlex 引用 1356+；Hamari et al. 2014 综述）。纯外部奖励（徽章/分数）若不与内在动机挂钩，长期可能反噬；Duolingo 的关键是「游戏化服务于学习循环本身」——打卡保护的是每日练习习惯，而非单纯收集。
- **对 Spark 的启示**：Spark 已有「成长时刻（flowMoment）」「作品墙点赞」，方向正确；缺的是**习惯化节奏**（如连续学习天数、周目标达成率）与**最小承诺入口**（"今天 3 分钟"）。

#### 3.1.2 Brilliant：兴趣来自「概念可玩」

- **机制**：全部内容为视觉化、交互式问题（learn by doing）；streaks、等级、每日目标；课程按「你能感觉到它 click」设计，而非灌输公式。
- **一手信息**（官网 2026-08 抓取）："Instead of just memorizing, you play with concepts until they click"；自适应"tracks what you've mastered and where you're stuck…speeds up when you're ready, slows down when you need it"；由 MIT/Harvard 等专家设计。
- **对 Spark 的启示**：Spark 的「快速路径（local-facts 问即答）」是确定性工具；Brilliant 式「交互可视化」（几何拖拽、概率模拟）可作为深度兴趣钩子，尤其适合 Spark 已支持几何绘图的基础。

#### 3.1.3 兴趣 → 作品闭环（Spark 已有 + Khan 佐证）

- Spark 已实现「探索主题 → 兴趣档案 → 作品（Journal/Studio）→ 鼓励」闭环，这符合 SDT 的「自主 + 胜任 + 联结」三需求。
- Khan Academy 的创作工具（Khanmigo 写作、代码、绘图）验证了「学习产出作品」对高能力学生的强激励。
- **增量**：兴趣档案目前是标签计数；可升级为**兴趣-技能关联图**（喜欢恐龙 → 推荐古生物学阅读 + 统计图表技能 + 博物馆主题深潜），让「兴趣反哺推荐」更可解释（Spark V2 的 `pickExploreTopics` 已有雏形）。

### 3.2 专注 / 心流

#### 3.2.1 心流理论：挑战-技能平衡是操作系统级原则

- Csikszentmihalyi 的心流模型：当**挑战略高于技能**（约 4% 之上一个台阶）时进入心流；挑战过低→无聊，过高→焦虑。
- **研究支撑**：游戏化学习研究中 flow 是参与度核心中介（Hamari & Koivisto 2014；"Challenging games help students learn" 2015）；ITS 元分析（Ma et al. 2014）显示自适应难度调节显著影响学习成效。
- **对 Spark 的启示**：Spark 的 `flow-signals`（秒答连对上调、迟疑下调）正是心流落地；**建议升级为跨会话状态机**：一次会话的高光（秒答连对）应在下次会话的 opener 中体现（"上次你 3 秒连对 5 题，这次我们试试更快"），形成心流的「延续感」，而非每次从零开始。

#### 3.2.2 Khanmigo 复盘：集成 + 降低元认知负担（2026 最重要的一手信息）

- Sal Khan 2026-07 公开复盘（Khan Academy Blog，一手抓取）：
  1. **第一版 Khanmigo 是「附加工具」**，要求学生在需要帮助时主动识别并提问——**元认知负担太高**，实际学习提升不如预期。
  2. **下一代改为「内嵌于练习」**：Khanmigo 能看到学生正在做的题，主动提示「解释你是怎么得出答案的」，学生保留拒绝权，但**系统承担了「何时求助」的判断**。
  3. 明确区分 **cognitive onloading（认知装载：让学生想）** vs **cognitive offloading（认知卸载：替学生想）**，并以此作为设计准则。
  4. 用数据（A/B）决定哪些改动真正提高参与度。
- **对 Spark 的启示**：这是对 Spark「苏格拉底阶梯 L0-L3」的强验证，也是最重要的校准信号——**提示的时机与成本比提示本身更重要**。Spark 的 `proactive-nudge`（答错或闲置触发复盘邀约）已对齐；可再加「解释你的思路」类轻提示（对应 L1.5「ask why before marking」），并保证每次提示 ≤2 句（Spark V3 已有「短而具体回复守卫」）。

#### 3.2.3 专注护栏（Spark 已有）：游戏与学习的边界

- Spark 已有「作业未完成时 Games 侧栏轻提醒（可关闭、不锁定）」，符合「非阻塞干预」的业界共识（Duolingo 通知 bandit 也强调打扰成本）。
- **增量**：可增加「心流保护时段」——进入深潜/错题复盘时自动静音通知与游戏入口 15 分钟，配合进度保存，降低「被打断的挫败感」。

### 3.3 学习深度

#### 3.3.1 检索练习：被重复验证的「反直觉」策略

- Roediger & Karpicke（2010）《The critical role of retrieval practice in long-term retention》：**提取记忆本身强化记忆**，其效果超过重复阅读。
- Pooja Agarwal（retrievalpractice.org，一手抓取）："Easy learning leads to easy forgetting"；「让学生主动说出记住了什么」是无备课、无评分的强教学法。
- **对 Spark 的启示**：Spark 的错题本「Redo/Variant/Harder」本质是检索练习 + 变式；**可加间隔排程**：错题按遗忘曲线（1 天/3 天/7 天）自动安排复测，而非仅「最近错题」；并区分「变式（同技能新数字）」与「迁移（半级提升）」的间隔策略。

#### 3.3.2 Desirable difficulties（合意困难）与「问 why」

- Bjork 的 desirable difficulties：适度的提取困难、间隔、交错（interleaving）提升长期保持。Spark 的 L1.5「先问 why 再判对错」与「Harder 半级迁移题」直接落地该原则。
- **增量建议**：交错练习（interleaving）——深潜或周 Launchpad 中混合 2-3 个相邻技能（Spark `breadth-map` 的 `adjacent` 已具备数据基础），可显著提升高能力学生的迁移表现。

#### 3.3.3 深度追问的「度」：Khanmigo 与 Brilliant 的共识

- Khanmigo：让学生解释 → 不直接给答案 → 学生保留拒绝权（**自主性保护**）。
- Brilliant：逐题互动、step-by-step 引导、问题拆解。
- 两者共同点：**提示链（hint ladder）短而密，答案只在学生明确要求后出现**——与 Spark 的 L0→L3 + 显式求答才给全解完全一致。Spark 已在正确轨道上，缺的是**对「提示链长度」的数据度量**（多少次提示后学生放弃？平均几级提示能独立解出？）。

### 3.4 学科广度

#### 3.4.1 BASIS 课程体系：广度来自「学科连接」而非「内容堆量」

- BASIS Ed 课程哲学（basised.com/curriculum，一手抓取）：
  - "Think hard over time about the connections between the subjects they are learning"——**跨学科连接是核心能力目标**，不是附加项。
  - 高挑战预期：「When faced with a challenge, the vast majority of students will rise to meet that challenge」。
  - 组织与时间管理作为行为目标显式培养（对高能力学生尤其重要）。
  - 教师为学科专家且保留自主授课权（内容由专家教师创造，而非中央统一讲义）。
- **对 Spark 的启示**：Spark 的「每周连接卡 + 学科桥（know X → try Y）」与 BASIS 哲学高度同构。**增量**：连接卡应从「双技能桥」升级为「**主题星图**」——以当前深潜主题为中心，展示相邻 3-5 个学科入口（恐龙 → 地理/生物/地质/统计），由学生选路，强化「广度由兴趣导航」而非「广度清单」。

#### 3.4.2 知识图谱与掌握度可视化

- Khan Academy 的学科 mastery 系统（技能地图 + 掌握度百分比）是「广度可视」的行业标准；IXL 的 1/4 美国学生覆盖率证明诊断-练习-掌握闭环的可规模化。
- **对 Spark 的启示**：Spark 的 BKT 技能掌握度已有；建议在 Me 页提供**广度足迹图**（已探索学科、可探索学科、连接线），每周 Launchpad 展示「本周新增探索 2 个新领域」的进步，将广度变成可追踪的成长（对应家长周报归因卡）。

---

## 4. 竞品 / 实践矩阵

| 产品/实践 | 兴趣 | 专注/心流 | 深度 | 广度 | 可借鉴机制（对 Spark） |
|---|---|---|---|---|---|
| Khanmigo（Khan） | 兴趣作品 | 内嵌式主动提示、cognitive onloading | 解释思路、不直接给答案 | 学科图谱 | 提示时机降低元认知负担；A/B 决定干预 |
| Brilliant | 概念可玩、streak | 自适应难度、视觉交互 | step-by-step 互动 | 多学科课程 | 交互可视化；「点击感」设计 |
| Duolingo | 打卡/排行/角色 | 通知 bandit、最小承诺 | 间隔重复内建 | 多语言 | 习惯化节奏；通知打扰成本控制 |
| Carnegie Learning | 教师工具为主 | 认知 tutor 实时建模 | 认知科学驱动 | 全学科 K-12 | 认知 tutor 实时建模深度 |
| IXL | 积分奖励 | 诊断-练习闭环 | 即时反馈+错因 | 全学科覆盖 | 掌握度百分比可视化 |
| BASIS 课程 | 挑战预期 | 组织/时间管理 | 专家教师深授 | 跨学科连接显式目标 | 「连接学科」作为能力目标 |
| Spark 现状 | ✅ 兴趣自选+作品墙 | ✅ flow-aware + 专注护栏 | ✅ L0-L3 + 错题变式 | ✅ 连接卡+广度足迹 | — |

结论：Spark 四维机制齐全度与头部产品相当（甚至机制更多），**差距在「数据闭环的深度」与「干预的精细化」**，而非功能缺失。

---

## 5. 风险与不确定性

1. **游戏化反噬**：纯外部奖励（积分/徽章）可能削弱内在动机（SDT 研究一致警告）。落地建议：奖励必须绑定「学习行为本身」（打卡=完成练习，非点击）。
2. **过度提示 → 依赖**：Khanmigo 复盘显示，提示若太频繁会让学生放弃自主求助。需要度量「提示→独立解决」转化率，防止提示链变成「答案捷径」。
3. **高能力学生的差异化**：BASIS 高材生对「简单化」敏感——难度上调应更激进（Spark BKT 已按先验分层，V3 已对 high-prior 学生抑制主动打扰，方向正确）。
4. **家长预期管理**：四维指标若只看「时长/题量」会诱导刷量；需用「掌握度增量 + 广度新增 + 心流事件」等质量指标。
5. **一手来源时效性**：本报告基于 2026-08 公开页面；Khanmigo 迭代迅速，建议每季度复查官方博客。

---

## 6. 参考来源

**一手页面（2026-08 抓取）**
- Khan Academy Blog — "Khanmigo's First Chapter… A note from Sal Khan"（2026-07-15）
- Brilliant 官网（learn by doing / Koji 自适应）
- BASIS Ed — Curriculum 页（basised.com/curriculum）、Results 页、BASIS International Schools 官网（中国 8 城校区）
- retrievalpractice.org（Pooja Agarwal）
- Duolingo Research 页（research.duolingo.com）
- Carnegie Learning 官网、IXL 官网

**学术（OpenAlex 元数据）**
- Sailer & Hommer 2019, *The Gamification of Learning: a Meta-analysis*
- Hamari, Koivisto & Sarsa 2014, *Does Gamification Work?*（综述）
- Roediger & Karpicke 2010, *The critical role of retrieval practice in long-term retention*
- Ma, Adesope, Nesbit & Liu 2014, *Intelligent tutoring systems and learning outcomes: A meta-analysis*
- Deci & Ryan 2000, *Self-determination theory and the facilitation of intrinsic motivation*
- Csikszentmihalyi（心流理论经典文献）
- Yancey & Settles 2020, *A Sleeping, Recovering Bandit Algorithm for Optimizing Recurring Notifications*（KDD）
- Bjork（desirable difficulties / interleaving）

**内部基准（仓库内）**
- `docs/subsystems/spark-v2-flywheel.md`（三阶段飞轮设计）
- `docs/subsystems/spark-research-roadmap.md`（V2/V3 实施记录）
- `evaluation/market-ai-writing-tutor-research-2026-08.md`、`evaluation/writing-studio-coaching-ux-2026-08.md`

---

## 7. 对 Spark 的增量建议（按性价比排序）

**P0（低成本高杠杆，复用现有数据）**
1. **间隔复测排程**：错题本增加「到期复测」队列（1/3/7 天），复用 BKT 掌握度；高掌握技能自动降频。→ 深度维度
2. **跨会话心流延续**：会话结束记录「心流事件」（秒答连对/深潜完成），下次 opener 引用（≤1 句）。→ 专注维度
3. **「解释你的思路」轻提示**：在判对错前对高难度题启用 L1.5 强制追问（可跳过），对齐 Khanmigo 实践。→ 深度维度

**P1（中等成本）**
4. **兴趣-技能关联图**：把 `interest-store` 标签映射到技能/主题节点，`pickExploreTopics` 按图扩散推荐（已有 V2 雏形，补可视化）。→ 兴趣维度
5. **主题星图（广度导航升级）**：深潜结束时展示相邻学科入口星图（3-5 个），点击即开新探索。→ 广度维度
6. **四维周报**：家长周报增加「兴趣热点 / 心流时刻 / 深度里程碑 / 广度新增」四卡片，全部用质量指标。→ 全部

**P2（高成本，择机）**
7. **交互可视化微件**：几何拖拽、概率模拟（Brilliant 式），优先接已有几何绘图能力。→ 兴趣/深度
8. **通知时机优化**：bandit 或简单规则（放学后、作业后）控制主动提示时机。→ 专注

> 所有干预遵循三原则：非阻塞、可拒绝、绑定学习行为本身。
