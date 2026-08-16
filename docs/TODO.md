# 📋 Downstream Development TODO

## CODE-SPARK — Learning Games 首位编程游戏 + 主对话弹出 · 2026-08-16

> **Design:** [subsystems/code-spark-learning-game.md](subsystems/code-spark-learning-game.md)  
> **Goal:** 按账号年级/年龄分层的积木跑图（兴趣向）；主对话涉及编程时主动弹出可 Run 的 InlineGamePanel。

- [x] **CS.1** — `code-spark.ts` + tests（band / run / repeat / ifClear）
- [x] **CS.2** — `CodeSparkGame.tsx` + tokens/icon；EntertainPage **第一张** Learning Game
- [x] **CS.3** — `game-recommend` + `intent-fence` + prompts + useTutorSession 兜底弹出
- [x] **CS.4** — InlineGamePanel 接线；run_tests；publish + deploy_live
- [x] **CS.5** — 趣味闯关：RPG mission 标题 + 1–3 星效率反馈 + 技能轨道芯片（Code.org / Swift / FCC 启发）
- [x] **CS.6** — `advanced` band + 受限 Python DSL（`parsePythonProgram` / `opsToPython`）+ 单测
- [x] **CS.7** — UI：Blocks | Python 模式、starter 模板、解析错误提示；卡片文案更新
- [x] **CS.8** — run_tests → apply_changes → publish_develop → deploy_live

### CODE-SPARK v2 — Blocks-first + Python Bridge · 2026-08-16

