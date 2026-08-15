# UX V4 Experience P0 — 减法 + Focus Mode（2026-08-15）

> Source: `Spark_四维学习力深度调研报告_V4_2026-08-15` §6 P0（F1 / F2 / F4 / F6 / F12）  
> Related: [spark-research-roadmap.md](spark-research-roadmap.md) · [sidebar-density.md](sidebar-density.md) · [focus-guardrail](../TODO.md)

## Problem

功能机制已过剩，体验克制不足：空状态最多 8 个模块同屏竞争；侧栏混杂孩子 / 家长 / 开发者入口；专注力只有防守护栏、没有主动「专注容器」；探索主题只能点选 13 个预制 chip，接不住 Formula One / World Cup 等生活兴趣。

## Approach

一次性落地报告 **本周 P0** 四项（复用现有机制，不动核心教学链路）：

| ID | Work |
|----|------|
| **UXV4.1** | **Hero Action 轮换** — 空状态只渲染 1 张主卡；按优先级+新鲜度选卡；「Another suggestion」循环其余 |
| **UXV4.2** | **导航收敛** — 一级：Me / Progress / Studio / Games；Family / Dict / Help / GitHub / Code Agent 收进 More；GitHub + Code Agent 仅家长 PIN 解锁后可见 |
| **UXV4.3** | **Focus Mode v0** — 可选 20 分钟专注会话；隐藏侧栏出口倾向；进度环；结束回顾；Me 页记录；Focus 期间铃铛只亮 urgent |
| **UXV4.4** | **自由探索输入** — 「Today, I want to explore ___」→ 匹配目录或动态主题 + kickoff + `recordInterest` |

### Hero priority (freshness rotates among available)

1. `deepDive`（周三深潜未做）
2. `practice`（练习邀约 / 错题复盘）
3. `launchpad`（本周 Launchpad 尚有未完成）
4. `challenge` / `opener`（高掌握挑战或日常开场）
5. `explore`（探索 chips）
6. `connection`（连接卡）
7. `adjacent`（邻居推荐）

主卡选中后：**不再堆叠**其余模块。Composer 始终可用（计入「打字」决策点）。

### Focus Mode philosophy

继承 focus-guardrail：**容器不是笼子** — 可提前结束；不锁设备；不惩罚。Duolingo 式 OS 级屏蔽不做。仅应用内：弱化 Games/Studio 出口、延迟非 urgent 消息角标。

### Non-goals (this slice)

Games Hub 世界图、Dashboard 叙事化、兔子洞、首日三关、品牌改名、竞赛线、Quest、人文探险周。

## Key files

| Area | Files |
|------|-------|
| Hero rotation | `src/lib/hero-action-rotation.ts` (+ test) |
| Empty state UI | `src/components/ChatThread.tsx` |
| Nav | `src/components/HistorySidebar.tsx` |
| Focus store | `src/lib/focus-session.ts` (+ test) |
| Shell / bell | `TutorShell.tsx`, `MessageBell.tsx`, `parent-messages.ts`, `messages-sync.ts` |
| Free explore | `src/lib/explore-catalog.ts` (`resolveFreeExploreTopic`) |
| Me | `src/components/MeHome.tsx` (focus streak strip) |
| Docs | this file, `TODO.md`, `DESIGN.md` |

## Risks

| Risk | Mitigation |
|------|------------|
| 轮换埋掉高价值入口 | 「Another suggestion」+ 优先级保证深潜/练习优先出现 |
| Focus 藏导航找不到 Games | 结束回顾 + 顶栏 Exit focus；非强制 |
| 自由主题无法映射技能 | 关键词匹配目录；否则 `custom:*` + 通用 scientific-method / multi-step 锚点 |
| urgent 漏报 | Focus 时 `minUrgency=urgent` 计数；非 Focus 仍全量 unread |

## Test design

### Unit
- `pickHeroAction`：多候选时只返回 1 个；skip 上次 kind；无候选 → null
- `cycleHeroAction`：循环顺序稳定
- `resolveFreeExploreTopic`："Formula One"→vehicles 邻域或 custom；空串 → null
- `focus-session`：start/remaining/complete/记录写入；可 early end
- `unreadCount(accountId, { minUrgency: "urgent" })`

### Integration / manual
- 空首页：首屏主卡 ≤1 + Another suggestion；点换建议切换种类
- 侧栏：孩子默认 ≤5 一级项；PIN 后 More 见 GitHub / Code Agent
- Focus 20m：角标不因 routine 亮；urgent 仍亮；Me 见今日专注记录
- 自由输入任意主题能开局且 InterestRadar 出现

## Release

`apply_changes` → `publish_develop` → `deploy_live`（src 变更必部署）。