> **Design:** [subsystems/code-spark-learning-game.md](subsystems/code-spark-learning-game.md)  
> **Research:** [知乎 148424141](https://zhuanlan.zhihu.com/p/148424141)（Code.org / ScratchJr / Scratch / Blockly → CodeCombat Python → Codecademy / Khan）  
> **Goal:** 默认永远 Blocks；Python 保留为 Bridge（对照预览 + 同关 remake），不按年龄默认文本。

- [x] **CS.v2.1** — `defaultEditorMode` → 全 band `blocks`；track `python-hero` → `text-bridge` / label Python Bridge
- [x] **CS.v2.2** — UI：See as Python 对照预览；积木通关 CTA「Try in Python」同关 remake；Scratch 色分区积木
- [x] **CS.v2.3** — advanced 文案去 Python-default；Entertain / recommend 卡片文案
- [x] **CS.v2.4** — 单测更新 + run_tests
- [x] **CS.v2.5** — apply_changes → publish_develop → deploy_live

### CODE-SPARK v3 — Brilliant concept coaching + chat triggers · 2026-08-16

> **Design:** [subsystems/code-spark-learning-game.md](subsystems/code-spark-learning-game.md)  
> **Research:** [Brilliant coding](https://brilliant.org/topics/coding/) / [CS](https://brilliant.org/cs/) — plain-English concepts, intelligent feedback, Thinking in Code path  
> **Goal:** 概念优先反馈 + Brilliant 轨道命名；主对话编程/CS 词稳定弹出 Code Spark。

- [x] **CS.v3.1** — `conceptFocus` + Brilliant `trackLabel`；`coachFeedback()`；关卡 prompt 概念化
- [x] **CS.v3.2** — `CodeSparkGame` 概念芯片 + coach 结果文案；Entertain 卡片文案
- [x] **CS.v3.3** — `intent-fence` / `game-recommend` / `prompts` 扩展触发词；coding → `gameId: code-spark`
- [x] **CS.v3.4** — 单测（coach / track / triggers）+ run_tests
- [ ] **CS.v3.5** — apply_changes → publish_develop → deploy_live

---

## ENT-SSR — `/entertain` 500 (static prerender + middleware redirect) · 2026-08-16

> **Design:** [subsystems/entertain-static-ssr-fix.md](subsystems/entertain-static-ssr-fix.md)  
> **Goal:** Fix live Internal Server Error on `/entertain` (dynamic SSR Client Manifest failure).

- [x] **ENT-SSR.1** — Sync `/entertain/page.tsx` (no `searchParams`); mirror `/studio`
- [x] **ENT-SSR.2** — `src/middleware.ts`: `hub=studio` → `/studio` via `rewriteEntertainStudioSearch`
- [x] **ENT-SSR.3** — Drop `/console` `force-dynamic` (same 500 class)
- [ ] **ENT-SSR.4** — `run_tests` studio-path; apply_changes → publish_develop → deploy_live; curl 200

## 🧩 MAIN-CHAT-COLLAB — 主对话框协作中枢（2026-08-16）

> **Design:** [subsystems/main-chat-collab-hub.md](subsystems/main-chat-collab-hub.md)  
> **Goal:** 主对话框升级为协作中枢——LLM 隐藏 `~~~intent` fence 自动识别写作/媒体/游戏/Lab 四类需求,在对话流内直接内嵌对应能力;激活 TED/通用 Lab 挑战双向回环。

- [x] **COLLAB.1** — `intent-fence.ts`(parse/strip/detect)+ 单测;`prompts.ts` 注入 intent fence 规则
- [x] **COLLAB.2** — `InlineWritingPanel`:coach 评分 + spot-fix + mentor 对话 + 保存 journal + 一键转媒体
- [x] **COLLAB.3** — `InlineMediaPanel`:structure → `/api/studio/generate` 三态生成 + 入 My Creations
- [x] **COLLAB.4** — `lab-recommend.ts` + `LabRecommendCard`;激活 TedLab stash 回环;`lab-challenge-handoff.ts` + MediaLabChallengeView 同一按钮
- [x] **COLLAB.5** — `game-recommend.ts` + `InlineGamePanel` 内嵌游戏(60vh 容器 + Fullscreen 链接)
- [x] **COLLAB.6** — ChatThread/useTutorSession/TutorShell 接线(TTS strip、pinned strip、dismiss、labReturn 横幅)
- [x] **COLLAB.7** — 单测全绿(intent-fence / game-recommend / lab-recommend / lab-challenge-handoff)
- [x] **COLLAB.8** — apply_changes → publish_develop → deploy_live

## 🔤 WORD-ECHO — Study then spell（2026-08-16）

> Design: **[subsystems/word-echo.md](subsystems/word-echo.md)** v1.2
>
> Display name **Spell Words** (id `word-echo`). Study → type each spelling.

- [x] Pure engine `word-echo.ts` + unit tests (pick / validate / difficulty) — v1.0 recognition
- [x] UI `WordEchoGame.tsx` (study timer → spell input → AUC) — v1.1
- [x] Hub card + deep link `?game=word-echo`
- [x] **WE.1** — Engine: replace tap-recall with `normalizeSpelling` / `validateSpelling` / `hintMode`; drop distractor pool
- [x] **WE.2** — UI: study → spell input (one word at a time, AUC) + hub copy
- [x] **WE.3** — Unit tests for spelling + hint modes; `run_tests` green
- [x] **WE.4a** — Rename display to **Spell Words** (keep id `word-echo`)
- [x] **WE.4** — apply_changes → publish_develop → deploy_live (fix: live still served tap-recall)

## 🏎️ ARCADE-NFS — Nitro Rush · Sky Patrol · Balloon Float · Snake（2026-08-16）

Design: [arcade-nfs-nintendo.md](subsystems/arcade-nfs-nintendo.md)

- [x] **ARC.1** — Engines: `nitro-rush` / `sky-patrol` / `balloon-float` + unit tests
- [x] **ARC.2** — UI components + register on EntertainPage Arcade (+ Snake)
- [x] **ARC.3** — `GameId` / TITLES / types; run_tests green
- [ ] **ARC.4** — apply_changes → publish_develop → deploy_live
- [ ] **ARC.5** — Manual: keyboard + touch on live `/entertain` Arcade cards

## ⬇️ CR-DL — My Creations media download（2026-08-15）

Design: [creations-media-download.md](subsystems/creations-media-download.md)

- [x] **CR-DL.1** — Helper `creationDownloadUrl` (song/video/image; skip missing)
- [x] **CR-DL.2** — CreationsLibrary: Download button next to Share link
- [x] **CR-DL.3** — Share page: Download for recipients
- [x] **CR-DL.4** — Unit tests + run_tests
- [ ] **CR-DL.5** — apply_changes → publish_develop → deploy_live

## 🎤 LAB-VOICE — Discuss mic + British Listen (all studios)（2026-08-15）

> **Design:** [subsystems/lab-discuss-voice-listen.md](subsystems/lab-discuss-voice-listen.md)  
> **Goal:** (1) Discuss reply box mic on TED + BBC/RSA/NatGeo. (2) Prompt + AI coach replies default British Ryan Listen (TED parity for media labs).

- [x] **LAB-VOICE.1** — Docs (design + DESIGN map + this checklist)
- [x] **LAB-VOICE.2** — `MediaLabChallengeView`: prompt Listen / Auto Listen / Ryan hard-lock + mic barge-in
- [x] **LAB-VOICE.3** — `LabDiscussDialogue` + `TedDiscussDialogue`: mic + coach Listen/auto (Ryan)
- [x] **LAB-VOICE.4** — Unit regression `ted-challenge.test.ts` + `run_tests`
- [x] **LAB-VOICE.5** — apply_changes → publish_develop → deploy_live
- [ ] **LAB-VOICE.6** — Manual TM-D1–TM-D5 on live labs

## 🔧 HAK-FIX: 客家话 TTS FormoSpeech 解释器（2026-08-15）

> **Design:** [subsystems/formospeech-hakka-tts.md](subsystems/formospeech-hakka-tts.md)  
> **根因:** PM2 `formospeech-tts` 用系统 `python3` → `No module named 'TTS'` → `/tts` 422

- [x] **HAK.1** — `ecosystem.config.js`：interpreter → `.venv-formospeech/bin/python`；修正 `FORMOSPEECH_PORT`
- [x] **HAK.2** — `smart-build.mjs`：sidecar 用 `pm2 startOrReload ecosystem.config.js`（勿仅 restart）
- [x] **HAK.3** — `formospeech_server.py`：warm 失败写入 `_error`；`/health` `ok:false`
- [x] **HAK.4** — 运维：delete+start sidecar；验收 health ready + hak/teo/sha TTS 冒烟
- [x] **HAK.4b** — 上海话 Qwen WAV MIME sniff（`tts-audio-mime` + player Blob）
- [x] **HAK.5** — apply_changes → publish_develop → deploy_live

> Version 0.9.3 · 2026-08-09  
> Priority: 🔴 critical · 🟡 important · 🟢 nice-to-have  
> Status reconciled against codebase on **2026-08-09** (docs-only; no feature work).  
> Baseline: 27 test files, 243 tests, service `active` at :3001  
> New deletion + theme spec: **[subsystems/deletion-sync-and-themes.md](subsystems/deletion-sync-and-themes.md)** (v0.1 — cross-device deletion sync + 4-theme system)
> New adaptive spec: **[subsystems/grade-agnostic-adaptive.md](subsystems/grade-agnostic-adaptive.md)** (v0.2 — BASIS K-12 + research-backed)  
> New multi-tenant spec: **[subsystems/multi-tenant-isolation.md](subsystems/multi-tenant-isolation.md)** (v0.1 — account data isolation design)  
> New lightbox spec: **[subsystems/image-lightbox-zoom.md](subsystems/image-lightbox-zoom.md)** (v0.1 — portal stacking + zoom)  
> Dictionary / Translation: **[subsystems/dictionary-api.md](subsystems/dictionary-api.md)** (word + LLM sentence/photo translate)  
> Entertainments: **[subsystems/entertainments.md](subsystems/entertainments.md)** (v0.6 — challenge AI depths + quiescence)  
> Competitive analysis v2: **[subsystems/competitive-product-plan-v2.md](subsystems/competitive-product-plan-v2.md)** · **[subsystems/competitive-feature-analysis.md](subsystems/competitive-feature-analysis.md)** · **[subsystems/competitive-ui-design.md](subsystems/competitive-ui-design.md)**  
> P0 hardening: **[subsystems/ca-p0-acceptance-hardening.md](subsystems/ca-p0-acceptance-hardening.md)** · B3: **[subsystems/ca-b3-voice-tolerance.md](subsystems/ca-b3-voice-tolerance.md)**  
> Code Agent pipeline: **[subsystems/code-agent-pipeline.md](subsystems/code-agent-pipeline.md)** (research → design → TODO → develop push → deploy)
> Listen sync + Stop: **[subsystems/listen-voice-sync-stop.md](subsystems/listen-voice-sync-stop.md)**
> AI FAQ (Ask AI): **[subsystems/ai-faq.md](subsystems/ai-faq.md)**
> Claude report 2026-08: **[subsystems/claude-report-2026-08-feasibility.md](subsystems/claude-report-2026-08-feasibility.md)** (RPT2 public harden + Socratic integrity)
> UX competitor report 2026-08: **[subsystems/ux-competitor-report-2026-08-feasibility.md](subsystems/ux-competitor-report-2026-08-feasibility.md)** (wait phases + step chips + Slice A–D)
> v4 deep analysis 2026-08: **[subsystems/report-v4-feasibility.md](subsystems/report-v4-feasibility.md)** (Studio BKT outcome + printable portfolio)
> Product audit 2026-08: **[subsystems/product-audit-2026-08-roadmap.md](subsystems/product-audit-2026-08-roadmap.md)** (**多语言 + Code Agent 锁定保留**)
> TED list grade fit: **[subsystems/ted-lab-learner-fit-sort.md](subsystems/ted-lab-learner-fit-sort.md)**  
> Journal Timeline + Me hub + Stage styles: **[subsystems/journal-and-me-hub.md](subsystems/journal-and-me-hub.md)**  
> Spark 深度分析落地 P0→P2: **[subsystems/spark-deep-analysis-roadmap.md](subsystems/spark-deep-analysis-roadmap.md)**
> Short video upload: **[subsystems/short-video-upload-parse.md](subsystems/short-video-upload-parse.md)**
> Upload size 256MB: **[subsystems/upload-size-limit-256mb.md](subsystems/upload-size-limit-256mb.md)**
> Physics Learning Games (design): **[subsystems/physics-learning-games.md](subsystems/physics-learning-games.md)**
> Learning Games v2 UI/design redesign: **[subsystems/learning-games-v2.md](subsystems/learning-games-v2.md)**

---

## 🎯 UX-V4 — Experience P0: 减法 + Focus Mode（2026-08-15）

> **Design:** [subsystems/ux-v4-experience-p0.md](subsystems/ux-v4-experience-p0.md)  
> **Source:** Spark 四维学习力深度调研报告 V4（用户体验专项）§6 P0  
> **Goal:** 首屏单一主行动 + 导航 4+1 + Focus Mode v0 + 自由探索输入。不动苏格拉底 / BKT 归因 / 短回复守卫。

- [x] **UXV4.1** — `hero-action-rotation.ts` + ChatThread 空状态只渲染 1 主卡 + Another suggestion
- [x] **UXV4.2** — HistorySidebar 一级 Me/Progress/Studio/Games；More 收起 Family/Dict/Help；GitHub/Code Agent 需家长 PIN
- [x] **UXV4.3** — `focus-session.ts` + TutorShell 专注壳 + MessageBell urgent-only + Me 页专注记录
- [x] **UXV4.4** — `resolveFreeExploreTopic` + 探索卡自由输入行
- [x] **UXV4.5** — unit tests + run_tests
- [ ] **UXV4.6** — apply_changes → publish_develop → deploy_live

---

## 🎨 SIDEBAR-DENSITY — Left nav readability + compact footer (2026-08-15)

> **Design:** [subsystems/sidebar-density.md](subsystems/sidebar-density.md)

- [x] SB.1 — Bump Search + conversation title/meta type scale in `HistorySidebar`
- [x] SB.2 — Compact footer: Progress/Dict into 3-col rows (no dedicated full-width rows)
- [x] SB.3 — Update README + ui-architecture §5.4 notes
- [x] SB.4 — run_tests; deploy_live after src change

---

## ⚛ PHYS-LG — Physics Learning Games (2026-08-14) — CODE READY, NOT DEPLOYED

> **Design:** [subsystems/physics-learning-games.md](subsystems/physics-learning-games.md)  
> **Goal:** Add physical-science Learning Games for Ryan’s physics interest without jumping to G6 algebra physics.  
> **Production lock:** Source + Vitest only. **Do not** `npm run build`, **do not** `pm2 restart`, **do not** push until explicitly approved.

- [x] **PHYS-LG.0** — Confirm portfolio = Force Bay + Energy Chain + Orbit Scout (keep Eco Genesis)
- [x] **PHYS-LG.1** — Catalog: `forces-motion` + `energy-transfer` skills; `phys-*` misconception tags
- [x] **PHYS-LG.2** — `StudioLearningSource` / `LearningSource` += `"game"`; migrate Voyager / Vault / Genesis
- [x] **PHYS-LG.3** — Force Bay pure stepper + Vitest
- [x] **PHYS-LG.4** — ForceBayGame + EnergyChainGame + OrbitScoutGame + EntertainPage cards
- [x] **PHYS-LG.5** — Explore topic `physics` + `recordInterest` after play
- [ ] **PHYS-LG.8** — Parent/ops approval → build + deploy (blocked until green light)

---

## 🎨 LG-V2 — Learning Games UI & game-design redesign (2026-08-14) — DESIGN ONLY

> **Design:** [subsystems/learning-games-v2.md](subsystems/learning-games-v2.md)  
> **Goal:** Fix "childish" feel across all six games — de-emoji, single-accent dark UI, juice, implicit tutorial.  
> **Production lock:** design doc only; no code until approved. Keeps `src/lib/entertain/*` + BKT attribution unchanged.

- [x] **LG-V2.0** — Diagnose childish signals in current 6 games (emoji, external rewards, no juice)
- [x] **LG-V2.1** — Research modern puzzle/edutainment UI (Monument Valley / BABA / STEM Case / juice)
- [x] **LG-V2.2** — Write unified design-language doc (tokens, de-emoji, juice, implicit tutorial)
- [ ] **LG-V2.3** — P0 infra: shared tokens + SVG icon set + juice primitives (spring/hit-pause/particle)
- [ ] **LG-V2.4** — P1 per-game UI rebuild: Voyager → Force Bay → Energy Chain → Orbit Scout → Eco → Time Vault
- [ ] **LG-V2.5** — P2 audio + haptics layer (graceful silent fallback)

---

## 📦 UP256 — File upload size limit → 256MB（2026-08-14）

> **Design:** [subsystems/upload-size-limit-256mb.md](subsystems/upload-size-limit-256mb.md)  
> **Goal:** Raise per-file picker limit to 256MB; align Next body buffer + nginx so base64 JSON payloads succeed.

- [x] **UP256.1** — `MAX_FILE_BYTES` / `MAX_FILE_MB` in `attachments.ts` (+ agent-chat parity)
- [x] **UP256.2** — Error/hint strings in `file-payload.ts` + `extract-files.ts`
- [x] **UP256.3** — `next.config.ts`: `proxyClientMaxBodySize` + `serverActions.bodySizeLimit` = 512mb
- [x] **UP256.4** — Unit tests UP-1…UP-3; `run_tests`
- [x] **UP256.5** — Nginx `client_max_body_size 512m` + reload
- [x] **UP256.6** — Commit → publish_develop → deploy_live (471c3d3; master merged)

---

## 🎬 VID — Short video upload & parse（2026-08-13）

> **Design:** [subsystems/short-video-upload-parse.md](subsystems/short-video-upload-parse.md)  
> **Goal:** Tutor / Code Agent / Ask AI accept short mp4/webm/mov/m4v (≤12MB); server extracts speech (STT) + keyframe OCR into file summaries.

- [x] **VID.1** — Allowlist + MIME + `FILE_INPUT_ACCEPT` (`attachments.ts`)
- [x] **VID.2** — Client base64 payload for video (`file-payload.ts`)
- [x] **VID.3** — `extract-video.ts`: ffmpeg audio + frames + Bailian/local STT + OCR
- [x] **VID.4** — Wire into `buildFileSummaries`
- [x] **VID.5** — Unit tests (VID-1…VID-7); run_tests
- [ ] **VID.6** — Commit → publish_develop → deploy_live

---

## 🔴 VID-RELOAD — 手机存在视频对话时页面无限刷新（已修复 · 已部署）

> **症状:** 手机上只要存在「上传过视频」的对话，页面就会一直刷新、一直"识别"（视频被反复下载/处理）。iPhone Chrome 约每 12 秒整页重载一次。
> **排查日期:** 2026-08-14（用户正在使用中，未重启/未部署）

### 根因（已确认，runtime 证据）

**`src/lib/photo-vault.ts` 的 `fetchMissingPhotosFromServer()` 把视频当照片处理。**

- 该函数在每次跨端同步时被调用（`useTutorSession.ts` L595 的 `sync()`：60s 定时 + `visibilitychange` 可见时触发）。
- 它对**任何**「有 `mediaId` 但无 `dataUrl`」的附件（**包括视频**）执行：
  1. `fetch('/api/media/{mediaId}')` —— **不带 Range 头 → 服务器返回 200 全量**
  2. `res.blob()` → `FileReader.readAsDataURL()` → 把整段视频转成 base64 `dataUrl`（54MB 视频 → ~72MB 字符串）
  3. `putPhotoInVault()` 把这份 base64 缓存进 IndexedDB
  4. 把 `dataUrl` 挂回 store 状态（React 内存中多存一份）
- 这违背了视频设计的核心约束（视频只带 `data` 不带 `dataUrl`，正是 `file-payload.ts` / `slimMessages` 为防手机 OOM 而做的设计），导致 iPhone 内存耗尽 → Safari 杀页面自动重载 → 重载后再同步再全量下载 → **无限重载循环**（即「一直刷新」+ 视频反复下载的「一直识别」）。

**runtime 证据（`/var/log/nginx/access.log`，视频媒体 `1c32d41b-47b2-4728-a00b-_b8d4d38a3496d1ff1fc74c21` = 54,039,430 字节）：**
- iPhone `45.138.210.144`（`CriOS/151`）：
  - `06:29:27` / `06:29:28` / `06:30:13` / `06:30:21` → **206**（`<video>` 正常流式 Range 请求）
  - `06:30:19` → **`200 54039430`**（`fetchMissingPhotosFromServer` 全量下载整个视频）
  - `06:32:03` / `06:32:15` / `06:32:22` → 连续完整页面加载序列（约 **12 秒重载一次** = 无限刷新）
- Windows / Mac 客户端同样出现全量 `200 54039430`（06:28:58、06:29:13、06:29:24、06:31:47）

### 同类问题排查（其他附件类型，2026-08-14）

| 类型 | 上传时 | 跨端同步 | 结论 |
|------|--------|----------|------|
| **图片 image** | 压缩后小（`compressImageDataUrl`） | 会被 `fetchMissingPhotosFromServer` 拉取 | ✅ 安全（设计内，跨端照片同步） |
| **视频 video** | `data` only（已修） | ❌ 全量拉取 → base64 → OOM | 🔴 已确认根因 |
| **PDF / Office(docx/pptx/xlsx)** | `dataUrl`+`data` 双份全量 base64 | ❌ 全量拉取 → base64 → OOM | 🔴 **同类问题，待修复** |
| **文本 md/txt/csv/html/code/json/log** | 截断 80KB，urlencoded dataUrl | 小（≤80KB） | ✅ 安全 |

**PDF/Office 的三个同类缺陷（均已定位）：**

1. **跨端重载/OOM 循环（与视频同机制）** — `fetchMissingPhotosFromServer()` 对「有 `mediaId` 无 `dataUrl`」的任意附件都执行全量 `fetch → blob → readAsDataURL → 写 vault`。PDF/Office 是 ≤256MB 的二进制，跨设备打开时会像视频一样把整份文件转成 base64 塞进内存 → 手机 OOM → 重载循环。
2. **上传时内存双份** — `file-payload.ts` 对 PDF/Office 同时返回 `dataUrl` 和 `data`（都是完整 base64）；`handleSend` 又把 `dataUrl` 放进 `userMessage.attachments`（L1251）且把 `data` 放进 `attachments[]`（L1322），同一份文件在请求体里出现两次，JSON.stringify 再复制一次 → 手机 OOM → 499 重载（正是当初视频的 bug，但只对视频加了 `MAX_VIDEO_BYTES`+data-only，PDF/Office 漏了）。
3. **localStorage 配额** — `slimMessages` 只 strip 视频的 dataUrl（L144 `isVideoAttachment`），PDF/Office 的 dataUrl 原样保留；超大文件会撑爆 5MB 配额，`saveConversations` 的兜底路径也因 `if (a.dataUrl) return a`（L150）先命中而无法剥离 → 静默写失败。

### 修复方案（待用户允许后开发 + 部署）

> 核心原则：**二进制大文件（视频 + PDF + Office）在客户端「永不生成 dataUrl」**，只用 `mediaId` 流式/下载；只有小图片保留 dataUrl。把这条约束在 4 条链路都补上。

- [x] **VID-RELOAD.1** — `fetchMissingPhotosFromServer()`：对**二进制大附件**（`isLargeBinaryAttachment` = `isVideoAttachment` || `application/pdf` || `isOfficeAttachment`）**跳过** fetch / 不转 dataUrl / 不写 vault（只对小图片保留跨端拉取）
- [x] **VID-RELOAD.2** — `restoreStorePhotosFromVault()`：对上述二进制大附件**跳过**从 vault 恢复 dataUrl
- [x] **VID-RELOAD.3** — `slimMessages()`：除视频外，PDF/Office 的 dataUrl 也 strip（只留 mediaId），图片继续保留
- [x] **VID-RELOAD.4** — `file-payload.ts`：PDF/Office 改为 **data-only**（去 `dataUrl`，与视频一致），上传时不再内存双份
- [x] **VID-RELOAD.5** — `restoreStorePhotosFromVault()` 内联清理：跳过二进制大附件时同时 `deletePhotosFromVault(ids)` 删除 vault 里已存在的视频/PDF/Office dataUrl 条目（防历史污染）
- [x] **VID-RELOAD.6** — 单测：binary 附件不进 fetch/restore/slim；image 行为不变；PDF/Office data-only（新增 `photo-vault.test.ts`，更新 `storage.test.ts` / `file-payload.test.ts` / `attachments-docs.test.ts`）
- [x] **VID-RELOAD.7** — build + deploy + 健康检查（2026-08-14 08:14 构建成功，`spark-tutor`/`formospeech-tts`/`spark-acc`/`spark-stt`/`spark-watchdog` 全部 active，health-check `ok=true`）；**iPhone 复测待用户验证**（上传视频/PDF → 对话内流式/下载正常、页面不再重载）

> **新增共享辅助:** `attachments.ts` → `isLargeBinaryAttachment(mimeType, name)`，统一判定「视频/PDF/Office」等二进制大附件；`ChatThread.tsx` 的 vault effect 也对其跳过 vault 读取（直接走 `/api/media` 流式/下载），并补齐 `vaultChecked` 标记。

---

## 🎯 SPARK-DEEP — 优等生深度体验落地（P0→P2）（2026-08-13）

> **基准报告:** `evaluation/Spark_竞品调研与优等生体验深度分析_2026-08-13.md` §9/§10 路线图  
> **Design:** [subsystems/spark-deep-analysis-roadmap.md](subsystems/spark-deep-analysis-roadmap.md)  
> **目标:** P0 归因数据修复 + 高掌握度"饥饿循环" + 视觉默认；P1 错题组卷 + 整页 OCR 批改 + 兴趣雷达 + 家长周报方向栏 + 知识版图；P2 趣味与成长叙事（成长时刻 / 鼓励归因 / 季度方向报告 / 实验室跨内容推荐 / 几何交互可视化）

- [x] **SPARK-DEEP.1 (P0-1 归因修复)** — `mergeSourceCounts` 幂等 `Math.max` 合并；`attributionBySource` 周窗口滚动统计；`gapHistory` 合并去重；清洗脚本 `scripts/reset-attribution.mjs`；`learning-memory.test.ts` 补周窗口/幂等用例
- [x] **SPARK-DEEP.2 (P0-2 饥饿循环)** — `session-opener.ts` `highMasteryMode`（pKnown≥0.8 ≥60%）→ Challenge me! + 相邻新技能 + 深挖为什么；`ChatThread` 高掌握下相邻卡不被 opener 压制、按钮升主视觉
- [x] **SPARK-DEEP.3 (P0-3 视觉默认)** — high 先验默认 reactive（仅错题后一次机会、无 idle 推题）；Retry/继续挑战按钮默认高亮样式
- [x] **SPARK-DEEP.4 (P1-1 本周组卷)** — `wrong-answer-store.ts` `buildWeeklyQuiz` + `WrongAnswerBook` 组卷按钮/打印视图/完成后回写标记重做
- [x] **SPARK-DEEP.5 (P1-2 整页 OCR 批改)** — `image-ocr.ts` 逐题解析 + 批改指令注入 tutor prompt；错题自动 `addWrongAnswer` 入库；页尾"重做 N 道"按钮
- [x] **SPARK-DEEP.6 (P1-3 兴趣雷达)** — `interest-store.ts` `buildCuriosityMap` + `InterestRadar` 卡挂载 MeHub（兴趣词 + 最近探索 + 好奇心地图）
- [x] **SPARK-DEEP.7 (P1-4 家长周报方向栏)** — `parent-digest.ts` `interestFocus` + `nextChallenge`（吃归因：本周已掌握 → 推荐相邻）；`family-report.ts` + `FamilyControlsPage` 渲染
- [x] **SPARK-DEEP.8 (P1-5 知识版图)** — `dashboard-stats.ts` `buildDashboardExtras`（来源维度 + 相邻推荐）；`LearningDashboard` 空态不再全隐（兴趣足迹常显）
- [x] **SPARK-DEEP.9 (P2-1 成长时刻)** — `skill-dots.ts` `litThisWeek` + `SkillDots` "本周点亮 N 个圆点 + level-up" 横幅与脉动动画
- [x] **SPARK-DEEP.10 (P2-2 鼓励归因)** — `JournalTimeline` `PraiseAttribution`："Mom liked your ▶ Rocket launch because …"
- [x] **SPARK-DEEP.11 (P2-3 季度方向报告)** — `direction-report.ts` `buildSelfDescription` + `DirectionCard` 挂载 MeHub 顶部（兴趣+作品自动生成，可编辑 / 🎲 重新生成）
- [x] **SPARK-DEEP.12 (P2-4 实验室跨内容推荐)** — `cross-lab.ts` 主题标签路由 + `CrossLabSuggest` 挂载 TED/NatGeo/BBC/RSA 观看与阅读页（"看了黑洞 → 去 NatGeo 看恒星"）
- [x] **SPARK-DEEP.13 (P2-5 几何交互可视化)** — `geometry-svg.ts` `describeGeometryShapes` + `GeometryStepPlayer` "Where to look" 高亮形状 chips + 测量标注 callout + 步骤切换动画
- [x] **SPARK-DEEP.14 (tests)** — 新增 direction-report / cross-lab + 扩展 parent-digest / dashboard-stats / skill-dots / geometry-svg；全量测试通过
- [x] **SPARK-DEEP.15 (docs)** — `spark-deep-analysis-roadmap.md` + TODO 勾选
- [x] **SPARK-DEEP.16 (release)** — build（smart-build）+ pm2 重启 + 健康检查全 200

---

## 🎯 SPARK-V2 — V2 四维学习飞轮三阶段（2026-08-13）

> **基准报告:** `evaluation/Spark_四维学习力深度调研报告_V2_2026-08-13.md` §10 路线图  
> **Design:** [subsystems/spark-v2-flywheel.md](subsystems/spark-v2-flywheel.md) · [subsystems/spark-research-roadmap.md](subsystems/spark-research-roadmap.md) § V2 三阶段  
> **目标:** P0 主动出击+信号转活+兴趣反哺；P1 BKT 先验分层+每周 Launchpad+广度导航+兴趣作品闭环；P2 好奇心干预+动态连接卡+作品墙+快速路径扩容+课程序列分离+数据归因

- [x] **SPARK-V2.1 (P0-proactive)** — `proactive-nudge.ts`（答错/闲置触发、每会话一次、dismiss 不骚扰）+ `useTutorSession` 记录 + `ChatThread` 非阻塞邀请条
- [x] **SPARK-V2.2 (P0-flow)** — `recordFlowTurn` advice → `flowMoment` UI + step-up/down 注入 `coachNote` prompt
- [x] **SPARK-V2.3 (P0-interest)** — `pickExploreTopics(mem, limit, interests?)` 兴趣加权 + kickoff 延续文案 + `planExploreSequence` 接线
- [x] **SPARK-V2.4 (P1-bkt-tier)** — `bktPriorTier` 先验分层 + `detectPriorTier` + `autoAdvanceCheck` 高先验更灵敏
- [x] **SPARK-V2.5 (P1-launchpad)** — `weekly-launchpad.ts` 聚合深潜/连接/Feynman/目标 → ChatThread「This week」聚合卡
- [x] **SPARK-V2.6 (P1-breadth-nav)** — `buildSubjectBridges` 跨学科桥梁（已掌握→相邻未探索，最强锚点）+ LearningDashboard 展示
- [x] **SPARK-V2.7 (P1-creation-loop)** — 探索末尾"喜欢"信号 → `creationOffer` 轻量卡 → Studio/Journal
- [x] **SPARK-V2.8 (P2-curiosity)** — 探索/深潜 kickoff 追加知识缺口指令（反直觉事实 → 苏格拉底阶梯）
- [x] **SPARK-V2.9 (P2-dynamic-card)** — `buildDynamicConnectionOffer` 双学科已掌握 → 动态连接卡（优先级高于周卡）
- [x] **SPARK-V2.10 (P2-workswall)** — `JournalEntry.praise` + `PATCH /api/journal`（禁自赞）+ JournalTimeline Everyone `PraiseChip`
- [x] **SPARK-V2.11 (P2-fastpath)** — `local-facts.ts` 公式/百分比/名词释义/历史时间线速查（中英双语确定性）
- [x] **SPARK-V2.12 (P2-seq-dialog)** — `planExploreSequence`/`planOneExploreTopic` 纯函数（课程序列 vs LLM 对话分离）
- [x] **SPARK-V2.13 (attribution)** — `SkillMastery.sourceCounts`/`lastSource` + `recordLearningTurnMemory(source)` + `attributionBySource` + 家长周报 `sourceAttribution`/Main drivers
- [x] **SPARK-V2.14 (tests)** — 新增 proactive-nudge / weekly-launchpad + 扩展 flow/explore/bkt/breadth/connection/learning-memory/parent-digest/local-facts/journal-route；全量 1525 passed
- [x] **SPARK-V2.15 (docs)** — `spark-v2-flywheel.md` + roadmap + TODO + DESIGN + README
- [x] **SPARK-V2.16 (release)** — publish develop/master + build + pm2 restart + health（`904a2eb`，2026-08-13 上线，home/journal 200）

---

## 🎯 SPARK-V3 — 让学习飞轮"转起来"（归因链路修复 + 主动出击校准 + 验证进化）（2026-08-13）

> **基准报告:** `evaluation/Spark_四维学习力深度调研报告_V3_2026-08-13.md`  
> **Design:** [subsystems/spark-research-roadmap.md](subsystems/spark-research-roadmap.md) § V3 三阶段  
> **目标:** P0 归因链路修复（序列化/合并保字段 + 补齐 source 写入 + 家庭页学力来源卡）；P0/P1 主动出击校准（视觉默认重试按钮 + 优秀学生 reactive + 短而具体回复 + 广度触发归因）；P1/P2 验证进化（作品墙点亮 + 兴趣画像服务端持久化）

- [x] **SPARK-V3.1 (P0-attribution)** — `serializeLearningMemoryForChat`/`mergeSkill` 保留 `sourceCounts` + `lastSource`（sum + 取新）；`LearningSource` 扩到 ted/writing/natgeo/bbc/rsa/creation
- [x] **SPARK-V3.2 (P0-source-writes)** — `recordStudioLearningTurn` 传 source；`handleStartDeepDive` 锚点落 wrongbook/deepDive；`SessionOpener.source` 让错题本/变式/学科桥 kickoff 携带 wrongbook/variant/connection
- [x] **SPARK-V3.3 (P0-family-card)** — `FamilyControlsPage`「本周学力来源」Top 3 卡（label + count + 一句"我注意到……我们一起……"建议）
- [x] **SPARK-V3.4 (P0-nudge-visual)** — proactive 邀请从 coral 横幅改为动作行内视觉默认 "Retry this problem" 按钮（CHI RCT 视觉默认 +9pp vs 文本 +2pp）
- [x] **SPARK-V3.5 (P0-nudge-reactive)** — `shouldProactiveInvite` 支持 `priorTier`，high-prior 学生 recent-wrong 不再主动邀约（idle-return 仍允许）
- [x] **SPARK-V3.6 (P1-short-reply)** — `buildTutorPrompt` 短而具体守卫（≤2 句 + 具体类比/例子/对比，长分析仅限深潜 Explain）
- [x] **SPARK-V3.7 (P1-breadth-attr)** — subject-bridge / adjacent opener 发送 `connection` source，广度导航可归因
- [x] **SPARK-V3.8 (P1-works-wall)** — 验证 Everyone PraiseChip 可赞可评 + Me 页"收到的鼓励"入口 + Make-it-yours 计入 creation 归因
- [x] **SPARK-V3.9 (P2-interest-sync)** — `/api/interest`（GET/PUT）+ `interest-store-server.ts` 服务端持久化，跨设备 hydrate + merge + 上行
- [x] **SPARK-V3.10 (tests)** — 新增/扩展 7 套件（learning-memory / proactive-nudge / studio-learning / family-report / interest-store / creation-offer / api-interest）；全量 **1587 passed / 193 files**（`npm test -- --no-cache`）
- [x] **SPARK-V3.11 (docs)** — roadmap + TODO + DESIGN + README 同步 V3
- [x] **SPARK-V3.12 (release)** — publish develop/master（推 GitHub 两分支）

---

## 🎯 SPARK-4D — 四维学习力 P0→P2（2026-08-13）

> **基准报告:** `evaluation/Spark_四维学习力深度调研报告_2026-08-13.md`（兴趣 / 心流 / 深度 / 广度）  
> **Design:** [subsystems/spark-research-roadmap.md](subsystems/spark-research-roadmap.md) § 四维学习力路线图  
> **目标:** P0 兴趣选择回路 + 心流难度微调 + 问即答快速路径；P1 深度探究日 + 错题变式/概念提升 + 跨学科连接卡与学科足迹地图；P2 体验精修（一键即玩卡片 + 专注护栏 + 领域间自动推荐）

- [x] **SPARK-4D.1 (P0-interest)** — `explore-catalog.ts` 探索主题（12 条，映射 `SkillDef`）+ `interest-store.ts` 兴趣档案 + 空聊天「Today, I want to explore…」chips
- [x] **SPARK-4D.2 (P0-flow)** — `flow-signals.ts` 连对/连错/快答/慢答信号 + `TutorShell` 延迟采集 + `challenge-mode` 难度升/降档 + `challengeGauge` 掌握度仪表
- [x] **SPARK-4D.3 (P0-fastpath)** — `local-facts.ts` 扩容：小算术/温度换算/分数小数/矩形周长面积/双倍三倍（中英双语、确定性、歧义回退 Agent）
- [x] **SPARK-4D.4 (P1-deep)** — `deep-dive-week.ts` 每周深度探究日（每周三、5E 流程 kickoff、错题/掌握技能锚点）+ 每周深度项目卡
- [x] **SPARK-4D.5 (P1-wrongbook)** — `wrong-answer-store.ts` variant/harder 路径 + `WrongAnswerBook`「Variant — new numbers / Harder — level up」按钮
- [x] **SPARK-4D.6 (P1-breadth)** — `connection-card.ts` 每周跨学科连接卡 + `breadth-map.ts` 学科足迹地图 + `LearningDashboard`「Your subject map / exploration footprint」
- [x] **SPARK-4D.7 (tests)** — 新增 6 个测试套件 + 扩展 3 个（flow/explore/interest/deep-dive/connection/breadth + local-facts/challenge-mode/wrong-answer-store）
- [x] **SPARK-4D.8 (P2-cards)** — 空聊天文字按钮升级 2×2 一键即玩卡片网格（`QuickActionCard`：Quick questions / Another topic / Challenge me! / Snap homework），探索 chips 上浮
- [x] **SPARK-4D.9 (P2-guardrail)** — `focus-guardrail.ts` 非阻断专注护栏（未完成 worksheet + 今日 dismiss 门控）+ `HistorySidebar` Games 旁提示条 + `EntertainPage` Games 页顶部横幅
- [x] **SPARK-4D.10 (P2-adjacent)** — `SkillDef.adjacent` 相邻技能关系 + `adjacent-recommend.ts`（pKnown≥0.8 → 推荐未掌握相邻技能，优先未触碰/跨学科）+ `ChatThread`「A neighbor to explore」卡
- [x] **SPARK-4D.11 (P2-tests)** — 新增 `focus-guardrail.test.ts` / `adjacent-recommend.test.ts` + 扩展 `skill-catalog.test.ts`（adjacent 引用校验）
- [ ] **SPARK-4D.12** — `run_tests` → apply_changes → publish_develop → deploy_live（待本轮发布）

---

## 🎯 SPARK-ROADMAP — 竞品调研路线图 P0→P3（2026-08-13）

> **基准报告:** `/root/AI教学产品调研与Spark分析报告.md` §9 三阶段路线图  
> **Plan:** `.cursor/plans/spark-research-roadmap_a9ae02ea.plan.md`（不改动 plan 文件本身）  
> **目标:** 体验激活 → 优等生挑战性 → 趣味与家庭 → 几何交互可视化（stretch）

- [x] **SPARK-R.0** — Me 时间线删除单条记录（Wrote/Empty day 卡 + Related 创作块；`removeJournalMadeBlock` + DELETE `creationId` + 两击确认 `DeleteChip`）
- [x] **SPARK-R.0b** — Timeline `DeleteChip` 常显（触屏可发现：图标+文案、≥44px、两击确认）；Me peek + `/me/journal` 手动验证
- [x] **SPARK-R.1 (P0-opener)** — 开场卡「再给我一题/拍作业」+ `challengeLine` 高阶提示 + `rotateSessionOpener`
- [x] **SPARK-R.2 (P0-fastpath)** — `local-facts.ts` 单位换算/路程公式/平方立方/百分比口算 + 接入 `useTutorSession`
- [x] **SPARK-R.3 (P0-dots)** — `SkillDots` 成长可视化挂到 `MeHome`
- [x] **SPARK-R.4 (P1-challenge)** — `challenge-mode.ts` + 开场卡 Challenge me! 入口 + 连对升档
- [x] **SPARK-R.5 (P1-whatif)** — 回复「继续深挖」：换方法/边界/跨学科（`buildDeepDivePrompt` + `DeepDiveControl`）
- [x] **SPARK-R.6 (P1-wrongbook)** — `wrong-answer-store` + 错题本 UI + 重做 3 题/组卷 + 开场卡复习入口
- [x] **SPARK-R.7 (P2-feynman)** — `feynman-task.ts` 每周「讲给家人听」任务 + 家长周报项 + Family 页面卡片
- [x] **SPARK-R.8 (P2-weekgoal)** — `weekly-goal.ts` 本周掌握 3 个新技能短周期目标 + `WeeklyGoalCard`
- [x] **SPARK-R.9 (P2-report)** — 家长周报「本周最大突破」成长叙事（`recentWins` + session digests）
- [x] **SPARK-R.10 (P2-voice)** — `ReadAlongPractice` 读一段给我听：TTS 范读 → 录音 STT → 朗读准确率反馈
- [x] **SPARK-R.11 (P3-geometry)** — 几何步骤高亮：`GeometryStep` + `buildGeometrySvg(opts.stepIndex)` 变暗 + 量标注 callout + ```` ```geom-steps ```` 交互播放器 `GeometryStepPlayer`

---

## 🧭 UX-IA — Family platform IA + Lab search refresh (2026-08-12)

> **North star:** [DESIGN.md](DESIGN.md) § Family Learning Platform (2026-08 update)  
> **External audit:** `/root/spark-tutor-用户体验与产品化分析报告.md` (UX/productization, not security)

- [x] **UX-IA.1** — Sidebar/README labels: Studio / Games / Family / Progress (no feature cuts)
- [x] **UX-IA.2** — `TutorShell` split: extract session hook; thinner shell JSX
- [x] **UX-IA.3** — Family first-visit dismissible guidance (PIN → chat → Progress/Messages)
- [x] **UX-IA.4** — BBC/RSA/NatGeo: API search + Refresh batch (TED parity; caption gate for YT)
- [x] **UX-IA.5** — Tests + README + push develop/master

---

## 🎯 ENT-LAB-PARITY — BBC / NatGeo / RSA Challenge = TED benchmark (2026-08-12)

> **Design:** [subsystems/lab-challenge-ted-parity.md](subsystems/lab-challenge-ted-parity.md)  
> **Goal:** (1) Prefer English YouTube CC → questions. (2) Essay voice input. (3) Submit & discuss inline Socratic coaching — not one-shot Submit & Next.

- [x] **ENT-LAB.1** — Caption-first: YT search gate + challenge requires EN CC; live clip resolve; NatGeo CC-before-article
- [x] **ENT-LAB.2** — `lab-discuss` + `POST /api/lab/discuss` + `LabDiscussDialogue` / `MediaLabChallengeView`
- [x] **ENT-LAB.3** — Wire BbcDocLab / RsaShortsLab / NatGeoLab: voice `appendVoiceTranscript` + Submit & discuss
- [x] **ENT-LAB.4** — Unit LD* + clip-resolve tests
- [x] **ENT-LAB.5** — apply_changes → publish_develop → deploy_live
- [ ] **ENT-LAB.6** — Manual: BBC/RSA/NatGeo Submit & discuss stays on Lab; Next advances qi

---

## 📓 JM — Journal + Me hub + Stage styles (2026-08-12) — DESIGN ONLY

> **Design:** [subsystems/journal-and-me-hub.md](subsystems/journal-and-me-hub.md)  
> **Status:** JM.1–JM.4 implemented (Facebook Timeline). JM.5 later.  
> **Goal:** Journal = New + Timeline of related records; Creations auto-write into today’s journal; Stage styles in Stage with Structure-suggested default.

- [x] **JM.0a** — Spec drafted + revised (Structure default style; New/history; Creation→journal)
- [x] **JM.0b** — Product confirms C1–C7 + Facebook Timeline spine (2026-08-12)
- [x] **JM.1** — Stage styles + Structure `suggestedStyle` default + pad genre removed
- [x] **JM.2** — Journal store/API + New + Timeline history + `journal` type
- [x] **JM.3** — `/me` + sidebar Me + peek + Open all
- [x] **JM.4** — Creation save → append/create today’s journal + snapshot
- [ ] **JM.5** — Family read-only + On This Day *(later)*
- [x] **JM.6** — pushed `5f1c0c2` to develop+master; build + pm2 restart (live 200)

---

## 🛡️ AUDIT8 — Product audit slices (2026-08-11)

> **Design:** [subsystems/product-audit-2026-08-roadmap.md](subsystems/product-audit-2026-08-roadmap.md)  
> **Locks:** keep all languages/dialects; keep Code Agent full pipeline.  
> **Goal:** Coach state machine + parent alias/TTS + FSRS-lite review queue + kid copy + photo crop; CA child-safe later.

- [x] **AUDIT8.1** — `coach-state.ts` + unit tests (frustration / IDK / strategy ladder)
- [x] **AUDIT8.2** — Inject coach block into `buildTutorPrompt`; extend Socratic integrity tests
- [x] **AUDIT8.3** — Kid-facing `engagementSummary` + `learningMemorySummary`
- [x] **AUDIT8.4** — `review-queue.ts` (FSRS-inspired R) + wire opener/practice
- [x] **AUDIT8.5** — `/parent` → `/family` (TTS Listen digest deferred — edit budget)
- [x] **AUDIT8.6** — Photo crop (`cropImageDataUrl` + modal) after camera
- [x] **AUDIT8.7** — Code Agent safe suggestions / PIN for destructive (keep agent) — [ca-child-safe-and-voice-lazy.md](subsystems/ca-child-safe-and-voice-lazy.md)

## 📷 CROP-MOBILE — Homework photo crop on phones (2026-08-12)

> Design: [subsystems/photo-crop-mobile.md](subsystems/photo-crop-mobile.md)

- [x] **CROP-M.1** — Export `clientToCropNorm` / `rectFromDrag` / `isNearFullFrameCrop` in `image-process.ts`
- [x] **CROP-M.2** — `PhotoCropModal`: `dvh` + safe-area + `min-h-0` stage; `block max-h-full` img; body scroll lock
- [x] **CROP-M.3** — Unit tests `image-process-crop.test.ts`
- [x] **CROP-M.4** — `run_tests` → `apply_changes` → `publish_develop` → `deploy_live`
- [x] **AUDIT8.8** — Voice menu Core/More lazy groups (no language removal)
- [ ] **AUDIT8.9** — `run_tests` on touched files → `apply_changes` → `publish_develop` → `deploy_live`
- [x] **TODO-CLEAN.1** — Wire TEO.5 dialect-feedback `engine`+`original` from Composer/VoiceControls
- [ ] **TODO-CLEAN.2** — Release pending slices already coded (ENT-INLINE.5 / WS-PAD.7 / ENT-TED-L.6) with AUDIT8.9 deploy

---

## 📋 ENT-TED-FIT — TED video list sorted by grade + age (2026-08-12)

> **Design:** [subsystems/ted-lab-learner-fit-sort.md](subsystems/ted-lab-learner-fit-sort.md)  
> **Goal:** Browse/search list ranks talks by student grade & age fit (short/TED-Ed first for G4; mature talks sink).

- [x] **ENT-TED-FIT.1** — `ted-fit.ts`: audience map, infer, score, sort, `searchTedCatalogForLearner`
- [x] **ENT-TED-FIT.2** — Wire search API + TedLab (`grade`/`age`); empty-q curated-first merge
- [x] **ENT-TED-FIT.3** — Unit TF1–TF8 + search route; `run_tests`
- [ ] **ENT-TED-FIT.4** — apply_changes → publish_develop → deploy_live
- [ ] **ENT-TED-FIT.5** — Manual TM-F1–TM-F4 on live Lab

## 🎧 ENT-TED-INLINE — TED discuss stays on Lab + Writing structure adapt (2026-08-11)

> **Design:** [subsystems/ted-challenge-inline-discuss.md](subsystems/ted-challenge-inline-discuss.md) · [subsystems/writing-studio-structure-adapt.md](subsystems/writing-studio-structure-adapt.md)  
> **Goal:** (1) Submit & discuss opens inline chat under the TED item — no homepage hop. (2) Writing Pad → music/image/video adapts language (lyrics/scene), does not copy draft verbatim.

- [x] **ENT-INLINE.1** — `ted-discuss.ts` + `POST /api/ted/discuss` (opener/reply + local fallback)
- [x] **ENT-INLINE.2** — `TedDiscussDialogue` + TedLab submit stays on page; Next advances qi
- [x] **ENT-INLINE.3** — `studio-structure` + coach `structureAgentPrompt` creative adapt
- [x] **ENT-INLINE.4** — Unit tests (TD* / SA*) + `run_tests`
- [ ] **ENT-INLINE.5** — `apply_changes` → `publish_develop` → `deploy_live`

---

## ✍️ WS-PAD-P0 — Writing Pad: grammar + Feedback/Stage layout (2026-08-12)

> **Design:** [subsystems/writing-studio-pad-p0.md](subsystems/writing-studio-pad-p0.md)  
> **Goal:** Competitor-grade grammar underlines (LanguageTool or local), Feedback-first + collapsible Stage (mobile 3-tab), writing-type selector. Keep Stage song/image/video complete.

- [x] **WS-PAD.1** — `languagetool.ts` + `POST /api/writing-studio/grammar-check` (env URL + local fallback)
- [x] **WS-PAD.2** — `WritingPadHighlights` grammar matches + one-click replace; BASIS `scoreGrammar` uses match count
- [x] **WS-PAD.3** — Writing type selector; mood/genre only for Lyrics/Poetry; Structure CTA adapts *(genre → Stage is JM.1, not this slice)*
- [x] **WS-PAD.4** — Desktop Feedback + collapsible Stage; mobile Write/Feedback/Stage tabs
- [x] **WS-PAD.5** — Live word/sentence count; desktop errors; coach panel auto-open weak dims
- [x] **WS-PAD.6** — Unit tests + `run_tests`
- [ ] **WS-PAD.7** — `apply_changes` → `publish_develop` → `deploy_live`

---

## 📝 ENT-TED-HYBRID — TED Challenge MCQ + essay → tutor Q&A (2026-08-11)

> **Design:** [subsystems/ted-challenge-hybrid-mcq.md](subsystems/ted-challenge-hybrid-mcq.md)  
> **Goal:** Optional multi-select + required essay on every prompt → **Submit & discuss** handoffs to homepage Socratic Q&A. Student may Next or keep chatting; coherence cue suggests next question.

- [x] **ENT-TED-H.1** — Extend `ChallengeItem` (`choices` / `choiceMode` / `correctChoices`) + enrich/score/format helpers
- [x] **ENT-TED-H.2** — Banded fallbacks + LLM system prompt require hybrid on every item
- [x] **ENT-TED-H.3a** — TedLab: `selected[]` for MCQ (no essay overwrite) + split soft-check helpers (TMH)
- [x] **ENT-TED-H.3b** — TedLab v2 UX: optional multi-select + “None of these” + required essay + **Submit & discuss**
- [x] **ENT-TED-H.3c** — `ted-challenge-handoff` stash/consume + kickoff message + coherence detect (TH1–TH6)
- [x] **ENT-TED-H.3d** — TutorShell: consume kickoff → new session auto-send + return banner (Next / Keep chatting)
- [x] **ENT-TED-H.3e** — TedLab resume from stash at `qi` / `qi+1`
- [x] **ENT-TED-H.4** — `run_tests` on handoff + ted-challenge
- [x] **ENT-TED-H.5** — apply_changes → publish_develop → deploy_live (code on `a0d6743`; live refresh with WS-PAD.7)
- [ ] **ENT-TED-H.6** — Manual TM-H6–TM-H9 on live Challenge → tutor → Next

---

## 📘 RPT4 — v4 report slice: Studio↔BKT + Learning Portfolio (2026-08-11)

> **Design:** [subsystems/report-v4-feasibility.md](subsystems/report-v4-feasibility.md)  
> **Goal:** Harden Studio→Learning closed loop with explicit outcomes; printable parent portfolio (AUD.6b light). Reject `/mistakes`, streaks, multi-model.

- [x] **RPT4.1** — `outcome?` on `recordLearningTurnMemory` + `studioOutcomeFromSoftFeedback` + TED Lab wiring
- [x] **RPT4.2** — `learning-portfolio.ts` printable HTML + Family Tools button
- [x] **RPT4.3** — Family KPI Effort = Σ skill attempts
- [x] **RPT4.4** — Unit tests + run_tests
- [x] **RPT4.5** — apply_changes → publish_develop → deploy_live (`03c8071` + live health ok 2026-08-11)
- [ ] **RPT4.6** — Manual: short TED answer moves BKT; Print portfolio behind PIN

---

## 🎯 ENT-TED-ADAPT — TED Challenge difficulty ↔ **grade number (G4 grain)** + English level (2026-08-11)

Design: [ted-challenge-adaptive-difficulty.md](subsystems/ted-challenge-adaptive-difficulty.md)

- [x] **ENT-TED-A.1** — `EnglishLevel` on profile; default via `englishLevelForGrade(grade)` (G4→developing); age editable on `/account`
- [x] **ENT-TED-A.2** — `resolveTedChallengeLevel` + banded **and grade-cued** `buildFallbackChallenge` / `challengeSystemPrompt`
- [x] **ENT-TED-A.3** — API + TedLab pass `learner` (incl. `grade`); softFeedback scales by band
- [x] **ENT-TED-A.4** — Unit tests TD1–TD7 (G3≠G4≠G5 cues); run_tests on touched files
- [x] **ENT-TED-A.5** — apply_changes → publish_develop → deploy_live

## 🎧 ENT-TED-LISTEN — TED Challenge prompt Listen / English TTS (2026-08-11)

> **Design:** [subsystems/ted-challenge-prompt-listen.md](subsystems/ted-challenge-prompt-listen.md)  
> **Goal:** Challenge **questions** auto-read in English (homepage **Listen**, not Speak / not Speak-answer mic). Default on; Auto Listen toggle; Listen/Stop; **Ryan `en-GB-RyanNeural` hard-lock**.

- [x] **ENT-TED-L.1** — `load/saveTedPromptListenEnabled` + `challengePromptSpeechText` + unit TL1–TL3 / TS1–TS2
- [x] **ENT-TED-L.2** — TedLab: auto-speak prompt on question change; Listen/Stop + Auto Listen toggle
- [x] **ENT-TED-L.3** — Mic barge-in stops prompt TTS (`onRecordingStart`)
- [x] **ENT-TED-L.4** — Docs (design + DESIGN map + this checklist) + `run_tests`
- [x] **ENT-TED-L.5** — Fix Speak→Listen labels; hard-lock Ryan voice (speech-player `voice` wins); TR1 unit test
- [ ] **ENT-TED-L.6** — apply_changes → publish_develop → deploy_live
- [ ] **ENT-TED-L.7** — Manual TM-L1–TM-L4 on live Challenge UI

~~## 🔊 ENT-TED-SPEAK~~ — **superseded** by ENT-TED-LISTEN (user: homepage **Listen** + Ryan British). See [ted-challenge-prompt-speak.md](subsystems/ted-challenge-prompt-speak.md) (cancelled).

## 🎤 ENT-TED-VOICE — TED Challenge voice input (2026-08-11)

> **Design:** [subsystems/ted-challenge-voice-input.md](subsystems/ted-challenge-voice-input.md)  
> **Goal:** Challenge answers support mic → STT text (reuse `MicTranscribeButton`), not text-only.

- [x] **ENT-TED-V.1** — `appendVoiceTranscript` helper + unit tests TV1–TV3
- [x] **ENT-TED-V.2** — Wire mic into `TedLab` Challenge textarea (append; disable after Check)
- [x] **ENT-TED-V.3** — Docs: design note + entertainments §6.2 + DESIGN map + this checklist
- [x] **ENT-TED-V.4** — Visibility fix: `MicTranscribeButton` `tone="onDark"` + full-size Speak row in TedLab
- [x] **ENT-TED-V.5** — `run_tests` → apply_changes → publish_develop → deploy_live (`9d44e14` / `6cce103` + live health ok 2026-08-11)
- [ ] **ENT-TED-V.6** — Manual TM1–TM4 on live Challenge UI (incl. dark theme)

---

## 🎵 ENT-AUDIO — My Creations mobile play (2026-08-11)

> **Design:** [subsystems/studio-creations-audio-mobile.md](subsystems/studio-creations-audio-mobile.md)  
> **Goal:** Fix phone playback on `/entertain?hub=studio&game=creations` — studio MP3s were pruned by chat retention; also add Range + mobile player hardening.

  - [x] **ENT-AUDIO.1** — Protect `writing-studio` media in `pruneOrphanMedia` / `deleteMediaForSession`
- [x] **ENT-AUDIO.2** — HTTP Range (206) on `/api/media` for audio/video
- [x] **ENT-AUDIO.3** — Delete creation → delete linked media blobs
- [x] **ENT-AUDIO.4** — CreationsLibrary: playsInline + 404 load hint
- [x] **ENT-AUDIO.5** — Unit tests (prune keep, Range 206, delete frees media) + run_tests
- [x] **ENT-AUDIO.6** — apply_changes → publish_develop → deploy_live (`c7ec387` + live health ok 2026-08-11)
- [ ] **ENT-AUDIO.7** — Manual: re-generate song → play on phone after chat sync

---

## 🎬 ENT-TED / ENT-WRITING — Studio: TED Lab + Writing Studio (2026-08-11)

> **Design:** [subsystems/entertainments.md](subsystems/entertainments.md) §6  
> **Goal:** `/entertain` Studio — official TED embed + transcript-driven advanced listening challenges; writing → structured lyrics → **Bailian Fun-Music** song → My Creations.

- [x] **ENT-TED.1** — Curated `ted-catalog` + search/filter + paste TED URL
- [x] **ENT-TED.2** — `TedLab` official iframe embed + attribution footer
- [x] **ENT-TED.3** — `GET /api/ted/transcript` (cache) + `POST /api/ted/challenge` (fallback + LLM)
- [x] **ENT-TED.4** — Challenge UI (one question at a time) + save to creations
- [x] **ENT-LYRIC.1** — `LyricStudio` draft + coach + structure lyrics
- [x] **ENT-LYRIC.2** — Creations store + `CreationsLibrary` list/delete
- [x] **ENT-LYRIC.3** — `fun-music-client` (百炼) + Volc GenSong prepaid/postpaid fallback + generate API + media persist
- [x] **ENT-WRITING.1** — Writing Studio rename + BASIS coach panel (topic / detail / vocab / grammar scores)
- [ ] **ENT-TED.5** — Manual: watch one talk → Start challenge within ~30s; answer + save
- [ ] **ENT-LYRIC.4** — Manual: lyrics save; generate via Bailian or Volc GenSong → playable in My Creations
- [ ] **ENT-LYRIC.5** — Apply fun-music-v1 invite in 百炼模型广场 (北京) if not already approved; ensure 火山 AI 音乐服务已开通

---

## ✨ UX-RPT — Competitor UX report slice (2026-08-11)

> **Design:** [subsystems/ux-competitor-report-2026-08-feasibility.md](subsystems/ux-competitor-report-2026-08-feasibility.md)  
> **Goal:** Absorb high-feasibility UX from 竞品调研 (latency perception + step follow-ups + soft persona). Defer Ello dual-agent / child ASR / streaks.  
> **Family:** Keep `/family` narrative hub; **reject** mega parent admin console / dedicated `/mistakes` app.

- [x] **UX-RPT.1** — Phased wait status (photo-aware labels + “Taking a bit longer…”) in TutorShell
- [x] **UX-RPT.2** — StepReveal Got it / Simpler chips → `spark:quick-reply` → Composer draft
- [x] **UX-RPT.3** — Prompt: soft persona + stronger `~~~step` discipline
- [x] **UX-RPT.4** — Unit tests (`tutor-wait-status`) + run_tests
- [x] **UX-RPT.5** — apply_changes → publish_develop → deploy_live (`8e9d874` + live `.next` has wait/chips; health ok 2026-08-11)
- [ ] **UX-RPT.6** — Manual: photo wait phases; step chips fill composer
- [x] **UX-RPT.7** — Slice A: stream audit note + `local-recall` arithmetic fast-path + tests
- [x] **UX-RPT.8** — Slice B: mic timer + level pulse; transcript stays editable; Listen highlight kept
- [x] **UX-RPT.9** — Slice C: Core idea + `~~~answer` fold; opener Continue / Something else
- [x] **UX-RPT.10** — Slice D: emotion rhythm + daily blurb + kid `/privacy` + soft error guides
- [ ] **UX-RPT.11** — Manual: `7×8` local reply; mic timer; Show answer; daily blurb dismiss; privacy kid section

---

## 🛡 RPT2 — Claude report slice: robots / API rate limit / Socratic integrity (2026-08-11)

> **Design:** [subsystems/claude-report-2026-08-feasibility.md](subsystems/claude-report-2026-08-feasibility.md)  
> **Goal:** Feasible public-hardening from the 2026-08-11 deep-analysis report (no full auth / no Agent→PR).

- [x] **RPT2.1** — `robots.ts` Disallow all + layout noindex; scrub GitHub URL from meta description
- [x] **RPT2.2** — Shared `api-rate-limit` on costly `/api/*` routes
- [x] **RPT2.3** — Unit tests: rate-limit + Socratic prompt integrity under jailbreak-ish text
- [x] **RPT2.4** — security-sanitization + DESIGN pointer; run_tests → apply_changes → publish_develop → deploy_live
- [ ] **RPT2.5** — Manual: `/robots.txt`; metadata noindex; burst API → 429

---

## 👁 AUD.6a-vis — Soft idle / dialect / Practice more visible (2026-08-11)

> **Design:** [subsystems/audit-2026-08-product-acceptance.md](subsystems/audit-2026-08-product-acceptance.md) §AUD.6a-vis  
> **Goal:** Make shipped AUD.6a surfaces scannable without streaks or new routes.

- [x] **AUD.6a-vis.1** — Empty chat: dialect chip row + opener eyebrow / stronger border for return|practice
- [x] **AUD.6a-vis.2** — Dashboard Practice → pill button + short section hint
- [x] **AUD.6a-vis.3** — run_tests (idle-nudge / session-opener) → apply_changes → publish_develop → deploy_live
- [ ] **AUD.6a-vis.4** — Manual: empty chat chips; dashboard Practice → chat practice card

---

## 📎 DOC: Document upload parse — MD / Office / HTML (2026-08-10)

> **Design:** [subsystems/document-upload-parse.md](subsystems/document-upload-parse.md)
> **Goal:** Tutor / Code Agent / Ask AI accept Markdown, Word, PPT, Excel, HTML and inject extracted text into the model.

- [x] **DOC.1** — Allowlist + `FILE_INPUT_ACCEPT` in `attachments.ts` (+ agent-chat parity)
- [x] **DOC.2** — `file-payload`: Office as base64; HTML/MD/code as text
- [x] **DOC.3** — `extract-files`: officeparser + HTML strip; wire into existing summaries
- [x] **DOC.4** — Update Composer / ConsoleComposer / FaqAskPanel `accept=`
- [x] **DOC.5** — Unit tests (allowlist + extract fixtures)
- [x] **DOC.6** — run_tests → apply_changes → publish_develop → deploy_live

### DOC-iOS: iPhone Markdown picker (2026-08-10)

> **Goal:** iPhone Safari Code Agent can select and attach `.md` files.

- [x] **DOC-iOS.1** — `isAppleTouchDevice` + `resolveFilePickerAccept` (omit accept on iOS)
- [x] **DOC-iOS.2** — Allow `text/*` / markdown MIME aliases in allowlist
- [x] **DOC-iOS.3** — ConsoleComposer + FaqAskPanel: `label` + `sr-only` (not `hidden` + click)
- [x] **DOC-iOS.4** — Unit tests + run_tests
- [x] **DOC-iOS.5** — apply_changes → publish_develop → deploy_live

### DOC-iOS2: iPhone still cannot see/pick `.md` (2026-08-10 follow-up)
> **Report:** 点击文件附件仍看不到 / 选不了 md（omit-accept 已部署仍失败）
> **Root cause hypothesis:** input first mounts with desktop `accept`, then useEffect clears it — WebKit keeps the first filter; `sr-only` off-screen input can also drop `change` on iOS.

- [x] **DOC-iOS2.1** — Mount file input only after accept resolved; never apply desktop accept on Apple touch
- [x] **DOC-iOS2.2** — Overlay opacity-0 input on attach label (Tutor / Console / Ask AI)
- [x] **DOC-iOS2.3** — Unit test defer-mount contract; run_tests
- [x] **DOC-iOS2.4** — apply_changes → publish_develop → deploy_live
- [ ] **DOC-iOS2.5** — Manual: iPhone Safari → 附件 → Browse → 选 `.md` → 出现 pill

### DOC-iOS3: attach still broken on device (2026-08-10)
> **Report:** 还是上传不了附件（defer-mount 已部署仍失败）
> **Fixes:** Apple `accept=*/*`; opacity 0.01; ≥44px hit target; shared FileAttachControl; paste-files fallback

- [x] **DOC-iOS3.1** — `resolveFilePickerAccept` → `*/*` on Apple; update unit tests
- [x] **DOC-iOS3.2** — `FileAttachControl` + wire Composer / ConsoleComposer / FaqAskPanel
- [x] **DOC-iOS3.3** — Paste `clipboardData.files` on composer textareas
- [x] **DOC-iOS3.4** — run_tests → apply_changes → publish_develop → deploy_live
- [ ] **DOC-iOS3.5** — Manual: iPhone Attach→Browse `.md` OR Copy→Paste → pill

---

## 📊 Report-v3 optimizations (2026-08-10)

> **Feasibility:** [subsystems/report-v3-feasibility.md](subsystems/report-v3-feasibility.md) · third-party audit Top3

- [x] **R2** — BKT → misconception → multi-rep closed-loop gate (`pedagogy-loop.ts`)
- [x] **R6** — Parent weekly digest (in-app, PIN) via `buildParentWeeklyDigest`
- [x] **R1** — `/dashboard` MVP (radar, SM-2, trend, misconception heat)
- [x] **R3** — Sequential `~~~step` Next reveal + prompt reinforcement
- [x] **R7** — Science experiment guide flow in prompts
- [x] **R4** — Voice auto-send opt-in (default off); dialects/yue confirm
- [x] **R8** — Cross-discipline Spark fence + UI badge
- [x] **R9** — Soft-ZPD practice target picking
- [ ] **R5** — Peer battle / BKT compare (deferred)
- [ ] **R10** — Voice emotion detection (deferred)

---

## 🤖 AI FAQ — Ask AI in Help & feedback (2026-08-10)

> **Design:** [subsystems/ai-faq.md](subsystems/ai-faq.md) · [faq-feedback-panel.md](subsystems/faq-feedback-panel.md)

- [x] **FAQ-AI.1** — `POST /api/faq-ai` SSE + read-only tools (`createFaqAiTools`)
- [x] **FAQ-AI.2** — `FaqAskPanel`: multilingual composer + mic / upload / camera
- [x] **FAQ-AI.3** — FeedbackPanel 3 tabs (Ask AI default · FAQ · Suggest); wider panel
- [x] **FAQ-AI.4** — Docs: `ai-faq.md`, DESIGN map, README, canned FAQ entry
- [x] **FAQ-AI.5** — Unit tests for prompt + tool surface

---

## 🔧 FIX: Listen voice sync + Stop (2026-08-10)

> **Design:** [subsystems/listen-voice-sync-stop.md](subsystems/listen-voice-sync-stop.md) · [voice-tts-stt.md](subsystems/voice-tts-stt.md)
> **Bug:** `acct_ching` 选闽南话但 Listen 播粤语；Stop 停不了。

- [x] **LVS.1** — Pass `accountId` TutorShell → Composer → VoiceControls; scoped load/save voice
- [x] **LVS.2** — teo TTS: remove Cantonese edge silent fallback (503 / throw)
- [x] **LVS.3** — `speech-player.stop()`: abort fetch + clear `audio.src`
- [x] **LVS.4** — Unit tests (provider + voice isolation + stop generation)
- [x] **LVS.5** — run_tests → apply_changes → publish_develop → deploy_live
- [x] **LVS.6** — Fix `fetchTts` catch using undefined `dialect` → `dialectTts` (2026-08-11)

---

## ✅ UX: History Listen + Short Voice Labels (2026-08-10)

> **Design:** [subsystems/voice-tts-stt.md](subsystems/voice-tts-stt.md) · [geometry-diagrams.md](subsystems/geometry-diagrams.md)

- [x] **UX.V1** — Assistant bubbles: Listen / Stop (`speakOnce`) for history replay
- [x] **UX.V2** — Voice picker labels language-only (no 百炼/FormoSpeech/Edge TTS suffixes)
- [x] **UX.V3** — TTS never soft-breaks into SVG `<style>`; `/api/tts` cleans at entry
- [x] **UX.V4** — SVG `linearGradient` repair + viewBox auto-expand for comic panels
- [x] **UX.V5** — README + DESIGN + subsystem docs updated; tests green; develop + master

---

## ✅ FB: FAQ / Feedback Panel + GitHub Issue Sync (2026-08-10)

> **Design:** [subsystems/faq-feedback-panel.md](subsystems/faq-feedback-panel.md)
> **Goal:** Sidebar "💡 FAQ / Feedback" button → FAQ panel + suggest form → auto-creates GitHub issue → feasibility analysis → TODO.md

### FB.1 — UI

- [x] **FB.1.1** — `FeedbackPanel.tsx`: FAQ tab (collapsible) + Suggest tab (category / title / description / submit)
- [x] **FB.1.2** — Wire into `HistorySidebar.tsx`: button next to GitHub link
- [x] **FB.1.3** — Desktop: slide-in right panel; Mobile: bottom sheet (matches component pattern)

### FB.2 — Backend

- [x] **FB.2.1** — `/api/feedback` POST: validates input → creates GitHub issue via REST API (or `gh` CLI fallback)
- [x] **FB.2.2** — `feedback-analysis.ts`: effort estimation, duplicate check, roadmap fit, risk, recommendation
- [x] **FB.2.3** — Append analysis result to `docs/TODO.md` under `📬 User Feedback` section

### FB.3 — Release

- [x] **FB.3.1** — `npm test` green
- [x] **FB.3.2** — `npm run build` passes
- [x] **FB.3.3** — Commit + push develop
- [x] **FB.3.4** — PM2 restart spark-tutor

---

## ✅ Completed (2026-08-10) — Code Agent Delivery Pipeline

- [x] `CONSOLE_SYS` phases P0–P6 (`src/lib/console-sys.ts`)
- [x] Tools: `web_research`, `fetch_page`, `write_file`, `publish_develop` (+ `deploy_live`)
- [x] Edit budget 25; README / DESIGN / harness tests updated

---

## 📊 Competitive Analysis Backlog (2026-08) — v2 confirmed

> **Plan (confirmed):** [subsystems/competitive-product-plan-v2.md](subsystems/competitive-product-plan-v2.md)  
> **Research:** [subsystems/competitive-feature-analysis.md](subsystems/competitive-feature-analysis.md)  
> **UI spec:** [subsystems/competitive-ui-design.md](subsystems/competitive-ui-design.md) (wireframes · states · gap checklist §12)  
> **P0 design:** [subsystems/ca-p0-system-design.md](subsystems/ca-p0-system-design.md) · **P0 hardening:** [subsystems/ca-p0-acceptance-hardening.md](subsystems/ca-p0-acceptance-hardening.md) · **P1 design:** [subsystems/ca-p1-system-design.md](subsystems/ca-p1-system-design.md) · **B3:** [subsystems/ca-b3-voice-tolerance.md](subsystems/ca-b3-voice-tolerance.md)  

> **Filter:** Socratic · chat-first · physical-tutor · no child dashboard  
> **Decisions:** D2 before weekly report; D1 PIN check mode in P2; C5/P3 idea-only; B3 after Phase G; no streaks/leaderboards; C6 folded into A2

### UI spec status

- [x] **UI-SPEC** — [competitive-ui-design.md](subsystems/competitive-ui-design.md) written (2026-08-09)
- [x] **UI-POLISH** — Gap checklist §12 shipped (UI-E1, UI-A1a/b, UI-A2a, UI-B1a, UI-B2a, UI-D2, UI-D1); UI-P1 deferred with P1 features

### Explicit non-goals (do not schedule)

- Child course catalog / badge wall / multi-tab learning center  
- Default instant-answer solver (except PIN **D1**)  
- Full COPPA productization (unless public app-store goal appears)  
- Heavy Manim / 3Blue1Brown live render on 4GB host  
- **Exposed knowledge-map / skill-tree UI** (internal graph OK)  
- **Leaderboards / learning streaks** (no parent-visible streak exception)

### P0 — shipped on `develop` · acceptance / hardening remaining

| ID | Alias | Status | Remaining acceptance |
|----|-------|--------|----------------------|
| **A1** | CA-1 worksheet | ✅ shipped | G4 cut ≥90% sampled; no cross-Q bleed; mid-exit keeps done |
| **A2** | CA-2 (+ **C6** practice-as-diagnosis) | ✅ shipped | Refuse once = no nag; end-hook clarity; drills in ZPD |
| **B1** | CA-3 opener | ✅ shipped | Homework intent always yields; ≤1/day |
| **B2a** | CA-4 barge-in | ✅ shipped | Manual **M4**; resume-copy → B2b |

- [ ] **CA-P0.R3** — Manual smoke M1–M5 on live phone (see [ca-p0-acceptance-hardening.md](subsystems/ca-p0-acceptance-hardening.md) §3)
- [x] **B1.h** — Yield-to-homework: any send / homework intent marks opener shown (`yieldOpenerForHomework`)

#### A1.h — Worksheet cut-accuracy ([hardening §1](subsystems/ca-p0-acceptance-hardening.md))

- [ ] **A1.h.1** — Expand to full 24 labeled real/redacted photos (scaffold + 4 fixture samples shipped)
- [x] **A1.h.2** — `scripts/eval-worksheet-cut.mjs` harness (offline fixtures; `--live` stub)
- [x] **A1.h.3** — Offline baseline scorecard written (`eval/worksheet-cut/results-*.json`)
- [x] **A1.h.4** — Prompt tightened (count-first + single-item no-fire); re-run after full photo set
- [ ] **A1.h.5** — Manual bleed review on live transcripts
- [x] **A1.h.6** — Mid-exit regression: remount keeps `Question N of T`

#### A2.h — Session-end hook ([hardening §2](subsystems/ca-p0-acceptance-hardening.md))

- [x] **A2.h.1** — `maybeCloseSession()` + `practiceOfferEmittedAt` on `ConversationRecord`
- [x] **A2.h.2** — Wire into `selectConversation`
- [x] **A2.h.3** — `visibilitychange` debounced 30s close
- [x] **A2.h.4** — Missed-close recovery on load (≥4 msgs, stale &gt;10m)
- [ ] **A2.h.5 / A2.h.6** — Drill-quality eval (10 samples; spoiler = hard fail) — needs live agent
- [x] **A2.h.7** — Unit tests SP8–SP10

### P1 — Teaching depth + v2 additions

> Design: [ca-p1-system-design.md](subsystems/ca-p1-system-design.md)

- [x] **C1 / CA-5** — Scratch-work vision fence + prompt (SD1–SD2); links **2.4**
- [x] **C2 / CA-6** — Misconception tag library (~25) + fence merge (MC1–MC3)
- [x] **C3 / CA-7** — Multi-representation cycle + memory (MR1–MR3)
- [x] **C4 / CA-8** — diagramId/revision replace in thread (DB1–DB2); step-N CSS later
- [x] **A3** — Cross-day gapHistory with 14d expiry → opener “last few days”

#### B3 — Voice tolerance ([ca-b3-voice-tolerance.md](subsystems/ca-b3-voice-tolerance.md))

- [x] **B3.0** — Spike: no ASR confidence field in current Bailian/iFlytek extractors → Option B
- [x] **B3.1** — `voice-confusables.ts`: ~20 G4 pairs + `detectConfusable()`
- [x] **B3.2** — Post-transcribe two-tap confirm chips in `VoiceControls` / Composer
- [x] **B3.3** — Unit tests VC1–VC6

### P2 — Tools / parent (chat-first)

- [x] **D2** — Parent **daily one-liner** digest behind PIN (SkillsPanel Parent section)
- [x] **D1** — PIN **核对模式** (banner + `checkMode` prompt); Exit / PIN Done → force Socratic
- [ ] **CA-9** — Embedded Desmos / graphs (reframes **3.3**)
- [ ] **CA-11** — Entertainments → skill soft link (rare opt-in)
- [ ] **CA-12** — Dialect speech quality — Phase **G** Tier-1 + FormoSpeech/cloud shipped; remaining = G.3/G.4 optional + **15.2.6** clone ID

### P3 — Long-horizon (ideas / do not over-schedule)

- [ ] **B2b** — Continuous half-duplex voice + interrupt-resume (after B2a)
- [ ] **C5** — ALEKS-style next-learnable set — **internal reasoning only**, never map UI
- [ ] **Weekly report** — former CA-10 / **1.7**; only if D2 insufficient

### Success metrics (home / single-child)

- Socratic depth · A2 gap-loop close rate · B1 accept vs yield · D2 parent open/reply rate

---

## ✅ Phase CA-P0: Competitive P0 Implementation — shipped; acceptance remaining (2026-08-09)

> **Design:** [subsystems/ca-p0-system-design.md](subsystems/ca-p0-system-design.md)  
> **Goal:** Ship CA-1…CA-4 with unit tests + manual smoke; keep child UI minimal.

### CA-1 Worksheet planner (strengthens 2.2)

- [x] **CA-1.1** — `src/lib/worksheet-planner.ts`: types, `parseWorksheetPlanFence`, `stripWorksheetPlanFence`, `formatProgressLabel`, `mergeWorksheetPlan`
- [x] **CA-1.2** — Prompt contract in `prompts.ts` (homework ≥2 items → emit/update `~~~worksheet-plan`)
- [x] **CA-1.3** — Optional `worksheetPlan` on `ConversationRecord`; TutorShell merge after assistant turn
- [x] **CA-1.4** — Progress chip in chat empty/header area: `Question N of T`
- [x] **CA-1.5** — Unit tests **WP1–WP8** (`worksheet-planner.test.ts`)

| Case | Assert |
|------|--------|
| WP1 | Valid fence parses total/current/items |
| WP2 | Invalid JSON / missing fields → null |
| WP3 | Strip removes fence; surrounding prose kept |
| WP4 | Multiple fences → last wins |
| WP5 | `formatProgressLabel({current:2,total:8})` → `Question 2 of 8` |
| WP6 | merge replaces same session plan |
| WP7 | status normalization (unknown → pending) |
| WP8 | empty items / total mismatch rejected or clamped |

### CA-2 Post-session practice (3 drills)

- [x] **CA-2.1** — `src/lib/session-practice.ts`: `pickPracticeTargets`, persist/clear/defer offer
- [x] **CA-2.2** — `startNewSession` writes offer when prev msgs ≥ 4
- [x] **CA-2.3** — ChatThread empty-state: Practice / Tomorrow / Dismiss
- [x] **CA-2.4** — Unit tests **SP1–SP7**

| Case | Assert |
|------|--------|
| SP1 | Weak skills → up to 3 targets |
| SP2 | Empty memory → no offer |
| SP3 | Persist + load round-trip |
| SP4 | Clear removes storage |
| SP5 | Tomorrow sets deferredUntil next local day |
| SP6 | Deferred offer not shown before date |
| SP7 | Kickoff message text includes skill labels + Socratic instruction |

### CA-3 Session opener (ZPD / review)

- [x] **CA-3.1** — `src/lib/session-opener.ts`: once/day gate, prefer `needsReviewSkills` then `zpdWarmUpSkills`
- [x] **CA-3.2** — Wire `needsReviewSkills` into `learningMemoryPromptLines`
- [x] **CA-3.3** — ChatThread chips: Try {label} / Snap homework
- [x] **CA-3.4** — Unit tests **SO1–SO6**

| Case | Assert |
|------|--------|
| SO1 | No skills → null |
| SO2 | Review skill preferred over ZPD when both exist |
| SO3 | Second call same day → null after markShown |
| SO4 | New calendar day → offer again |
| SO5 | Copy mentions homework alternative |
| SO6 | Account namespace isolates gates |

### CA-4 TTS barge-in (4.1a)

- [x] **CA-4.1** — `speech-barge-in.ts` helpers + VoiceControls "Tap to interrupt" while speaking
- [x] **CA-4.2** — Confirm mic path calls stop before record (regression guard)
- [x] **CA-4.3** — Unit tests **BI1–BI4**; **4.1b** continuous voice stays deferred

| Case | Assert |
|------|--------|
| BI1 | `shouldBargeIn(speaking=true)` → true |
| BI2 | `interruptHint(speaking)` copy non-empty when busy |
| BI3 | `planBargeIn()` order: stop then listen |
| BI4 | Not speaking → no interrupt hint |

### CA-P0 release gate

- [x] **CA-P0.R1** — `npm test` green (new suites — WP/SP/SO/BI + prompts)
- [x] **CA-P0.R2** — `npm run build` / smart-build (2026-08-09)
- [ ] **CA-P0.R3** — Manual smoke M1–M4 on live (HTTP 200 after deploy; full M1–M4 pending human)
- [x] **CA-P0.R4** — Commit + push `develop` (`175564d`) + pm2 restart spark-tutor

| Manual | Steps |
|--------|-------|
| M1 | Photo multi-Q worksheet → progress chip appears after plan fence |
| M2 | After ≥4-msg session, New chat → practice offer |
| M3 | Empty chat shows opener once/day |
| M4 | During TTS, tap mic → speech stops, listening starts |

> **P1 / P2 / P3 backlog** moved to § Competitive Analysis Backlog v2 above (includes A3/B3/D1/D2).  
> CA-10 weekly report demoted to **P3**; prefer **D2** daily one-liner.

---

## ✅ SHA: Shanghainese (上海话) Full Support + TTS Image Fix (2026-08-10)

> **Design:** [subsystems/shanghainese-support.md](subsystems/shanghainese-support.md)
> **Goal:** Wire Shanghainese (sha) into all integration points; fix TTS reading base64 image content; apply normalizeForTTS at TTS route.

### SHA — TTS Image Content Fix (🔴 critical, shipped 2026-08-10)

- [x] **SHA-FIX.1** — `cleanTutorSpeechText`: add bare `data:image/` stripping; make `![]()` image regex multiline-safe with `[\s\S]*?`
- [x] **SHA-FIX.2** — `incompleteDiagramStart`: add bare `data:image/` mid-stream detection
- [x] **SHA-FIX.3** — `maskCompleteDiagrams`: sync with multiline-safe pattern
- [x] **SHA-FIX.4** — `isEncodedJunk`: add `data:image/` prefix detection
- [x] **SHA-FIX.5** — Unit tests: bare data URI, multiline data URI, `isEncodedJunk` data:image
- [x] **SHA-FIX.6** — `/api/tts` route: `cleanTutorSpeechText` at entry (belt & suspenders — all TTS paths clean)
- [x] **SHA-FIX.7** — `/api/tts` route: `normalizeForTTS` for edge TTS fallback (teo/hak/sha)
- [x] **SHA-FIX.8** — `speech-player.ts`: pass `lang: "sha"` for TTS route to normalize Shanghainese text

### SHA.1 — Type surface + voice

- [x] **SHA.1.1** — `voices.ts`: `TutorVoiceId` += `"shanghainese"`; `SpeechLang` += `"sha"`; `ReplyLangMode` += `"sha"`; `TUTOR_VOICES` entry; `edgeVoiceForLang`; `replyLangFromVoice`
- [x] **SHA.1.2** — `voices.test.ts`: label, edge voice, reply lang, instructions

### SHA.2 — STT integration

- [x] **SHA.2.1** — `stt-lang.ts`: `SttLang` += `"sha"`; `voiceIdFromDictLang`, `sttLangFromVoice`, `sttLangFromDictLang`
- [x] **SHA.2.2** — `stt-lang.test.ts`: voice/lang/dictLang mappings
- [x] **SHA.2.3** — `transcribe/route.ts`: ALLOWED += `"sha"`; aliases `shanghainese`, `上海话`, `上海`, `wu`
- [x] **SHA.2.4** — `transcribe/route.test.ts`: sha in ALLOWED; aliases
- [x] **SHA.2.5** — `bailian-asr.ts`: `bailianAsrLanguageHint("sha") → "zh"`
- [x] **SHA.2.6** — `bailian-asr.test.ts`: language hint = "zh"
- [x] **SHA.2.7** — `stt-engine-order.ts`: `DEFAULT_ORDER["sha"]`; `MULTI_ENGINE_LANGS` += `"sha"`
- [x] **SHA.2.8** — `stt-engine-order.test.ts`: default order + multi-engine

### SHA.3 — TTS + prompt + dialect correction

- [x] **SHA.3.1** — `tts-provider.ts`: `lang === "sha"` → edge (no Bailian/iFlytek Shanghainese TTS)
- [x] **SHA.3.2** — `tts-provider.test.ts`: sha returns edge
- [x] **SHA.3.3** — `prompts.ts`: `audienceLine`, `styleLine`, `findThisCue`, `defaultStudentLine` for `"sha"`
- [x] **SHA.3.4** — `prompts.test.ts`: Shanghainese prompt blocks
- [x] **SHA.3.5** — `dialect-stt-correct.ts`: `DialectKind.sha = "sha"` + use shanghainese-dict
- [x] **SHA.3.6** — `dialect-stt-correct.test.ts`: DialectKind, correction prompt

### SHA.4 — Dictionary / Translation

- [x] **SHA.4.1** — `dict-types.ts`: `DictLang` += `"sha"`; `DICT_LANG_LABELS.sha = "上海話"`; source badge
- [x] **SHA.4.2** — `dict-sentence.ts`: `LANG_NAME.sha` + test
- [x] **SHA.4.3** — `dict-translate.ts`: `GTX_CODES["sha"] = "zh-CN"`; `translateWithGtx` conditional + test
- [x] **SHA.4.4** — `dict-suggest.ts`: `voiceIdFromDictLang` handled via stt-lang
- [x] **SHA.4.5** — `Dictionary.tsx`: sample words `["侬", "吃饭", "侬好", "勿是", "谢谢", "看"]`; badge `滬`
- [x] **SHA.4.6** — `VoiceControls.tsx`: dialect notice for sha
- [x] **SHA.4.7** — `dict/route.ts`: wired shanghaineseLookup into dictionary API

### SHA.5 — TTS text normalization

- [x] **SHA.5.1** — `tts-text.ts`: `normalizeForTTS` add `sha` branch (Shanghainese→Cantonese char mapping)
- [x] **SHA.5.2** — `tts-text.test.ts`: `normalizeForTTS("sha")` tests (5 new test cases)

### SHA.6 — Release

- [x] **SHA.6.1** — README.md: add Shanghainese + FAQ features
- [x] **SHA.6.2** — docs/DESIGN.md: link shanghainese-support.md
- [x] **SHA.6.3** — `npm test` green (891 tests)
- [x] **SHA.6.4** — `npm run build` passes
- [x] **SHA.6.5** — Commit + push develop
- [x] **SHA.6.6** — PM2 restart spark-tutor

---

## ✅ Done (2026-08-09) — Code Agent Live Deploy Fix (DEPLOY1)

**Goal** — Code Agent edits never refreshed the live site (`npm start` serves stale `.next`). Add `deploy_live` tool + SYS prompt + raise edit budget.

> **Design:** [subsystems/code-agent-deploy.md](subsystems/code-agent-deploy.md)

### Phase DEPLOY1

- [x] **DEPLOY1.1** — Root-cause: PM2 production `.next` vs source-only edits
- [x] **DEPLOY1.2** — Design doc + tests CD1–CD4
- [x] **DEPLOY1.3** — `deploy_live` in console-harness + SYS prompt + max edits 15
- [x] **DEPLOY1.4** — Unit tests green + build + pm2 restart + git push

---

## ✅ Done (2026-08-09) — Board AI Challenge Pass (ENT5)

**Goal** — Board games still too easy: raise expert/master depths (Xiangqi 4/5, Chess 4), quiescence on expert+, stronger Go/Gomoku/UTTT, default UI=`hard`; tests D1–D10; deploy.

> **Design:** [subsystems/entertainments.md](subsystems/entertainments.md) §1.2 / §3.9 (v0.6)

### Phase ENT5: Challenge-level AI

- [x] **ENT5.1** — Research refresh (js-chess-engine levels, yingwang depth ladder, Stanford depth findings)
- [x] **ENT5.2** — Design doc v0.6 + D7–D10 + this TODO
- [x] **ENT5.3** — Xiangqi: depths 1/2/3/4/5, expert+ quiescence, higher budgets
- [x] **ENT5.4** — Chess: depths 1/2/3/4/4, expert+ quiescence, higher budgets
- [x] **ENT5.5** — Go atari scoring; Gomoku/UTTT stronger ladders; default UI `hard`
- [x] **ENT5.6** — Unit tests D1–D10 green
- [x] **ENT5.7** — Build + PM2 restart + git push

### ✅ Done — ENT4 (5-level pills + PST)

- [x] **ENT4.1–4.6, 4.8** — 5 levels + PST + UI pills (superseded by ENT5 depths)
- [x] **ENT4.7** — Prior deploy of 5-level UI (`32652bf`)

---

## ✅ Done (2026-08-09) — Ultimate Tic-Tac-Toe (ENT3)

**Goal** — Add Ultimate Tic-Tac-Toe to `/entertain` with Wikipedia-standard rules, local AI (easy/medium/hard), full unit tests, deploy.

> **Design:** [subsystems/entertainments.md](subsystems/entertainments.md) §1.1 / §2.1 / §3.8 / §4

### Phase ENT3: Ultimate Tic-Tac-Toe

- [x] **ENT3.1** — Open-source research + feasibility (Wikipedia, jacobcohn α-β, thehav0k, colinschepers MCTS)
- [x] **ENT3.2** — Design doc + test plan U1–U13
- [x] **ENT3.3** — `uttt.ts` engine (legal routing, small/meta win, draw)
- [x] **ENT3.4** — `uttt-local.ts` AI (easy random / medium depth2 / hard depth3)
- [x] **ENT3.5** — `uttt.test.ts` + `uttt-local.test.ts` green
- [x] **ENT3.6** — `UtttGame.tsx` UI + hub / `GameId` registration
- [x] **ENT3.7** — Build + PM2 restart + git push

---

## ✅ Done (2026-08-09) — Entertainments v2 (dedicated page) + Build Optimization

**Entertainments v2** — Dedicated `/entertain` page with hub UI. Solo puzzles: Sudoku, Sokoban, Klotski. Board games with local AI: Chess, Xiangqi, Go, Gomoku + Arcade Blocks/Snake.  
**Build Optimization** — Smart build script with memory cap, PM2 lifecycle.

> **Entertainments design:** [subsystems/entertainments.md](subsystems/entertainments.md)
> **Build optimization design:** [subsystems/build-optimization.md](subsystems/build-optimization.md)

### Phase ENT2: Entertainments v2 (dedicated page)

- [x] **ENT2.1** — Delete old sidebar EntertainmentsPanel + entertainments lib
- [x] **ENT2.2** — Create `/entertain` page route + sidebar link
- [x] **ENT2.3** — Hub page: card grid with Board Games & Logic Puzzles sections
- [x] **ENT2.4** — Chess: chess.js engine + local AI + PvP mode
- [x] **ENT2.5** — Xiangqi: full engine + local AI + PvP mode
- [x] **ENT2.6** — Go 9x9: full engine + local AI + PvP mode
- [x] **ENT2.7** — Sudoku: generator + keyboard input + conflict detection
- [x] **ENT2.8** — Sokoban: 10 levels + undo + d-pad + keyboard
- [x] **ENT2.9** — Klotski: 3 layouts + drag/click movement + undo
- [x] **ENT2.10** — Build optimization: smart-build.mjs + memory cap + PM2 lifecycle
- [x] **ENT2.11** — Research → design (test plan) → unit tests; fix AI stream API + Xiangqi SVG + Go ko
- [x] **ENT2.12** — Gomoku / Blocks / Snake + Xiangqi/Go local AI difficulty

### Phase BUILD: Build optimization

- [x] **BUILD.1** — Design doc: [subsystems/build-optimization.md](subsystems/build-optimization.md)
- [x] **BUILD.2** — `scripts/smart-build.mjs`: pre-clean, memory check, heap cap, fallback
- [x] **BUILD.3** — `next.config.ts`: `outputFileTracingExcludes` for dev deps
- [x] **BUILD.4** — PM2 service lifecycle: stop formospeech before build, restart after

---

## ✅ Done (2026-08-07…08) — Cross-Device Deletion Sync + Multi-Theme + Dialect Plan A

**Deletion sync bug** — PC1 delete does not propagate to PC2 (reincarnation bug). Root cause confirmed: server `PUT` had no deletion-log guard, so a stale device re-uploaded the deleted chat before hydration completed.
**Themes** — Upgrade from dark/light toggle to 4-theme system (light / dark / light-blue / light-green).

> **Design (v0.2):** [subsystems/deletion-sync-and-themes.md](subsystems/deletion-sync-and-themes.md) — tombstone log + **server PUT guard** (authoritative) + client push filter + periodic re-hydration (60s + visibilitychange) + WCAG contrast audit (muted-color fixes for blue/green themes).

### Phase A: Deletion Sync

- [x] **A.1** — `src/lib/deletion-log.ts` — server-side tombstone read/write/prune + `isTombstoned()` predicate
- [x] **A.2** — `/api/history` GET attaches `deletions`; DELETE → tombstone before unlink + media cleanup
- [x] **A.3** — `hydrateFromServer` applies deletion log before merge
- [x] **A.4** — Unit tests `deletion-log.test.ts` (8 tests: write/read/coexist/TTL/prune/`isTombstoned`)
- [x] **A.5** — 🔴 **Server PUT guard** — `upsertServerConversation(s)` reject fresh-tombstoned sessions (no resurrection)
- [x] **A.6** — Client push filter — `pushStoreToServer` drops tombstoned sessions via deletion cache; `deleteServerChat` seeds cache
- [x] **A.7** — Periodic re-hydration in `TutorShell.tsx` — 60s interval + `visibilitychange`; skips while agent busy
- [x] **A.8** — Unit tests: `history-store-deletion.test.ts` (4), `history-sync.test.ts` (3)
- [x] **A.9** — Integration: `scripts/verify-deletion-sync.mjs` — two-device delete → no re-upload → media gone (13/13 ✓ live)

### Phase B: Multi-Theme

- [x] **B.1** — `globals.css` 4-theme `[data-theme="…"]` blocks + legacy `.dark` fallback
- [x] **B.2** — `src/components/ThemePicker.tsx` — 4-swatch picker (apply on mount + `theme-color` meta sync)
- [x] **B.3** — `layout.tsx` no-FOUC inline script (`spark.theme` + `prefers-color-scheme` + legacy `spark.dark`)
- [x] **B.4** — Mount `ThemePicker` in `TutorShell.tsx` header; `DarkToggle` removed
- [x] **B.5** — Contrast fixes: light-blue/green `--ink-muted` → `#4a6a7c` / `#4a6a4a` (≥ 4.5:1); `--diff-*` vars added to all 4 themes; `DiffViewer.tsx` themified
- [x] **B.6** — Tests: `theme-contrast.test.ts` (WCAG AA programmatic), `ThemePicker.test.tsx` (jsdom)

### Phase C: Tests + Release

- [x] **C.1** — Full test suite green (575 tests / 54 files; 2 pre-existing flaky network tests pass in isolation)
- [x] **C.2** — `npm run build` + `verify-deletion-sync.mjs` against running service (13/13)
- [x] **C.3** — Commit → push develop → push master → rebuild → restart :3000 (systemd) → health check 200

### Phase D: History-Images Regression (media account-scoping, added 2026-08-07)

**Bug:** history photos 404'd — `pruneOrphanMedia` was global while `data/media` is shared across accounts, so any account's retention pass wiped every other account's media.

- [x] **D.1** — `StoredMediaMeta.accountId` + `writeMediaFromDataUrl` writes it
- [x] **D.2** — `persistConversationMedia(record, accountId?)` threads accountId through
- [x] **D.3** — `pruneOrphanMedia(accountId, keepSessionIds, keepMediaIds?)` account-scoped; legacy meta (no accountId) never pruned
- [x] **D.4** — `history-store.ts` passes accountId in `prepareConversationForServer` / `enforceServerRetention`
- [x] **D.5** — Regression test: account A's prune leaves account B's media intact (`media-store.test.ts`)
- [x] **D.6** — Verify self-heal: `/api/media/check` works live; cross-account media survives on live service (regression script ✓)

### Phase E: Theme UX Polish (v0.3, added 2026-08-08)

**Requested:** default theme = light green; dark-theme text unreadable on action buttons (e.g. "New chat"); theme options should be collapsible (cleaner header).

- [x] **E.1** — Default theme → `light-green` (layout.tsx no-FOUC script + ThemePicker fallback + viewport `theme-color`); removed `prefers-color-scheme` auto-switch for a deterministic first-visit default
- [x] **E.2** — `--action-bg` / `--action-ink` per theme; dark theme flips to light-cream button + dark text (fixes white-on-cream "New chat")
- [x] **E.3** — Converted `bg-[var(--ink)] text-white` → action vars: HistorySidebar, Composer, AccountHome, SentenceTranslate; CameraCapture overlay now fixed always-dark `#14100c`
- [x] **E.4** — ThemePicker redesigned: compact half-moon swatch trigger → anchored menu (4 swatches + ✓); closes on outside click / Escape; `menuitemradio` a11y
- [x] **E.5** — Tests updated: ThemePicker (collapsed menu, default, Escape), theme-contrast adds `--action-*` ≥ 4.5:1
- [x] **E.6** — README + design doc updated (v0.3)

### Phase F: Teochew & Hakka Dialect Support (Plan A, design 2026-08-08)

**Scope:** Written-form dialect replies via LLM prompting + Cantonese TTS fallback + local dictionary seeds. No dedicated TTS/STT models needed.

> **Design:** [subsystems/dialect-support-teochew-hakka.md](subsystems/dialect-support-teochew-hakka.md) — LLM prompt templates for Teochew/Hakka grammar & vocabulary, Cantonese TTS as fallback rationale, ~150-entry local dictionaries.

- [x] **F.1** — Extend `SpeechLang` / `ReplyLangMode` types + voice entries in `TUTOR_VOICES` (teochew, hakka)
- [x] **F.2** — `replyLanguageInstructions("teo")` / `("hak")` prompt templates
- [x] **F.3** — TTS routing: `edgeVoiceForLang` maps teo/hak → `zh-HK-WanLungNeural`; STT: teo/hak → `"auto"`
- [x] **F.4** — Local dictionary files: `teochew-dict.ts` (~114 entries), `hakka-dict.ts` (~113 entries)
- [x] **F.5** — Wire dict into pipeline: `DictLang` type, `dict-suggest.ts`, dictionary page
- [x] **F.6** — Unit tests: voices, dict validation, STT lang mapping
- [x] **F.7** — README update: dialect features section; design doc linked
- [x] **F.8** — Build + deploy + manual smoke test (Teochew/Hakka tutor replies + TTS audible) — 2026-08-08
  - Fixed `/dict` "This page couldn't load" outage: stale server (started 08-07) serving corrupted `.next` (incomplete build, missing `BUILD_ID`) → bundle mismatch errors (`Server Reference ID did not match`). Rebuilt + restarted `spark-tutor.service`.
  - Freed system resources: killed runaway `npx` orphans + dozens of self-recursive vitest processes from `console-harness.test.ts` (its `run_tests` test ran vitest on itself → infinite process explosion). Now excludes `console-harness.test.ts` from harness-triggered runs and points the test at `dict-cache.test.ts`.
  - Rewrote `ThemePicker` to `useSyncExternalStore` (removed deferred `setActive` timer that caused flaky jsdom teardown errors).
  - `tsc --noEmit` clean, `eslint src` 0 warnings, `npm test` 611/611 stable ×3.

---

### Phase G: Teochew/Min Nan & Hakka STT/TTS Speech Optimization

> **Design:** [subsystems/dialect-speech-optimization-stt-tts.md](subsystems/dialect-speech-optimization-stt-tts.md) — comprehensive research into 2024-2026 open-source dialect speech models, three-tier optimization strategy (immediate → model-backed → cloud-GPU).

**Current state (2026-08-09):** Tier-1 local biasing + FormoSpeech Hakka + cloud Fun-ASR/Bailian paths are live (G.1/G.2/G.5.1–2 + Phase 15). Remaining: optional local Teochew TTS hybrid (G.3), optional Whisper-LoRA offline STT (G.4), GPT-SoVITS (G.5.3), and family Teochew clone ID (**15.2.6**).

#### G.1 — Tier 1 Immediate (no new models) ✅

- [x] **G.1.1** — `stt_server.py`: `teo`/`hak` STT langs + dialect-specific `initial_prompt`
- [x] **G.1.2** — `tts-text.ts`: `normalizeForTTS(text, lang)` dialect→Cantonese char substitutions
- [x] **G.1.3** — `stt-lang.ts` + `voices.ts`: teo/hak STT mappings wired (`sttLangFromVoice`)
- [x] **G.1.4** — Unit tests: `tts-text.test.ts` (normalizeForTTS) + `stt-lang.test.ts`

#### G.2 — Tier 2 Hakka TTS ✅ (shipped as FormoSpeech sidecar — see Phase **15.2.7**)

> Original VoxHakka plan superseded by `scripts/formospeech_server.py` (`formospeech/yourtts-htia-240704`) + `FORMOSPEECH_TTS_URL` + frontend `/api/tts?lang=hak`.

- [x] **G.2.*** — FormoSpeech YourTTS Hakka path live (not the original `hakka_tts.py` / stt_server wiring; functionally equivalent)

#### G.3 — Tier 2 Teochew TTS (local hybrid) — still open

> Cloud path already covers Teochew TTS via Phase **15** (Bailian clone / `longanmin_v3`). Local FastSpeech2 hybrid remains optional if cloud quality insufficient.

- [ ] **G.3.1** — Install PaddleSpeech + `fastspeech2_canton` preset + `pyPengIm` G2P
- [ ] **G.3.2** — Build inference pipeline: pyPengIm → FastSpeech2 → HiFi-GAN/BigVGAN teochew
- [ ] **G.3.3** — Subjective MOS evaluation: hybrid vs Bailian / edge
- [ ] **G.3.4** — Wire into local TTS path if quality acceptable

#### G.4 — Tier 2 STT (Whisper-Tiny + LoRA ONNX) — still open / optional

> Cloud path already covers dialect STT via Phase **15** (百炼 Fun-ASR primary). Local LoRA remains optional for offline / cost control.

- [ ] **G.4.1** — Train Teochew LoRA adapter on `teochew_wild` (GPU Colab, ~4-6h)
- [ ] **G.4.2** — Train Hakka LoRA adapter on Hakka radio data (GPU Colab, ~4-6h)
- [ ] **G.4.3** — Merge + export ONNX INT8 (~110 MB per model)
- [ ] **G.4.4** — Integrate with `stt_server.py` (ONNX runtime path for teo/hak)
- [ ] **G.4.5** — Benchmark CER + RTF + RAM; A/B vs Fun-ASR / Whisper auto

#### G.5 — Tier 3 Cloud-GPU — partially shipped via Phase 15

- [x] **G.5.1** — Fun-ASR (百炼) dialect STT primary path — see **15.1**
- [x] **G.5.2** — Bailian / CosyVoice-family Teochew TTS (+ clone IDs) — see **15.2** (family clone ID still pending **15.2.6**)
- [ ] **G.5.3** — GPT-SoVITS fine-tune on teochew_wild for native Teochew TTS (optional / future)

**Key research findings (see design doc for full details):**
- VoxHakka / FormoSpeech YourTTS is **CPU-suitable** and CC-BY-4.0 — shipped for Hakka
- Whisper-tiny+LoRA INT8 is only ~110 MB RAM — optional offline path; cloud Fun-ASR is current primary
- Teochew has public vocoders but no acoustic model checkpoint — cloud Bailian covers TTS for now
- Fun-ASR path is live; no need to block on GPU-local Fun-ASR-Nano

---

## 🟡 Phase 15: 方言 STT/TTS 云端 API 弥合 — nearly done（2026-08-08）

> **Design:** [subsystems/dialect-cloud-tts-stt-correct.md](subsystems/dialect-cloud-tts-stt-correct.md) — 对 `dialect-stt-tts-gap-closure-plan.md`（更新版：讯飞方言 ASR + 阿里云声音复刻）的详细方案设计与可行性分析
> **核心原则：** ① 云端依赖永不成为单点故障（失败/超时/无 Key 自动降级）② 磁盘缓存硬上限 + LRU ③ 方言转写结果必须用户可编辑确认后发送 ④ 本机零常驻算力新增。  
> **2026-08-09 调整：** STT 主路径改百炼 Fun-ASR；讯飞默认关闭（`STT_BACKUP_IFYTEK`）；TTS：潮汕百炼 / 客家 FormoSpeech；**普通话·粤语·英语仍 edge-tts**。见 `bailian-stt-tts.md`。

### 15.1 — STT：百炼主路径 + 讯飞可选备份

- [x] **15.1.1** — `src/lib/iflytek-asr.ts`：讯飞客户端保留（备份）
- [x] **15.1.2** — `/api/transcribe`：① 百炼 Fun-ASR-Flash → ② `STT_BACKUP_IFYTEK=1` 时讯飞 → ③ 本地 Whisper；`engine` 字段
- [x] **15.1.3** — `src/lib/bailian-asr.ts` + env（`ALIYUN_ASR_*` / `STT_BACKUP_IFYTEK`）；设计见 `bailian-stt-tts.md`
- [x] **15.1.4**（历史）讯飞曾作主路径；2026-08-09 起默认关闭控费

### 15.2 — TTS：阿里云百炼「声音复刻」+ CosyVoice（P1 核心，更新版计划首选）

- [x] **15.2.1** — `src/lib/tts-provider.ts`：百炼优先（讯飞 TTS 无潮汕/客家/闽南）；teo 无复刻 → `longanmin_v3` 闽南话系统音色；**禁止普通话音色**；hak 无复刻 → edge
- [x] **15.2.2** — `src/lib/tts-cache.ts` 🆕：`data/tts-cache/<sha256(text+voice)>.mp3`，原子写，`pruneTtsCache(maxBytes, maxAgeMs)` LRU（默认 3GB / 48h）
- [x] **15.2.3** — `/api/tts/route.ts`：`lang` 可选参数；方言走 provider + 缓存 + 云端失败 fallback edge；其余走现状白名单路径
- [x] **15.2.4** — `scripts/health-check.mjs` 新增 `tts-cache` 巡检（超限告警 + 触发 prune）
- [x] **15.2.5** — `.env.local.example` 新增 `ALIYUN_DASHSCOPE_API_KEY` / `TEO_CLONE_VOICE_ID` / `HAK_CLONE_VOICE_ID` / `TTS_CACHE_MAX_BYTES`（SpeechSynthesizer 端点）
- [ ] **15.2.6** — 潮汕话：家人录音 → 百炼复刻 → `TEO_CLONE_VOICE_ID`（当前临时：百炼闽南话 `longanmin_v3`，非普通话）
- [x] **15.2.7** — 客家话 TTS：FormoSpeech `yourtts-htia`（繁体规范化 + 预合成缓存 + PM2 sidecar `FORMOSPEECH_TTS_URL`）；**禁止粤语 edge 顶替**。设计见 `formospeech-hakka-tts.md`
- [x] **15.2.8** — 潮汕话/客家话路径全面去掉粤语 TTS 回退（失败返回 503 + hint）

### 15.3 — STT 兜底：LLM 方言纠错 + 用户确认（P1，更新版计划 §4 步骤 5）

- [x] **15.3.1** — `src/lib/dialect-stt-correct.ts` 🆕：`buildDialectCorrectionPrompt()`（附词典高频词 + 只纠同音/禁扩写）+ `parseCorrectionResult()`（严格 JSON，失败回退 raw）
- [x] **15.3.2** — `/api/dialect-correct/route.ts` 🆕：复用 `/api/dict/translate` 的 Agent 非流式模式；`{ text, dialect }`；失败返回 `{ corrected: raw, changed: false }` 不阻塞
- [x] **15.3.3** — `VoiceControls.tsx`：方言首次选择提示（讯飞 STT + 百炼复刻 TTS / 未配置本地兜底）
- [x] **15.3.4** — `Composer.tsx`：方言模式 `onTranscript` 只 setText **不自动发送**，调 `/api/dialect-correct` 后由用户确认；非方言保持现状

### 15.4 — 测试 + 文档

- [x] **15.4.1** — UT：`iflytek-asr.test.ts`（签名 URL 确定性 / WAV→PCM / 帧解析）
- [x] **15.4.2** — UT：`tts-provider.test.ts`（无 Key fallback / 有 Key+voiceId 走 aliyun-clone / edge voice 正确）
- [x] **15.4.3** — UT：`tts-cache.test.ts`（key 稳定 / 往返 / prune 超限删最旧 / TTL 过期 / tmp 无残留，SPARK_DATA_DIR 隔离）
- [x] **15.4.4** — UT：`dialect-stt-correct.test.ts`（prompt 含高频词 / parse 合法 / 非法回退 raw / changed 标志）
- [x] **15.4.5** — UT：`transcribe-route.test.ts`（方言：有 Key+mock 成功→iflytek；失败→whisper；无 Key→whisper）
- [x] **15.4.6** — 前端：方言不自动发送 / 纠错填入输入框确认
- [x] **15.4.7** — 全量 tests 绿 + `next build` 通过 + 发布（见 `dialect-cloud-tts-poc.md`）
- [x] **15.4.8** — `docs/subsystems/dialect-cloud-tts-poc.md` 🆕：声音复刻 / 讯飞 POC 记录与主页验收清单

### 15.5 — 降级项（更新版计划确认，标 backlog）

- [ ] **15.5.1** — 百度潮汕话 TTS（企业定制音库产品，联系商务确认 API 形态后评估）
- [ ] **15.5.2** — 闽南语替代潮汕话（仅"实在无潮汕话录音"时权宜，音系差异需实测）
- [ ] **15.5.3** — 客家话本地量化模型（VoxHakka / `mms-tts-hak` 等；4GB 机器不常驻；优先仍是家人复刻 15.2.7）

### 15.6 — TEO: Teochew STT Remediation（2026-08-10）

> **Design:** [subsystems/teochew-stt-remediation.md](subsystems/teochew-stt-remediation.md) — root cause analysis (Bailian generic-Minnan vs. local Chaoshan), iFlytek A/B eval, feedback enrichment, engine routing.
> **Principle:** TEO.4 already done (feedback fields). TEO.0 blocks TEO.1–3. TEO.5 is independent.

- [ ] **TEO.0** — Real-audio A/B: Bailian vs. iFlytek on 12–15 Teochew clips (internet datasets — `panlr/teochew_wild`; human-scored) — see §4
- [x] **TEO.4** — Feedback log: `DialectFeedback.engine` + `.original` fields — `dialect-feedback.ts` + tests (6 passing)
- [x] **TEO.5** — Wire UI call site (`Composer.tsx` / dialect-correct path) to pass `engine` + `original` through to `/api/dialect-feedback`
- [ ] **TEO.1–3** — Per-dialect STT engine routing (`stt-engine-order.ts` + `route.ts` rewire) — only if TEO.0 confirms iFlytek wins
  - [ ] **TEO.1** — `stt-engine-order.ts` + unit tests
  - [ ] **TEO.2** — Rewire `route.ts` POST to walk ordered list for `teo`/`hak`
  - [ ] **TEO.3** — Regression: `hak` behavior unchanged (Bailian-first)

---

## Legacy Pending

**Multi-tenant flat-key leak bug** — Non-Ryan accounts were inheriting Ryan's conversation history, learning memory, engagement, and voice preferences due to unguarded flat-key fallbacks. Fixed in all five loaders.

- [x] Gate flat-key fallback behind `accountId === RYAN_ACCOUNT` in: `storage.ts`, `learning-memory.ts`, `engagement.ts`, `voices.ts`
- [x] Fix `handleSwitchAccount` variable shadowing + add server hydration on switch in `TutorShell.tsx`
- [x] Regression tests in `tenant-storage.test.ts` (6 tests: non-Ryan accounts never leak flat-key data)

**Global cross-device account sync** — Accounts were localStorage-only (device-local). Now synced globally via the server.

- [x] `src/lib/accounts-store.ts` — Server-side file store (`data/accounts/accounts.json`, atomic write)
- [x] `src/app/api/accounts/route.ts` — `GET` / `PUT /api/accounts`
- [x] `hydrateAccountsFromServer()` + `pushAccountsToServer()` in `student-profile.ts`
- [x] `saveAccounts()` auto-pushes to server on every write (create, switch, delete)
- [x] `TutorShell.tsx` and `AccountHome.tsx` hydrate accounts from server on init
- [x] Unit tests: `accounts-store.test.ts` (round-trip write+read)
- [x] 49 test files, 551 tests all passing

**2026-08-08 — Cross-device sync patches** (4 race-condition fixes)

- [x] **P1: Race condition** — debounce `pushStoreToServer` could fire before `hydrateFromServer` populated `deletionCache` on fresh page loads, re-uploading a tombstoned conversation. Added `hydrationDoneRef` gate.
- [x] **P2: Stale account list in periodic sync** — The 60s periodic sync only refreshed conversations, not accounts. Accounts created/deleted on another device never appeared until a full page reload. Periodic sync now calls `hydrateAccountsFromServer()` and detects remote additions/removals.
- [x] **P3: Account switch missing photo restore** — `handleSwitchAccount` only hydrated conversations from server but never restored photos from vault, nor fetched missing cross-device photos. Now runs the full chain: hydrate → restore vault → fetch from server.
- [x] **P4: Cross-device photo gap** — Photos uploaded from another device had `mediaId` but no `dataUrl`. The vault only held local-device photos. New `fetchMissingPhotosFromServer()` in `photo-vault.ts` fetches binary from `/api/media/[mediaId]` for any attachment with `mediaId` but no `dataUrl`, and caches in the local vault.
- [x] `tsc`, `eslint`, 56 test files / 623 tests all pass.

## ✅ Completed (2026-08-07) — Dictionary / Translation

- [x] `/dict` retitled **Dictionary / Translation** (sidebar + page)
- [x] Word / Sentence segmented UI
- [x] `POST /api/dict/translate` — Cursor Agent sentence + photo OCR translate
- [x] Camera / upload (reuse `CameraCapture`), MW School + Spanish keys, docs/README

---

## ✅ Completed (2026-08-03)

### Phase 0: 极简 UI
- [x] **0.1** Remove all UI chrome (GitHub link, large logo, "New chat" btn — hamburger + voice in header)
- [x] **0.2** Mobile-first: 375px target, 44px touch targets, auto-expand textarea
- [x] **0.3** Photo-first: camera = primary, upload = icon-only paperclip
- [x] **0.4** Singapore bar-model `bar` shape in `draw_geometry`
- [x] **0.5** BASIS G5 textbook templates in `prompts.ts`
- [x] **0.6** Multi-lingual word-problem: `detectLanguage()`, `isWordProblem()`, `inferSkillsFromTextMultiLang()`
- [x] **0.7** Zero-login session persistence (URL-query param → localStorage)

### Phase 1: Memory Module
- [x] **1.1** SM-2 decay (`applySm2Decay`, `sm2Update`, `outcomeToSm2Quality`) — 9 tests
- [x] **1.2** Prerequisite-aware selection (`prerequisitesSatisfied`, ≥60%) — wired into warm-up
- [x] **1.3** Recall cache (`storeRecallCache`/`loadRecallCache`, 5min TTL)
- [x] **1.4** ZPD scoring (`zpdScore`, `pSolve`, `jointPSolve`, `zpdWarmUpSkills`) — 14 tests
- [x] **1.5** Confidence-weighted BKT (high-conf wrong → double penalty)
- [x] **1.6** Elo-hybrid difficulty (`eloUpdate`, `difficultyAdjustedBktParams`) — 7 tests

### Phase 2: Agent & Prompt (partial)
- [x] **2.1** Subject-specific coaching templates (math/reading/science/writing)
- [x] **2.3** Progressive disclosure (`~~~step` fences, click-to-reveal)
- [x] **2.2** Multi-turn worksheet planning — shipped as **CA-1** (`worksheet-planner.ts` + progress chip); **UI-A1a/b** shipped in UI-POLISH; hardening **A1.h** still open
- [ ] **2.4** Capture/replay student reasoning chains — see analysis **CA-5** / **C1**

### Phase 6: Testing (partial)
- [x] **6.1.6** Engagement tests — 13 tests (streak, badges, summary, serialization)
- [x] **6.2.1–6.2.6** SM-2, ZPD, confidence, Elo, multi-lingual tests

### Quick Wins
- [x] Theme system (4-theme `ThemePicker`; supersedes old `DarkToggle`)
- [x] Keyboard: Shift+Enter = newline, Enter = send
- [x] `test:ci` + `coverage` scripts in `package.json`

---

## ✅ Phase 0: Full-Stack UI Implementation — mostly done (manual QA remain)

> **Spec:** [subsystems/ui-architecture.md](subsystems/ui-architecture.md)  
> **Code status (2026-08-09):** Composer/VoiceControls English chrome, sidebar slide, empty/error states, focus-visible, safe-area — present in code. Competitive §12 polish shipped under **UI-POLISH** (`a1e282d`).

### ✅ 0.8 Composer Layout Overhaul

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 0.8a | Flatten `VoiceControls` to inline fragment | done | `VoiceControls.tsx` |
| ✅ 0.8b | Responsive toolbar labels | done | `Composer.tsx` |
| ✅ 0.8c | Phone layout + safe-area bottom padding | done | `Composer.tsx`, `globals.css` |
| ✅ 0.8d | Tablet: `Snap homework`, hold-to-talk | done | `Composer.tsx`, `VoiceControls.tsx` |
| ✅ 0.8e | Desktop: full labels + inline voice | done | `Composer.tsx`, `VoiceControls.tsx` |

### ✅ 0.9 English Chrome

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 0.9a–d | English labels / aria / Speak on·off / Snap homework / Hold to talk | done | `voices.ts`, `Composer.tsx`, `VoiceControls.tsx` |

### ✅ 0.10 Shell & Sidebar Polish

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 0.10a | Sidebar slide animation | done | `HistorySidebar.tsx` |
| ✅ 0.10b | Empty state + delete confirmation | done | `HistorySidebar.tsx` |
| ✅ 0.10c | Hamburger ↔ X; brand header | done | `TutorShell.tsx` |
| ✅ 0.10d | Header minHeight 48 | done | `TutorShell.tsx` |
| ✅ 0.10e | Chat-first SkillsPanel strip | done | `HistorySidebar.tsx`, `SkillsPanel.tsx` |

### ✅ 0.11 Chat UX

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 0.11a | Left/right bubbles | done | `ChatThread.tsx` |
| ✅ 0.11b | Auto-scroll + "↓ New messages" | done | `ChatThread.tsx` |
| ✅ 0.11c | Streaming / thinking pulse | done | `ChatThread.tsx` |
| ✅ 0.11d | Empty state + Snap homework CTA | done (**UI-E1** shipped) | `ChatThread.tsx` |

### ✅ 0.12 States & Feedback

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 0.12a | Coral error banner | done | `TutorShell.tsx` |
| ✅ 0.12b | Speak on/off + speaking states | done (speaking ring polish → **UI-B2a**) | `VoiceControls.tsx` |

### ✅ 0.13 Accessibility

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 0.13a | `focus-visible:ring-2` on interactive controls | done | components |
| ✅ 0.13b | Esc closes sidebar | done | `TutorShell.tsx` |

### 🟡 0.14 Device QA (manual — verify)

| # | Task | Effort | Files |
|---|------|--------|-------|
| [ ] 0.14a | Phone QA: iPhone 14 + Huawei — toolbar 1 row, Send visible, keyboard safe-area | 0.25d | Manual |
| [ ] 0.14b | Tablet + Desktop QA: iPad + PC — Snap homework, Enter sends | 0.25d | Manual |

---

## 🔴 Phase 6: Testing Gaps (still open)

> Note: reliability suite (`cursor-agent-reliability`, atomic writes, SSE) and some UI tests (`ThemePicker`, `ImageLightbox`, camera) already exist — gaps below are the remaining core holes.

| # | Task | Effort | Risk |
|---|------|--------|------|
| 6.1.1 | `cursor-agent.ts` unit tests beyond reliability helpers — mock Cursor SDK stream end-to-end | 2d | Core AI layer partially covered |
| 6.1.2 | `speech-player.ts` unit tests — mock Web Audio API, queue, abort, autoplay | 2d | TTS bugs break voice |
| 6.1.3 | `history-sync.ts` deeper conflict/corrupt cases (basic tests exist) | 1d | Data loss risk |
| 6.1.4 | `chat/route.ts` unit tests — mock Agent, prompt assembly, error codes | 2d | Main endpoint untested |
| 6.1.5 | React component tests — TutorShell, Composer, MarkdownMessage, 375px layout | 3d | Partial UI coverage only |

---

## 🟡 Phase 2: Agent & Prompt (remaining)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| ✅ 2.2 | Multi-turn worksheet planning — **done via CA-1** | — | — |
| 2.4 | Capture/replay student reasoning — store L1.5 "why" answers as examples | 3d | `learning-memory.ts` / **CA-5** |

---

## 🟡 Phase 3: Geometry & Visualization (13d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 3.1 | Interactive geometry: drag to measure angles/lengths on diagrams | 5d | `DiagramBlock.tsx`, SVG |
| 3.2 | Animated step-by-step geometry constructions | 3d | `geometry-svg.ts` |
| 3.3 | Desmos-like coordinate graphing for algebra | 5d | New component — see analysis **CA-9** |

---

## 🟡 Phase 4: Voice & Multi-Modal (remaining)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| ✅ 4.1a | TTS barge-in — **done via CA-4** (`speech-barge-in.ts`) | — | — |
| 4.1b | Continuous half-duplex voice + interrupt-resume (= backlog **B2b**) | 4d | `speech-player.ts`, `Composer.tsx` |
| ✅ 4.2 | Natural number / LaTeX pronunciation — `latexToSpeech` in `tts-text.ts` | — | — |
| 4.3 | Parent voice note recording — parent records message attached to chat | 3d | New component |

---

## 🟢 Phase 5: Platform & DevOps (9d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 5.1 | PWA install + offline — cache app shell, offline chat history | 3d | `layout.tsx`, service worker |
| 5.2 | Docker deployment — single-container deploy with health check | 2d | Dockerfile |
| 5.3 | Automated BKT parameter tuning from logs | 3d | `bkt.ts` |
| 5.4 | Error telemetry (Sentry or custom) | 2d | Agent, API |

---

## 🟢 Remaining Testing (7.5d)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 6.2.5 | Singapore bar model render tests | 1d | Horizontal/vertical bars, comparison, part-whole, overflow |
| 6.2.7 | Photo-first workflow tests | 1d | Image resize, format, MIME, corrupt image, IndexedDB |
| 6.2.9 | Progressive disclosure UI tests | 0.5d | Click-to-reveal transitions, keyboard |
| 6.3.1–6.3.4 | API route unit tests (4 routes) | 2d | `learning/`, `history/`, `tts/`+`transcribe/`, `media/` |
| 6.4.1 | GitHub Actions CI: unit + build on push/PR | 1d | |
| 6.4.3 | Vitest coverage threshold (70% `src/lib/`) | 0.5d | |
| 6.4.4 | Pre-commit hook: `tsc --noEmit` + `eslint` | 0.5d | |

---

## ✅ Phase 7: Code Agent Reliability — done

> **Design:** [code-agent-reliability-design.md](code-agent-reliability-design.md)  
> **Spec:** [subsystems/code-agent-robustness.md](subsystems/code-agent-robustness.md)  

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 7.1 | Port pre-flight in `start.sh` (3000/3001/8765) | done | `start.sh` |
| ✅ 7.2 | `@cursor/sdk` ^1.0.26 pinned | done | `package.json` |
| ✅ 7.3–7.4 | Stale session + `executeWithRetry` | done | `agent-retry.ts`, `cursor-agent.ts` |
| ✅ 7.5 | Agent run log JSONL | done | `run-log.ts` |
| ✅ 7.6 | `lockedWriteJson` atomic writes | done | `file-lock.ts`, `history-store.ts` |
| ✅ 7.7 | SSE heartbeat + `id:` fields | done | `chat/route.ts` |

---

## ✅ Phase 8: Code Agent Mini Window UI — done

> **Design:** [subsystems/code-agent-mini-window.md](subsystems/code-agent-mini-window.md)  

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 8.1 | `CodeAgentPanel` wired in `TutorShell` (no iframe) | done | `CodeAgentPanel.tsx` |
| ✅ 8.2 | `animate-slide-in-right` for right panel | done | `CodeAgentPanel.tsx` |
| ✅ 8.3 | Close / backdrop / swipe-down | done | `CodeAgentPanel.tsx` |
| ✅ 8.4 | Guided hint examples (`HINT_EXAMPLES`) | done | `CodeAgentPanel.tsx` |
| ✅ 8.5 | Tool status / streaming status line | done | `CodeAgentThread.tsx` |
| ✅ 8.6 | Friendly error states + reconnect | done | `CodeAgentPanel.tsx` |
| ✅ 8.7 | Thread truncation ≥500 chars | done | `MiniConsoleThread.tsx` / `CodeAgentThread.tsx` |
| ✅ 8.8 | Session load + "+ New" | done | `CodeAgentPanel.tsx` |
| ✅ 8.9 | ACC link when :3001 reachable | done | `CodeAgentPanel.tsx` |

### Mobile disconnect / context resume (2026-08-10)

> **Design:** [subsystems/code-agent-mobile-resume.md](subsystems/code-agent-mobile-resume.md)

- [x] **MR-1** — `console-run-store`: create / append / finish / eventsAfter / session active
- [x] **MR-2** — Detach agent from `req.signal` abort in `/api/console/chat` (abort closes SSE only)
- [x] **MR-3** — `GET /api/console/chat?sessionId=` → messages + `activeRun`; optional `runId`+`after` SSE reattach
- [x] **MR-4** — Persist Code Agent panel context (msgs, phase, runId) in `mini-console-store`
- [x] **MR-5** — `CodeAgentPanel`: visibility resume + poll/reattach; unit tests green


---

## ✅ Phase 9: STT Service Reliability — done

> **Design:** [subsystems/stt-service-reliability.md](subsystems/stt-service-reliability.md)  

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 9.1 | `spark-stt.service` systemd unit | done | `/etc/systemd/system/spark-stt.service` |
| ✅ 9.2 | Port preflight + SIGTERM handler | done | `stt_server.py`, `start.sh` |
| ✅ 9.3 | Model load isolation | done | `stt_server.py` |
| ✅ 9.4 | Enhanced `/health` | done | `stt_server.py` |
| ✅ 9.5 | `health-stt.sh` | done | `scripts/health-stt.sh` |
| ✅ 9.6 | `beam_size=1` default CPU tuning | done | `stt_server.py` |

---

## 🟡 Phase 10: Reliability Tests — unit done; integration/E2E/CI remain

> **Design:** [code-agent-test-design.md](code-agent-test-design.md)  

### ✅ 10.1 Unit Tests

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 10.1a | Agent session recovery / retry tests | done | `cursor-agent-reliability.test.ts` |
| ✅ 10.1b–e | Atomic write + file lock + run-log + SSE encode tests | done | `__tests__/history-store-atomic.test.ts`, `run-log.test.ts`, `sse-encode.test.ts` |

### 🟡 10.2 Integration Tests (partial)

| # | Task | Status | Files |
|---|------|--------|-------|
| [ ] 10.2a | Agent session recovery integration | missing | `scripts/verify-agent-recovery.mjs` |
| ✅ 10.2b | SSE reliability integration | done | `scripts/verify-sse-reliability.mjs` |
| ✅ 10.2c | File locking integration | done | `scripts/verify-file-locking.mjs` |
| [ ] 10.2d | STT reliability integration (dedicated) | missing (`verify-stt.mjs` exists — verify if covers) | `scripts/verify-stt-reliability.mjs` |

### 🔴 10.3 E2E + Chaos Tests

| # | Task | Status | Files |
|---|------|--------|-------|
| [ ] 10.3a | Code agent mini window E2E | missing | `scripts/verify-code-agent-e2e.mjs` |
| [ ] 10.3b | Graceful degradation E2E | missing | `scripts/verify-e2e-reliability.mjs` |
| [ ] 10.3c | GitHub Actions CI | missing (no `.github/workflows`) | `.github/workflows/reliability.yml` |

---

## 🟢 Nice-to-Have

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1.7 | Parent dashboard — skill radar chart, mastery timeline, heatmap | 5d | NOT visible to child; prefer **D2** daily one-liner; weekly → P3 |
| N1 | Export learning memory as printable PDF | 1d | For parent review |
| N2 | Inline skill tag on each message (agent-only) | 0.5d | Which skill was practiced |
| N3 | Tree-shake unused UI from production bundle | 0.5d | |
| N4 | Code agent: support `/fix`, `/explain`, `/add` slash commands | 1d | Quick vibe coding shortcuts |
| N5 | Code agent: "Undo last change" button in mini window | 0.5d | Uses git revert |
| N6 | Code agent: syntax-highlighted code blocks in thread | 1d | Prism.js or Shiki in MiniConsoleThread |

---

## ✅ Phase 11: Code Agent v3 — Multi-Modal, Auto-Git, Service Resilience — done

> **Design:** [code-agent-v3-enhancements.md](code-agent-v3-enhancements.md)  
> **Priorities:** 11A (upload ⊹ voice) · 11C (auto-git) · 11D (service restart)  
> **Status:** ✅ ALL DONE — implemented & verified 2026-08-04

### 11A: Image & PDF Upload (6h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11A.1 | Extend `ChatRequest` type + `AgentStreamEvent` for attachments | 0.5h | `agent-chat/src/lib/types.ts` |
| ✅ 11A.2 | `buildAttachmentLines()` in prompts — extract PDF text (pdftotext), decode text files, describe images | 1.5h | `agent-chat/src/lib/prompts.ts` |
| ✅ 11A.3 | Update `streamAgentResponse()` to accept attachments, inject into prompt | 1h | `agent-chat/src/lib/agent.ts` |
| ✅ 11A.4 | Update SSE chat route to forward attachments | 0.5h | `agent-chat/src/app/api/chat/route.ts` |
| ✅ 11A.5 | Frontend: camera button + file picker + attachment pills with thumbnail previews | 1.5h | `agent-chat/public/index.html` |
| ✅ 11A.6 | Frontend: `fileToAttachment()` — read file → base64, compress images, clip text | 1h | `agent-chat/public/index.html` |

### 11B: Chinese/English Voice Input (3h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11B.1 | Voice lang toggle button ("zh"↔"en") in input bar; `voiceLang` state | 1h | `agent-chat/public/index.html` |
| ✅ 11B.2 | Wire lang into Web Speech API `recognition.lang` and server STT `language` param | 0.5h | `agent-chat/public/index.html` |
| ✅ 11B.3 | Visual feedback: recording pulse per language, auto-reset after transcription, re-focus input | 1h | `agent-chat/public/index.html` |
| ✅ 11B.4 | Update system prompt: note user's voice language preference for reply language | 0.5h | `agent-chat/src/lib/prompts.ts` |

### 11C: Auto Commit + Push to Develop (6h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11C.1 | `git-ops.ts` — `runTests(workspace)` with 120s timeout, exitCode + stderr capture | 1.5h | `agent-chat/src/lib/git-ops.ts` 🆕 |
| ✅ 11C.2 | `git-ops.ts` — `stageAndCommit(workspace, message)` with empty-diff guard | 1h | `agent-chat/src/lib/git-ops.ts` |
| ✅ 11C.3 | `git-ops.ts` — `pushBranch(workspace, branch)` with auth-failure detection | 0.5h | `agent-chat/src/lib/git-ops.ts` |
| ✅ 11C.4 | `git-ops.ts` — `detectFileChanges(events)` from tool_call stream events | 1h | `agent-chat/src/lib/git-ops.ts` |
| ✅ 11C.5 | Post-stream git hook in chat route — if `AUTO_GIT_ENABLED` and changes detected, run test gate → commit → push | 1h | `agent-chat/src/app/api/chat/route.ts` |
| ✅ 11C.6 | Extend SSE "done" event — include `commitSha`, `commitMessage`, `testResult` | 0.5h | `agent-chat/src/lib/types.ts`, `agent.ts` |
| ✅ 11C.7 | Frontend: display commit SHA + test result badge in final message | 0.5h | `agent-chat/public/index.html` |

### 11D: Service Restart with Verification (7h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11D.1 | `/api/setup` health endpoint for ACC | 0.5h | `agent-chat/src/app/api/setup/route.ts` 🆕 |
| ✅ 11D.2 | `systemd` unit for ACC (`spark-acc.service`) | 0.5h | `/etc/systemd/system/spark-acc.service` 🆕 |
| ✅ 11D.3 | `restart-services.sh` — ordered stop → start → health-check gate with timeout + retry per service | 2h | `scripts/restart-services.sh` 🆕 |
| ✅ 11D.4 | `health-check.mjs` — standalone checker: 3 services × health endpoint, JSON output, exit 0/1 | 1h | `scripts/health-check.mjs` 🆕 |
| ✅ 11D.5 | Health matrix: STT (8765/health 60s), Spark (3000/api/setup 30s), Spark page (3000/ 15s), ACC (3001/ 15s) | 1h | `scripts/restart-services.sh`, `scripts/health-check.mjs` |
| ✅ 11D.6 | Update `start.sh` to call `restart-services.sh` post-launch | 1h | `start.sh` |
| ✅ 11D.7 | Integration test: kill all services, run restart script, verify all health checks pass | 1h | `scripts/verify-service-restart.mjs` 🆕 |

---

## 🟡 Phase 12: Grade-Agnostic Adaptive Tutoring — mostly done; safeguards + WL catalog remain

> **Design:** [subsystems/grade-agnostic-adaptive.md](subsystems/grade-agnostic-adaptive.md)  
> **Code status (2026-08-09):** `gradeBand`, `languageForBand`, expanded `skill-catalog`, `autoAdvanceCheck`, `curriculumPromptLines`, `prerequisiteChain` are in tree. Remaining: `policy.ts` / `validateTutorResponse` / `lastModifiedSkill`, and world-language skill sub-catalog.

### ✅ 12A–12E — shipped

| # | Area | Status |
|---|------|--------|
| ✅ 12A.* | Profile abstraction (`gradeBand`, `RYAN_PROFILE`, `curriculum`, `bktDefaultsForBand`, `curriculumPromptLines`) | done |
| ✅ 12B.* | Age-adaptive `LanguagePreset` / `languageForBand` / band coaching | done |
| ✅ 12C.* | Multi-band skill catalog + `activeSkillsForProfile` + tests | done |
| ✅ 12D.* | `autoAdvanceCheck` + `advanceSuggestion` + tests | done |
| ✅ 12E.* | AccountHome grade selector; dynamic account name (no hard-coded Hi Ryan in shell) | done |

### 🟡 12F: BASIS Curriculum Alignment — mostly done

| # | Task | Status | Notes |
|---|------|--------|-------|
| ✅ 12F.1 | `curriculumPromptLines()` textbook refs | done | lives in `student-profile.ts` (no separate `curriculum.ts`) |
| ✅ 12F.2 | Parallel science skills in catalog | done | separate skill IDs / pKnown per science skill |
| ✅ 12F.3 | Capstone advisor prompt for G12 | done | `curriculumPromptLines` emits research-advisor role |
| [ ] 12F.4 | World-language `LanguageSkillDefinition` sub-catalog | open | no `language: zh\|es\|fr\|la` skill type yet |
| ✅ 12F.5 | Ryan regression path present | verify | `prompts.test.ts` / profile tests exist — spot-check if exact BASIS_G4 match still asserted |

### 🟡 12G: Research-Aligned Safeguards — partial

| # | Task | Status | Notes |
|---|------|--------|-------|
| [ ] 12G.1 | `gradePolicyForBand` / `policy.ts` | open | file missing |
| [ ] 12G.2 | `lastModifiedSkill` audit on merge write gate | open | `mergeLearningMemory` exists; audit field not found |
| [ ] 12G.3 | `validateTutorResponse` non-blocking checker | open | not found |
| ✅ 12G.4 | `prerequisiteChain` DAG helper | done | `skill-catalog.ts` |
| ✅ 12G.5 | `prerequisiteChain` unit tests | done | `skill-catalog.test.ts` |

---

## ✅ Phase 13: Multi-Tenant Account Isolation — mostly done

Design: **[subsystems/multi-tenant-isolation.md](subsystems/multi-tenant-isolation.md)** v0.1  
**Code status (2026-08-09):** `tenant-storage`, namespaced loaders, account-scoped APIs, `AccountSwitcher`/`AccountAvatar`, `verify-multi-tenant.mjs` present. Flat-key leak fix also under Legacy Pending.

### ✅ 13A–13D, 13F — shipped

| # | Area | Status |
|---|------|--------|
| ✅ 13A.* | `TenantStorage` / `nsKey` + per-account memory/sessions/engagement/voices | done |
| ✅ 13B.* | Flat → namespaced fallback + migration sentinel (`isAccountMigrated` / `markMigrated`) | done |
| ✅ 13C.* | `/api/learning` + `/api/history` `accountId` scoping + sync hooks | done |
| ✅ 13D.* | `AccountSwitcher` + `AccountAvatar` + AccountHome school/subjects + TutorShell switch | done |
| ✅ 13F.* | `tenant-storage.test.ts` + `scripts/verify-multi-tenant.mjs` | done |

### 🟡 13E: Privacy & Polish — partial

| # | Task | Status | Notes |
|---|------|--------|-------|
| ✅ 13E.1a | Two-step delete + Ryan undeletable + clear namespaced keys | done | `AccountHome.tsx` |
| [ ] 13E.1b | PIN gate before delete forever | open | two-step confirm only; no `PinGate` on delete path |
| [ ] 13E.2 | Grade-band-specific empty welcome copy | open | `ChatThread` empty state is generic |
| ✅ 13E.3 | Max 6 accounts enforcement | done | `MAX_ACCOUNTS = 6` |

---

## ✅ Phase 14: Image Lightbox — Top Layer + Zoom — done (manual/pinch remain)

> **Design:** [subsystems/image-lightbox-zoom.md](subsystems/image-lightbox-zoom.md)

### ✅ 14A + 14B — shipped

| # | Task | Status | Files |
|---|------|--------|-------|
| ✅ 14A.1–14A.5 | Portal `z-[200]`, zoom helpers, toolbar, pan, keyboard | done | `lightbox-zoom.ts`, `ImageLightbox.tsx` |
| ✅ 14B.1–14B.2 | Unit + component tests | done | `lightbox-zoom.test.ts`, `ImageLightbox.test.tsx` |

### 🟡 14C: Manual QA + Polish

| # | Task | Status | Files |
|---|------|--------|-------|
| [ ] 14C.1 | Manual QA on desktop sidebar + phone (verify) | open / manual | Manual |
| [ ] 14C.2 | Optional pinch-to-zoom | open (nice-to-have) | `ImageLightbox.tsx` |

---

## 📋 Phase AUD: 2026-08 external product audit — selective acceptance

> **Design:** [subsystems/audit-2026-08-product-acceptance.md](subsystems/audit-2026-08-product-acceptance.md)  
> Filter: chat-first / no error-book app / no streaks (see competitive-product-plan-v2)

| # | Task | Status | Notes |
|---|------|--------|-------|
| [x] AUD.1 | Acceptance matrix + DESIGN pointer | done | `audit-2026-08-product-acceptance.md` |
| [x] AUD.2 | Dialect visibility in metadata + Help/FAQ | done | `layout.tsx` description + FAQ chips |
| [x] AUD.3 | Static `/privacy` data-use + disclaimer | done | `src/app/privacy/page.tsx` |
| [x] AUD.4 | PIN-gated learning JSON export on `/dashboard` | done | `account-export.ts` + dashboard button |
| [x] AUD.5 | `scripts/backup-data.sh` for `data/` | done | local tar; no `.env` |
| [x] AUD.6a | Soft idle return (≥3d opener + digest idle + dashboard→chat) | **this sprint** | no streaks; `idle-nudge.ts` |
| [ ] AUD.6b | Portfolio PDF / usage admin / multi-model | backlog | Explicit defer |

**AUD.6a checklist**
- [x] `idle-nudge.ts` + unit tests (daysSince, soft copy, stash/consume kickoff)
- [x] Wire idle into `session-opener` + `parent-digest`
- [x] Dashboard Practice CTA + TutorShell consume kickoff
- [x] Empty-chat dialect one-liner
- [x] `run_tests` → apply_changes → publish_develop → deploy_live

**Rejected as product (do not build):** dedicated `/mistakes` 错题本, `/parent` mega-dashboard (keep `/family` narrative hub), streaks, exposed knowledge-map UI, lowering Code Agent PIN.

---

## 📊 Summary (reconciled 2026-08-09)

| Phase | Status | What's left |
|-------|--------|-------------|
| **Competitive CA-P0** (CA-1–4) | ✅ shipped | Manual M1–M4; hardening A1.h / A2.h / B1.h |
| **UI-SPEC / UI-POLISH** | ✅ shipped | UI-P1 (diagramId / B3 chips) deferred with P1 |
| **DEPLOY1 / ENT3–5** | ✅ done | — |
| **Deletion sync + themes + F dialect** | ✅ done | — |
| **Phase G dialect speech** | 🟡 partial | G.3 local Teochew TTS; G.4 LoRA STT (optional); G.5.3 GPT-SoVITS; **15.2.6** clone ID |
| **Phase 15 cloud dialect** | 🟡 nearly done | **15.2.6** family Teochew clone; 15.5 backlog |
| **TEO Teochew STT remediation** | 🟡 TEO.5 done | TEO.4+TEO.5 done; TEO.0 A/B eval pending; TEO.1-3 blocked on TEO.0 result |
| **Phase 0 UI** | ✅ code done | Manual 0.14 QA; competitive polish separate |
| **Phase 6 testing gaps** | 🔴 open | cursor-agent / speech-player / chat route / TutorShell RTL |
| **Phase 7–9, 11** | ✅ done | — |
| **Phase 10** | 🟡 partial | 10.2a/d integration scripts; 10.3 E2E + CI |
| **Phase 12** | 🟡 mostly done | 12F.4 WL catalog; 12G.1–3 policy / validate |
| **Phase 13** | ✅ mostly done | 13E.1b PIN-on-delete; 13E.2 gradeBand empty copy |
| **Phase 14** | ✅ done | 14C.1 manual verify; 14C.2 pinch optional |
| **Phase AUD** | ✅ AUD.1–5 · AUD.6a soft idle | AUD.6b backlog (PDF/usage/multi-model) |
| **Phase 2** | 🟡 | **2.4** / CA-5 only (2.2 done via CA-1) |
| **Phase 3** Geometry | 🔴 open | 3.1–3.3 / CA-9 |
| **Phase 4** Voice | 🟡 | 4.1b continuous; 4.3 parent voice note (4.1a/4.2 done) |
| **Phase 5 / Nice-to-Have** | 🟢 open | PWA, Docker, telemetry, etc. |

**Recommended next focus:**
1. **CA-P0.R3** — human smoke M1–M4 on live (worksheet chip, practice, opener, barge-in)
2. **P1 competitive** — C1/CA-5 (scratch-work / **2.4**), C2–C4 teaching depth
3. **Phase G / 15 remaining** — Teochew family clone ID (**15.2.6**); optional G.3/G.4 only if cloud quality insufficient
4. **TEO Teochew STT** — run A/B eval TEO.0 (internet Teochew samples → human-scored); TEO.5 wired; TEO.1-3 routing only if iFlytek wins
4. **Phase 10.3 / Phase 6** — CI + coverage gaps when hardening

---

## 🔤 Spell Words v1.3 — one-word hear & spell (2026-08-16)

> **Design:** [subsystems/word-echo.md](subsystems/word-echo.md) v1.3

- [x] SW.1 — `word-echo.ts`: `peekMs`, fewer targets (1–3), `WORD_GLOSS` + `wordGloss()`
- [x] SW.2 — `WordEchoGame.tsx`: per-word peek → auto Hear → gloss + spell (drop list-memory)
- [x] SW.3 — Hub card copy: hear & spell one word at a time
- [x] SW.4 — Unit tests for ladder + gloss; `run_tests`
- [ ] SW.5 — apply_changes → publish_develop → deploy_live
