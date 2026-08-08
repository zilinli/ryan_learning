# 📋 Downstream Development TODO

> Version 0.7 · 2026-08-08  
> Priority: 🔴 critical · 🟡 important · 🟢 nice-to-have  
> Baseline: 27 test files, 243 tests, service `active` at :3001  
> New deletion + theme spec: **[subsystems/deletion-sync-and-themes.md](subsystems/deletion-sync-and-themes.md)** (v0.1 — cross-device deletion sync + 4-theme system)
> New adaptive spec: **[subsystems/grade-agnostic-adaptive.md](subsystems/grade-agnostic-adaptive.md)** (v0.2 — BASIS K-12 + research-backed)  
> New multi-tenant spec: **[subsystems/multi-tenant-isolation.md](subsystems/multi-tenant-isolation.md)** (v0.1 — account data isolation design)  
> New lightbox spec: **[subsystems/image-lightbox-zoom.md](subsystems/image-lightbox-zoom.md)** (v0.1 — portal stacking + zoom)  
> Dictionary / Translation: **[subsystems/dictionary-api.md](subsystems/dictionary-api.md)** (word + LLM sentence/photo translate)

---

## 🔴 In Progress (2026-08-07) — Cross-Device Deletion Sync + Multi-Theme

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

**Current state:** STT uses `auto` mode (Whisper maps dialect audio → garbled zh tokens, ~60-70% WER). TTS uses Cantonese voice fallback — native speakers find it jarring. Design research found viable CPU-suitable models for both directions.

#### G.1 — Tier 1 Immediate (no new models, 2-4h)

- [ ] **G.1.1** — `stt_server.py`: add `teo`/`hak` as STT languages with dialect-specific `initial_prompt` (Whisper decoder biasing toward dialect function words 个唔勿食涯冇麼个但係)
- [ ] **G.1.2** — `tts-text.ts` (new): `normalizeForTTS(text, lang)` — dialect→Cantonese character substitutions (汝→你, 涯→我, 勿→唔好 etc.) for better Cantonese TTS output
- [ ] **G.1.3** — `stt-lang.ts` + `voices.ts`: wire teo/hak STT mappings; update voice picker labels
- [ ] **G.1.4** — Unit tests for normalizer + STT routing

#### G.2 — Tier 2 Hakka TTS (VoxHakka, CPU-suitable, 3-5d)

- [ ] **G.2.1** — Accept HF gated access for `formospeech/yourtts-htia-240704` (CC-BY-4.0)
- [ ] **G.2.2** — Install `formog2p.hakka.g2p` frontend + load YourTTS model
- [ ] **G.2.3** — Create `scripts/hakka_tts.py` inference module (text→G2P→phonemes→audio)
- [ ] **G.2.4** — Wire into `stt_server.py` (new `/tts/hakka` or extend `/tts` with voice="voxhakka")
- [ ] **G.2.5** — Frontend: route hakka voice → voxhakka TTS endpoint
- [ ] **G.2.6** — Memory profiling: verify VoxHakka + existing services fit in 4GB
- [ ] **G.2.7** — Integration tests + manual smoke test (hear native Hakka speech)

#### G.3 — Tier 2 Teochew TTS (Hybrid FastSpeech2-Canton + Teochew Vocoder, 5-7d)

- [ ] **G.3.1** — Install PaddleSpeech + `fastspeech2_canton` preset + `pyPengIm` G2P
- [ ] **G.3.2** — Build inference pipeline: pyPengIm (text→Peng'im) → FastSpeech2 (mel) → HiFi-GAN/BigVGAN teochew (wav)
- [ ] **G.3.3** — Subjective MOS evaluation: hybrid vs raw Cantonese TTS
- [ ] **G.3.4** — Wire into `stt_server.py` if quality acceptable

#### G.4 — Tier 2 STT (Whisper-Tiny + LoRA ONNX INT8, CPU-suitable, 1-2wk)

- [ ] **G.4.1** — Train Teochew LoRA adapter on `teochew_wild` (GPU Colab, ~4-6h)
- [ ] **G.4.2** — Train Hakka LoRA adapter on Hakka radio data (GPU Colab, ~4-6h)
- [ ] **G.4.3** — Merge + export ONNX INT8 (~110 MB per model)
- [ ] **G.4.4** — Integrate with `stt_server.py` (ONNX runtime path for teo/hak)
- [ ] **G.4.5** — Benchmark CER + RTF + RAM; A/B vs current auto mode

#### G.5 — Tier 3 Cloud-GPU (Future, 2-4wk)

- [ ] **G.5.1** — Evaluate Fun-ASR-Nano-2512 API for unified dialect STT (supports Min + Hakka natively)
- [ ] **G.5.2** — Evaluate CosyVoice 3 for Teochew TTS (supports Minnan dialect, zero-shot clone)
- [ ] **G.5.3** — GPT-SoVITS fine-tune on teochew_wild for native Teochew TTS

**Key research findings (see design doc for full details):**
- VoxHakka (YourTTS) is **CPU-suitable** and CC-BY-4.0 — the best Hakka TTS option
- Whisper-tiny+LoRA INT8 is only ~110 MB RAM — fits on 4GB server, CER ~15-20% for dialects
- Teochew has public vocoders (BigVGAN OVRL 3.10 ≈ ground truth) but no acoustic model checkpoint
- Fun-ASR-Nano-2512 (Alibaba, 800M) supports Min+Hakka natively but needs GPU
- No commercial API supports Teochew/Hakka at consumer pricing

---

## 🔴 Phase 15: 方言 STT/TTS 云端 API 弥合（2026-08-08）

> **Design:** [subsystems/dialect-cloud-tts-stt-correct.md](subsystems/dialect-cloud-tts-stt-correct.md) — 对 `dialect-stt-tts-gap-closure-plan.md`（更新版：讯飞方言 ASR + 阿里云声音复刻）的详细方案设计与可行性分析
> **核心原则：** ① 云端依赖永不成为单点故障（失败/超时/无 Key 自动降级回本地 Whisper / 粤语 edge-tts）② 磁盘缓存硬上限 + LRU ③ 方言转写结果必须用户可编辑确认后发送 ④ 本机零常驻算力新增。

### 15.1 — STT：讯飞方言识别大模型（P1 核心，更新版计划最高优先）

- [ ] **15.1.1** — `src/lib/iflytek-asr.ts` 🆕：`buildIflytekWsUrl()`（HMAC-SHA256 签名纯函数）+ `wavToRawPcm()` + `appendIflytekFrame()` 帧解析 + `transcribeWithIflytek()`（Node≥22 原生 WebSocket，30s 超时）
- [ ] **15.1.2** — `/api/transcribe/route.ts`：方言模式（teo/hak）有 Key → 优先讯飞；失败/超时/无文本 → fallback 本地 Whisper；透传 `engine` 字段
- [ ] **15.1.3** — `.env.local.example` 新增 `IFYTEK_API_KEY` / `IFYTEK_API_SECRET`

### 15.2 — TTS：阿里云百炼「声音复刻」+ CosyVoice（P1 核心，更新版计划首选）

- [ ] **15.2.1** — `src/lib/tts-provider.ts` 🆕：`TtsProvider` union + `ttsProviderForLang()`（teo/hak 有 Key+复刻音色 → `aliyun-clone`，否则 fallback `zh-HK-WanLungNeural`）+ `callAliyunCloneTts()`（百炼合成端点，6s 超时）
- [ ] **15.2.2** — `src/lib/tts-cache.ts` 🆕：`data/tts-cache/<sha256(text+voice)>.mp3`，原子写，`pruneTtsCache(maxBytes, maxAgeMs)` LRU（默认 3GB / 48h）
- [ ] **15.2.3** — `/api/tts/route.ts`：`lang` 可选参数；方言走 provider + 缓存 + 云端失败 fallback edge；其余走现状白名单路径
- [ ] **15.2.4** — `scripts/health-check.mjs` 新增 `tts-cache` 巡检（超限告警 + 触发 prune）
- [ ] **15.2.5** — `.env.local.example` 新增 `ALIYUN_DASHSCOPE_API_KEY` / `ALIYUN_WORKSPACE_ID` / `TEO_CLONE_VOICE_ID` / `HAK_CLONE_VOICE_ID` / `TTS_CACHE_MAX_BYTES`

### 15.3 — STT 兜底：LLM 方言纠错 + 用户确认（P1，更新版计划 §4 步骤 5）

- [ ] **15.3.1** — `src/lib/dialect-stt-correct.ts` 🆕：`buildDialectCorrectionPrompt()`（附词典高频词 + 只纠同音/禁扩写）+ `parseCorrectionResult()`（严格 JSON，失败回退 raw）
- [ ] **15.3.2** — `/api/dialect-correct/route.ts` 🆕：复用 `/api/dict/translate` 的 Agent 非流式模式；`{ text, dialect }`；失败返回 `{ corrected: raw, changed: false }` 不阻塞
- [ ] **15.3.3** — `VoiceControls.tsx`：方言 voice 转写后调 `/api/dialect-correct` 再回调
- [ ] **15.3.4** — `Composer.tsx`：方言模式 `onTranscript` 只 setText **不自动发送**，提示"已识别，请确认后发送"；非方言保持现状

### 15.4 — 测试 + 文档

- [ ] **15.4.1** — UT：`iflytek-asr.test.ts`（签名 URL 确定性 / WAV→PCM / 帧解析累积）
- [ ] **15.4.2** — UT：`tts-provider.test.ts`（无 Key fallback / 有 Key+voiceId 走 aliyun-clone / edge voice 正确）
- [ ] **15.4.3** — UT：`tts-cache.test.ts`（key 稳定 / 往返 / prune 超限删最旧 / TTL 过期 / tmp 无残留，SPARK_DATA_DIR 隔离）
- [ ] **15.4.4** — UT：`dialect-stt-correct.test.ts`（prompt 含高频词 / parse 合法 / 非法回退 raw / changed 标志）
- [ ] **15.4.5** — UT：`transcribe-route.test.ts`（方言：有 Key+mock 成功→iflytek；失败→whisper；无 Key→whisper）
- [ ] **15.4.6** — 前端行为测试：方言不自动发送 / 非方言自动发送 / 纠错失败填入 raw
- [ ] **15.4.7** — 全量 639+ tests 绿 + `next build` 通过
- [ ] **15.4.8** — `docs/subsystems/dialect-cloud-tts-poc.md` 🆕：讯飞 ASR + 声音复刻 POC 记录模板（Key 获取 / 验证集 / 计费 / 连通性实测记录表）

### 15.5 — 降级项（更新版计划确认，标 backlog）

- [ ] **15.5.1** — 百度潮汕话 TTS（企业定制音库产品，联系商务确认 API 形态后评估）
- [ ] **15.5.2** — 闽南语替代潮汕话（仅"实在无潮汕话录音"时权宜，音系差异需实测）
- [ ] **15.5.3** — 客家话本地量化模型（讯飞方言 ASR 更优；4GB 机器不常驻额外模型）

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
- [ ] **2.2** Multi-turn task planning for worksheets
- [ ] **2.4** Capture/replay student reasoning chains

### Phase 6: Testing (partial)
- [x] **6.1.6** Engagement tests — 13 tests (streak, badges, summary, serialization)
- [x] **6.2.1–6.2.6** SM-2, ZPD, confidence, Elo, multi-lingual tests

### Quick Wins
- [x] Dark mode toggle (`DarkToggle` in TutorShell header)
- [x] Keyboard: Shift+Enter = newline, Enter = send
- [x] `test:ci` + `coverage` scripts in `package.json`

---

## 🔴 Phase 0: Full-Stack UI Implementation (6d)

> **Spec:** [subsystems/ui-architecture.md](subsystems/ui-architecture.md)  
> **Current state:** `VoiceControls` nested `flex-col`; Chinese camera labels; toolbar wraps on phone; no sidebar animation; no empty/loading/error states; no focus-visible rings.

### 🔴 0.8 Composer Layout Overhaul (2d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.8a | Flatten `VoiceControls` to inline fragment — remove `flex-col` wrapper | 0.5d | `VoiceControls.tsx` |
| 0.8b | Responsive toolbar labels per ui-architecture §4.2 | 0.5d | `Composer.tsx` |
| 0.8c | Phone layout: `Photo` label, voice popover (sheet), 44×44px targets, safe-area bottom padding | 0.5d | `Composer.tsx`, `VoiceControls.tsx`, `globals.css` |
| 0.8d | Tablet layout: `Snap homework`, hold-to-talk fine-pointer, compact voice select | 0.25d | `Composer.tsx`, `VoiceControls.tsx` |
| 0.8e | Desktop layout: full labels, inline voice `<select>`, hover states | 0.25d | `Composer.tsx`, `VoiceControls.tsx` |

### 🔴 0.9 English Chrome (1d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.9a | English voice labels in `TUTOR_VOICES` | 0.25d | `voices.ts` |
| 0.9b | English action labels: `Photo` / `Snap homework`, `Hold to talk` / `Mic`, `Speak on` / `Speak off`, `Send` / `Thinking…` | 0.25d | `Composer.tsx`, `VoiceControls.tsx` |
| 0.9c | Voice picker: English only per ui-architecture §4.2/§6 table | 0.25d | `VoiceControls.tsx` |
| 0.9d | `aria-label` and `title` attributes in English on all icons | 0.25d | `Composer.tsx`, `VoiceControls.tsx`, `TutorShell.tsx` |

### 🔴 0.10 Shell & Sidebar Polish (1d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.10a | Sidebar: `translateX` slide animation (250ms ease-out) | 0.25d | `HistorySidebar.tsx` |
| 0.10b | Sidebar: empty state ("No conversations yet"), delete confirmation | 0.25d | `HistorySidebar.tsx` |
| 0.10c | Header: hamburger ↔ X icon toggle; brand "✨ Spark" | 0.25d | `TutorShell.tsx` |
| 0.10d | Header: 48px fixed height on all devices | 0.25d | `TutorShell.tsx` |
| 0.10e | **Chat-first sidebar:** move SkillsPanel below chat list; collapsible strip (default closed, max 40% when open) | 0.5d | `HistorySidebar.tsx`, `SkillsPanel.tsx`, [ui-architecture §5.4–5.5](subsystems/ui-architecture.md) |

> **0.10e status (2026-08-04):** Implemented — SkillsPanel is a collapsed strip under the chat list; expand on tap.

### 🔴 0.11 Chat UX (1d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.11a | Chat bubbles: distinct left/right styling (agent = mist bg left, student = teal bg right) | 0.25d | `ChatThread.tsx`, `MarkdownMessage.tsx` |
| 0.11b | Auto-scroll to bottom + "↓ New messages" badge when scrolled up | 0.25d | `ChatThread.tsx` |
| 0.11c | Loading skeleton while agent is thinking (pulsing gray bubble) | 0.25d | `ChatThread.tsx`, `TutorShell.tsx` |
| 0.11d | Empty state: large centered "Ask anything about your homework…" with camera + mic hints | 0.25d | `ChatThread.tsx` |

### 🟡 0.12 States & Feedback (0.5d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.12a | Error banner: network/agent/TTS errors with coral accent | 0.25d | `TutorShell.tsx` |
| 0.12b | Voice states: speak icon pulses when TTS queued, solid when speaking, coral when error | 0.25d | `VoiceControls.tsx` |

### 🟡 0.13 Accessibility (0.5d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.13a | Focus-visible rings on all interactive elements (`focus-visible:ring-2 ring-[--teal]`) | 0.25d | All `.tsx` |
| 0.13b | Keyboard nav: Tab order (header → main → composer), Esc closes sidebar | 0.25d | `TutorShell.tsx`, `HistorySidebar.tsx` |

### 🟡 0.14 Device QA (0.5d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.14a | Phone QA: iPhone 14 (390×844) + Huawei (360×780) — toolbar 1 row, no Chinese, Send visible, keyboard-open safe-area | 0.25d | Manual |
| 0.14b | Tablet + Desktop QA: iPad (768/1024) + PC (1280) — `Snap homework` label, no stacked controls, full labels + inline voice, Enter sends | 0.25d | Manual |

---

## 🔴 Phase 6: Testing Gaps (10d)

| # | Task | Effort | Risk |
|---|------|--------|------|
| 6.1.1 | `cursor-agent.ts` unit tests — mock Cursor SDK, retry, cancellation | 2d | Core AI layer untested |
| 6.1.2 | `speech-player.ts` unit tests — mock Web Audio API, queue, abort, autoplay | 2d | TTS bugs break voice |
| 6.1.3 | `history-sync.ts` unit tests — sync conflicts, merge, corrupted data | 1d | Data loss risk |
| 6.1.4 | `chat/route.ts` unit tests — mock Agent, prompt assembly, error codes | 2d | Main endpoint untested |
| 6.1.5 | React component tests — `@testing-library/react`: TutorShell, Composer, MarkdownMessage, 375px layout | 3d | Zero UI coverage |

---

## 🟡 Phase 2: Agent & Prompt (6d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 2.2 | Multi-turn task planning — agent plans Q1→Q2→Q3 for worksheet photos | 3d | Agent |
| 2.4 | Capture/replay student reasoning — store L1.5 "why" answers as examples | 3d | `learning-memory.ts` |

---

## 🟡 Phase 3: Geometry & Visualization (13d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 3.1 | Interactive geometry: drag to measure angles/lengths on diagrams | 5d | `DiagramBlock.tsx`, SVG |
| 3.2 | Animated step-by-step geometry constructions | 3d | `geometry-svg.ts` |
| 3.3 | Desmos-like coordinate graphing for algebra | 5d | New component |

---

## 🟡 Phase 4: Voice & Multi-Modal (9d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 4.1 | Voice-only mode — full STT→agent→TTS loop, no screen needed | 5d | `speech-player.ts`, `Composer.tsx` |
| 4.2 | Natural number pronunciation — `x²` → "x squared" (EN) / "x 平方" (ZH) | 1d | `tts-text.ts` |
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

## 🔴 Phase 7: Code Agent Reliability (10h)

> **Design:** [code-agent-reliability-design.md](code-agent-reliability-design.md)  
> **Spec:** [subsystems/code-agent-robustness.md](subsystems/code-agent-robustness.md)  
> **Current state:** Service crashes due to: port conflicts, SDK unhandledRejection, stale agent sessions, file write races, SSE silent drops.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 7.1 | **Port pre-flight check in `start.sh`** — kill existing on 3000/3001/8765 before launch | 0.5h | `start.sh` |
| 7.2 | **Pin `@cursor/sdk` ≥ 1.0.19** + add `process.on('unhandledRejection')` safety net | 1h | `package.json`, `cursor-agent.ts` |
| 7.3 | **Stale session detection + retry** — on bare `run.wait()` status:error, clear → resume fresh once | 2h | `cursor-agent.ts` |
| 7.4 | **Agent retry wrapper** — `executeWithRetry()` with exponential backoff (1s→2s→4s) + jitter for `CursorAgentError(isRetryable)` | 2h | new `src/lib/agent-retry.ts`, `cursor-agent.ts` |
| 7.5 | **Agent run log (JSONL)** — record agentId, runId, status, durationMs per call | 1h | new `src/lib/run-log.ts` |
| 7.6 | **Atomic file writes** — `lockedWriteJson()` with tmp+rename for `history-store.ts` and `learning-memory-store.ts` | 2h | new `src/lib/file-lock.ts`, `history-store.ts`, `learning-memory-store.ts` |
| 7.7 | **SSE heartbeat + event IDs** — 15s heartbeat during streaming + `id:` field for reconnect recovery | 1.5h | `chat/route.ts`, `agent-chat/.../chat/route.ts` |

---

## 🔴 Phase 8: Code Agent Mini Window UI (10h)

> **Design:** [subsystems/code-agent-mini-window.md](subsystems/code-agent-mini-window.md)  
> **Current state:** "Code Agent" button opens iframe to port 3001 → blank when service down; cannot close; no vibe coding. Real `MiniConsoleShell` component is orphaned (never wired).

| # | Task | Effort | Files |
|---|------|--------|-------|
| 8.1 | **Wire `MiniConsoleShell` → replace `AgentConsolePanel`** — rename to `CodeAgentPanel`, import in `TutorShell.tsx`, remove iframe approach | 2h | `MiniConsoleShell.tsx` → `CodeAgentPanel.tsx`, `TutorShell.tsx` |
| 8.2 | **Fix slide animation** — change `animate-slide-in-left` → `animate-slide-in-right` for right-side panels; add keyframe to `globals.css` | 0.5h | `CodeAgentPanel.tsx`, `globals.css` |
| 8.3 | **Close button always visible** — X button rendered in header unconditionally; body scroll lock when panel open; mobile backdrop tap + swipe-down close | 1.5h | `CodeAgentPanel.tsx` |
| 8.4 | **Empty state with guided hints** — show example prompts: "Make text bigger", "Add dark mode color", "Fix photo on mobile" | 1h | `CodeAgentPanel.tsx`, `MiniConsoleThread.tsx` |
| 8.5 | **Loading skeleton + tool status** — pulsing dots while agent initializes; badges for "Reading…", "Editing…", "Testing…" | 1.5h | `CodeAgentPanel.tsx`, `MiniConsoleThread.tsx` |
| 8.6 | **Error states** — friendly messages for: service down (retry), agent timeout, network error, no API key | 1h | `CodeAgentPanel.tsx` |
| 8.7 | **Thread improvements** — increase message truncation 300→500 chars; show 5 messages not 3; auto-scroll to bottom | 1h | `MiniConsoleThread.tsx` |
| 8.8 | **Session resume** — load previous messages from server session store on open; "New session" button | 1h | `CodeAgentPanel.tsx`, `console-session-store.ts` |
| 8.9 | **ACC "Open in tab" as fallback** — if port 3001 is reachable, show secondary link; otherwise hide | 0.5h | `CodeAgentPanel.tsx` |

---

## 🔴 Phase 9: STT Service Reliability (4h)

> **Design:** [subsystems/stt-service-reliability.md](subsystems/stt-service-reliability.md)  
> **Current state:** STT server crashes in loop (EADDRINUSE 6x consecutive); no process supervision; task queue depth warnings.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 9.1 | **systemd unit for STT server** — `Restart=on-failure`, `RestartSec=5`, `MemoryMax=2G`, `StartLimitBurst=6` | 1h | `/etc/systemd/system/spark-stt.service` |
| 9.2 | **Pre-flight port check + SIGTERM handler in Python** — kill existing on 8765; graceful shutdown on SIGTERM/SIGINT | 1h | `scripts/stt_server.py`, `start.sh` |
| 9.3 | **Sequential model loading with error isolation** — load Whisper first, then SenseVoice; continue if one fails | 0.5h | `scripts/stt_server.py` |
| 9.4 | **Enhanced /health endpoint** — add memory RSS, queue depth, model status per engine | 0.5h | `scripts/stt_server.py` |
| 9.5 | **STT health check script** — `health-stt.sh` for monitoring + startup dependency | 0.5h | new `scripts/health-stt.sh`, `start.sh` |
| 9.6 | **Whisper CPU perf tuning** — `beam_size=1` (single beam ~40% faster on CPU) | 0.5h | `scripts/stt_server.py` |

---

## 🔴 Phase 10: Reliability Tests (14h)

> **Design:** [code-agent-test-design.md](code-agent-test-design.md)  
> **Current state:** 0% test coverage on agent reliability paths, file concurrency, SSE encoding.

### 10.1 Unit Tests (6h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 10.1a | Agent session recovery tests — stale detection, retry count, backoff timing, TTL eviction | 2h | new `src/lib/__tests__/cursor-agent-reliability.test.ts` |
| 10.1b | Atomic file write tests — concurrency safety, crash recovery, tmp cleanup | 1.5h | new `src/lib/__tests__/history-store-atomic.test.ts` |
| 10.1c | Agent run log tests — append, getLast, replay, error rate calculation | 1h | new `src/lib/__tests__/run-log.test.ts` |
| 10.1d | SSE encode tests — event+data format, id field, heartbeat, special chars | 1h | new `src/lib/__tests__/sse-encode.test.ts` |
| 10.1e | File lock tests — serialized writes, different-file concurrency | 0.5h | `src/lib/__tests__/history-store-atomic.test.ts` |

### 10.2 Integration Tests (5h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 10.2a | Agent session recovery integration — stale session retry, rate limit backoff | 1.5h | new `scripts/verify-agent-recovery.mjs` |
| 10.2b | SSE reliability integration — heartbeat timing, reconnect with Last-Event-ID, proxy headers | 1h | new `scripts/verify-sse-reliability.mjs` |
| 10.2c | File locking integration — concurrent history writes, concurrent learning memory, corrupt JSON skip | 1h | new `scripts/verify-file-locking.mjs` |
| 10.2d | STT reliability integration — health check, restart recovery, concurrent transcription | 1.5h | new `scripts/verify-stt-reliability.mjs` |

### 10.3 E2E + Chaos Tests (3h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 10.3a | Code agent mini window E2E — open, send prompt, verify SSE reply, check diff display, close window | 1.5h | new `scripts/verify-code-agent-e2e.mjs` |
| 10.3b | Graceful degradation E2E — stop STT, verify text chat still works; stop ACC, verify mini window error | 1h | new `scripts/verify-e2e-reliability.mjs` |
| 10.3c | Setup CI pipeline (GitHub Actions) — unit on push/PR, integration on self-hosted | 0.5h | `.github/workflows/reliability.yml` |

---

## 🟢 Nice-to-Have

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1.7 | Parent dashboard — skill radar chart, mastery timeline, heatmap | 5d | NOT visible to child |
| N1 | Export learning memory as printable PDF | 1d | For parent review |
| N2 | Inline skill tag on each message (agent-only) | 0.5d | Which skill was practiced |
| N3 | Tree-shake unused UI from production bundle | 0.5d | |
| N4 | Code agent: support `/fix`, `/explain`, `/add` slash commands | 1d | Quick vibe coding shortcuts |
| N5 | Code agent: "Undo last change" button in mini window | 0.5d | Uses git revert |
| N6 | Code agent: syntax-highlighted code blocks in thread | 1d | Prism.js or Shiki in MiniConsoleThread |

---

## 🔴 Phase 11: Code Agent v3 — Multi-Modal, Auto-Git, Service Resilience (22h)

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

## 🔴 Phase 12: Grade-Agnostic Adaptive Tutoring (29h)

> **Design:** [subsystems/grade-agnostic-adaptive.md](subsystems/grade-agnostic-adaptive.md)  
> **Goal:** Make Spark work for any student G1–G12. G4 is the baseline; system adapts up/down based on BKT mastery. No hardcoded Ryan/BASIS/G4 assumptions in core logic.  
> **Non-negotiable:** Zero regression for Ryan's current experience — every phase has a dedicated regression gate.

### 12A: Profile Abstraction (Phase A — 6h)

Make grade functional. Keep existing skill catalog; Ryan's profile becomes a saved account, not the system default.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 12A.1 | Add `gradeBand` to `StudentProfile` type: derive `"early"|"elementary"|"middle"|"high"` from numeric grade | 0.5h | `src/lib/student-profile.ts` |
| 🔴 12A.2 | Extract `RYAN_PROFILE` as a named export (preserve all G4/BASIS data); `DEFAULT_STUDENT_PROFILE` becomes grade-agnostic (`name: ""`, `grade: 4`, `school: ""`) | 1h | `src/lib/student-profile.ts` |
| 🔴 12A.3 | `createAccount()` accepts optional `Partial<StudentProfile>` — new accounts get bare defaults, not Ryan's data | 0.5h | `src/lib/student-profile.ts` |
| 🔴 12A.4 | `ensureRyan()` → `ensureDefaultAccount()` — backward-compatible: still creates Ryan profile if it's the only account | 0.5h | `src/lib/student-profile.ts` |
| 🔴 12A.5 | Add `curriculum` field to `StudentProfile` (`null` = auto-detect from grade); remove hardcoded `BASIS_G4_CURRICULUM` from prompt injection | 1h | `src/lib/student-profile.ts`, `src/lib/prompts.ts` |
| 🔴 12A.6 | `curriculumPromptLines(profile)` — generates grade-band-appropriate curriculum hints (e.g., G3-5 fractions denominator constraints, G6-8 rational numbers, G9-12 rational functions) | 1h | `src/lib/prompts.ts` |
| 🔴 12A.7 | BKT parameter selection by grade band: `bktDefaultsForBand(band)`. Per-band defaults per design doc table (early: pInit=0.30, elementary=0.25 baseline, middle=0.20, high=0.15) | 0.5h | `src/lib/bkt.ts` |
| 🔴 12A.8 | Regression test: run full prompt+profile test suite with `RYAN_PROFILE`, verify output identical to pre-change | 1h | `src/lib/student-profile.test.ts`, `src/lib/prompts.test.ts` |

### 12B: Age-Adaptive Prompt Language (Phase B — 5h)

Coach differently for a 6-year-old vs. a 16-year-old. Same hint ladder, different vocabulary.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🟡 12B.1 | Define `LanguagePreset` type: `{ confirm, encourage, stuck, error, thinkAloud }` strings per band | 0.5h | `src/lib/prompts.ts` |
| 🟡 12B.2 | Implement `languageForBand(band: GradeBand): LanguagePreset` — 4 presets per design doc table | 0.5h | `src/lib/prompts.ts` |
| 🟡 12B.3 | Inject `LanguagePreset` into `buildTutorPrompt()` via `studentProfilePromptLines()` — replace hardcoded `"(G4–G5 accessible)"` and `"BASIS-critical"` with band-adaptive versions | 1h | `src/lib/prompts.ts` |
| 🟡 12B.4 | `subjectCoachingLines()` band-aware: fractions in G4 are "food/pizza metaphors", G8 is "rational expressions", G11 is "limits & asymptotes" | 1h | `src/lib/prompts.ts` |
| 🟡 12B.5 | Remove all hardcoded `"Ryan"` from prompt templates; use `profile.name` dynamic substitution | 0.5h | `src/lib/prompts.ts`, `src/lib/learning-memory.ts`, `src/lib/tutor-harness.ts` |
| 🟡 12B.6 | Regression test: prompt output comparison with `RYAN_PROFILE` — confirm coaching style unchanged | 0.5h | `src/lib/prompts.test.ts` |

### 12C: Skill Catalog Expansion (Phase C — 9h)

Expand from 14 G4 skills to multi-band catalog aligned to BASIS K-12 course map (design doc §3.2 + §4.2).

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🟡 12C.1 | Extend `SkillDefinition` type with `minGrade`, `coreGrade`, `maxGrade`, `band`, `prerequisites`, `subject` fields | 0.5h | `src/lib/skill-catalog.ts` |
| 🟡 12C.2 | Expand elementary-band skills: add 6 G3 skills + align existing 14 G4-5 skills to BASIS G5 course map (Accelerated Math → Envision G6, English 5, General Science → experiments). Keep Ryan's current 14 skills with same IDs — additive only. | 2h | `src/lib/skill-catalog.ts` |
| 🟡 12C.3 | Add middle-band skills (~24) aligned to BASIS G6-8 three-science-concurrent model: **Math** (Prealgebra → Algebra I+Geometry → Algebra II+Geometry), **Science** (Bio 6/7/8 — cells/genetics/evolution, Chem 6/7/8 — atoms/reactions/stoichiometry, Physics 6/7/8 — motion/forces/energy), **Humanities** (English 6/7/8 lit analysis + World History I/II + US History), **Language** (Latin 6 + Chinese/French/Spanish 7). BKT must handle parallel science tracks — skills are concurrent within year, not sequential across sciences. | 2.5h | `src/lib/skill-catalog.ts` |
| 🟡 12C.4 | Add high-band skills (~28) aligned to BASIS Honors/AP/Capstone model: **Math** (Precalc → AP Calc AB → AP Calc BC → Capstone Math), **Science** (Honors Bio/Chem/Phys → AP Bio/Chem/Phys/EnvSci → Capstone Science), **Humanities** (AP English Lang/Lit, AP World/US History, AP Micro+Macro), **Language** (AP Chinese/Spanish/French/Latin). Include `capstone` sub-mode: for G12 skills, agent acts as research advisor (methodology coaching) not drill tutor. | 2.5h | `src/lib/skill-catalog.ts` |
| 🟡 12C.5 | `activeSkillsForProfile(profile)` — filter skill catalog by `minGrade ≤ profile.grade ≤ maxGrade`; for `coreGrade` near student grade, boost ZPD warm-up priority | 0.5h | `src/lib/skill-catalog.ts` |
| 🟡 12C.6 | Wire `activeSkillsForProfile` into BKT initialization + ZPD warm-up selection + skill prompts | 0.5h | `src/lib/learning-memory.ts`, `src/lib/prompts.ts` |
| 🟡 12C.7 | Regression test: `activeSkillsForProfile(RYAN_PROFILE)` returns exactly the current 14 G4 skills | 0.5h | `src/lib/skill-catalog.test.ts` 🆕 |

### 12D: Auto-Advance Mechanism (Phase D — 3h)

When mastery exceeds band ceiling, suggest upgrading to next grade band. Parent opt-in.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🟢 12D.1 | `autoAdvanceCheck(memory, profile)` — if all active-band skills have pKnown > 0.85, return `AdvanceSuggestion { suggestedBand, confidence, skillsReady }` | 1h | `src/lib/learning-memory.ts` |
| 🟢 12D.2 | Add `advanceSuggestion` field to `LearningMemory` type for persistence across sessions | 0.5h | `src/lib/learning-memory.ts` |
| 🟢 12D.3 | Prompt integration: when advance suggestion exists, include gentle note in system prompt ("You may be ready for more challenging material in some areas") | 0.5h | `src/lib/prompts.ts`, `src/lib/learning-memory.ts` |
| 🟢 12D.4 | Unit tests: (a) 100% mastery → advance suggestion, (b) mixed mastery → null, (c) already at "high" band → null | 0.5h | `src/lib/__tests__/auto-advance.test.ts` 🆕 |
| 🟢 12D.5 | Regression: Ryan's current BKT state should NOT trigger advance (existing data within G4 range) | 0.5h | `src/lib/__tests__/auto-advance.test.ts` |

### 12E: Multi-Account Grace (Phase E — 2h)

New students get grade-appropriate defaults, not Ryan's copy.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🟢 12E.1 | `AccountHome.tsx` — add grade selector (1–12 number input or dropdown) when creating a new account | 1h | `src/components/AccountHome.tsx` |
| 🟢 12E.2 | Remove `"Hi Ryan!"` and hardcoded `"Ryan"` labels from `ConsoleThread.tsx` — use active account profile name | 0.5h | `src/components/ConsoleThread.tsx`, `src/components/TutorShell.tsx` |
| 🟢 12E.3 | Test: create G8 account → verify skill pool = middle band, language style ≠ elementary | 0.5h | `src/lib/student-profile.test.ts` |

### 12F: BASIS Curriculum Alignment (Phase F — 3h)

Align prompt injection, textbook references, and course-aware scaffolding to BASIS K-12 specifics (design doc §3.2).

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🟡 12F.1 | `curriculumPromptLines()` — for BASIS profiles, inject grade-band-specific textbook refs: G5 → Envision Mathematics G6 (Savvas, ISBN 978-1-4188-4908-5), Algebra I → Envision A|G|A (ISBN 978-1-4188-5436-2), Algebra II → Envision A|G|A (ISBN 978-1-4188-5452-2), AP Calc → Larson/Stewart. Khan Academy as supplemental resource link. | 0.5h | `src/lib/prompts.ts`, `src/lib/curriculum.ts` 🆕 |
| 🟡 12F.2 | Parallel-science BKT wiring — when student is in middle/high band with 3 concurrent sciences, BKT tracks Bio, Chem, Phys independently (separate `pKnown` per science) but shares `activeSkillsForProfile` pool. | 1h | `src/lib/bkt.ts`, `src/lib/skill-catalog.ts`, `src/lib/learning-memory.ts` |
| 🟡 12F.3 | Capstone detection — if `gradeBand === "high" && grade === 12`, `curriculumPromptLines()` emits "Capstone advisor" role (research methodology, not drill). Suppress hint-ladder L0-L1; use Socratic L2-L3 only. | 0.5h | `src/lib/prompts.ts` |
| 🟡 12F.4 | World language skill sub-catalog — `LanguageSkillDefinition` extends `SkillDefinition` with `language: "zh"|"es"|"fr"|"la"`, proficiency tiers (beginner→intermediate→AP). Active only when student profile has a world language and grade ≥ 7 (BASIS world language start). | 0.5h | `src/lib/skill-catalog.ts` |
| 🟡 12F.5 | Regression test: with `RYAN_PROFILE`, `curriculumPromptLines()` output matches current `BASIS_G4_CURRICULUM` injection exactly. | 0.5h | `src/lib/prompts.test.ts` |

### 12G: Research-Aligned Safeguards (Phase G — 2h)

Implement the 5 design principles from academic research (design doc §13) as code-level safety rails.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🟡 12G.1 | **Separate policy from generation** — extract `gradePolicyForBand(band)` returning explicit rules (allowable scaffolding, forbidden shortcuts, minimum-effort gate) as typed constraints. Passed to `buildTutorPrompt()` as §boundary. | 0.5h | `src/lib/prompts.ts`, `src/lib/policy.ts` 🆕 |
| 🟡 12G.2 | **Centralized learner model write gate** — refactor `mergeLearningMemory()` to be the single write path. All BKT skill state changes flow through `mergeLearningMemory` → `lockedWriteJson`. Add `lastModifiedSkill` audit field. No other function may directly mutate `LearningMemory`. | 0.5h | `src/lib/learning-memory.ts` |
| 🟡 12G.3 | **Explicit pedagogical constraints** — `validateTutorResponse(response, profile)` checker: response must not solve the problem directly (hint ladder policy), must stay within band vocabulary, must reference correct subject. Called before SSE emits text. Non-blocking warning on violation — logs, does not censor (guard rail, not wall). | 0.5h | `src/lib/tutor-harness.ts`, `src/lib/policy.ts` |
| 🟡 12G.4 | **Structured curriculum DAG guard** — `prerequisiteChain(skill, depth)` — given a skill, returns its prereq chain up to `depth` levels. Used by ZPD warm-up to never suggest a skill whose prereq `pKnown < 0.60`. (GraphMASAL-aligned.) | 0.25h | `src/lib/skill-catalog.ts` |
| 🟡 12G.5 | Unit test: `prerequisiteChain("algebra_1", 3)` → array of prereq skill IDs ending with `fraction_fluency`. Verify chain length and ordering. | 0.25h | `src/lib/skill-catalog.test.ts` |

---

## 🔴 Phase 13: Multi-Tenant Account Isolation (18h)

Design: **[subsystems/multi-tenant-isolation.md](subsystems/multi-tenant-isolation.md)** v0.1

True per-account data partitioning. Today only profile metadata (name, grade) is per-account; learning memory, chat history, engagement, and voice preferences are shared globally. After Phase 13, switching accounts completely swaps the student's experience.

**Default = Ryan remains unchanged.** Non-Ryan accounts start fresh with grade-appropriate defaults.

### 13A: Storage Abstraction Layer (Phase A — 4h)

Create `TenantStorage` wrapper. Convert all data modules to per-account signatures. Zero behavioral change — data still lives at flat keys under the hood.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 13A.1 | Create `src/lib/tenant-storage.ts` — `nsKey(accountId, module)`, `TenantStorage` class with `get/set/remove/clear(accountId)`, shared key bypass list | 1h | `src/lib/tenant-storage.ts` 🆕 |
| 🔴 13A.2 | Update `learning-memory.ts` — `loadLearningMemory(accountId?)`, `saveLearningMemory(accountId?, mem)`. Default param `= RYAN_ACCOUNT_ID` for backward compat. All imports updated. | 1h | `src/lib/learning-memory.ts`, all callers |
| 🔴 13A.3 | Update `storage.ts` — `loadConversations(accountId?)`, `saveConversations(accountId?, store)`. LocalStorage key → `nsKey(accountId, "sessions")`. | 1h | `src/lib/storage.ts`, all callers |
| 🔴 13A.4 | Update `engagement.ts` — `loadEngagement(accountId?)`, `saveEngagement(accountId?, state)`. Key → `nsKey(accountId, "engagement")`. | 0.5h | `src/lib/engagement.ts`, all callers |
| 🔴 13A.5 | Update `voices.ts` — TTS voice preference per account. | 0.5h | `src/lib/voices.ts` |
| 🔴 13A.6 | Regression test: all 37 test files pass. Ryan's data still loads (default accountId param = RYAN_ACCOUNT_ID). | included | All test files |

### 13B: Flat → Namespaced Migration (Phase B — 3h)

One-time migration that moves existing global data into per-account namespaced keys. Flat keys preserved as safety net (never deleted).

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 13B.1 | `migrateAccountData(accountId)` — read flat keys → write `nsKey(accountId, module)` → set `spark.migration.completed` flag under account scope | 1h | `src/lib/tenant-storage.ts` |
| 🔴 13B.2 | `loadLearningMemory(accountId)` — check namespaced key first; if missing, fall back to flat key + auto-migrate | 0.5h | `src/lib/learning-memory.ts` |
| 🔴 13B.3 | Same fallback + auto-migrate pattern for sessions, engagement, voice | 0.5h | `src/lib/storage.ts`, `engagement.ts`, `voices.ts` |
| 🔴 13B.4 | Migration unit test: create flat key → load with accountId → namespaced key exists → flat key still intact (not deleted) | 0.5h | `src/lib/__tests__/tenant-storage.test.ts` 🆕 |
| 🔴 13B.5 | Round-trip test: write namespaced → reload → read back → data matches | 0.5h | `src/lib/__tests__/tenant-storage.test.ts` |

### 13C: Server-Side Multi-Tenant API (Phase C — 3h)

API routes scope data by `accountId`. Backward compatible: requests without `accountId` default to `"default"` (preserves existing server data).

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 13C.1 | `/api/learning` — accept `?accountId=` query param on GET; `{ accountId, memory }` body on PUT. File paths: `data/learning/{accountId}.json`. Default: `"default"` maps to existing `data/learning/latest.json`. | 1h | `src/app/api/learning/route.ts` |
| 🔴 13C.2 | `/api/history` — accept `?accountId=` query param on GET/PUT/DELETE. File paths: `data/history/{accountId}/sessions.json`. Default: `"default"` maps to existing `data/history/sessions.json`. | 1h | `src/app/api/history/route.ts` |
| 🔴 13C.3 | Server sync hooks — `hydrateLearningMemoryFromServer(accountId)`, `pushStoreToServer(accountId, store)` | 0.5h | `src/lib/learning-memory.ts`, `src/lib/history-sync.ts` |
| 🔴 13C.4 | Backward compat test: GET `/api/learning` (no accountId) → returns existing Ryan data from `latest.json` | 0.5h | Manual verification or `scripts/verify-multi-tenant.mjs` |

### 13D: Account Switcher UI (Phase D — 4h)

Header dropdown for switching accounts + enhanced account creation form.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 13D.1 | `AccountSwitcher.tsx` — header dropdown showing current account avatar + name. Tap to open popover with all accounts. Switch triggers full data reload for target accountId. | 1.5h | `src/components/AccountSwitcher.tsx` 🆕, `TutorShell.tsx` |
| 🔴 13D.2 | Enhance `AccountHome.tsx` — add school text field and subject checkboxes (Math, Science, Reading, Writing, General) to account creation form. Grade selector already exists. | 1h | `src/components/AccountHome.tsx` |
| 🔴 13D.3 | `AccountAvatar.tsx` — colored circle with initial letter (e.g., "R" in teal, "E" in coral, etc.). Use account ID hash to pick color deterministically. | 0.5h | `src/components/AccountAvatar.tsx` 🆕 |
| 🔴 13D.4 | Wire account switch in `TutorShell.tsx` — on switch: (1) save current account state via all data hooks, (2) set `activeId` in AccountsStore, (3) reload all data hooks for new accountId, (4) reset chat thread to empty session. Show toast: "Switched to {name} (G{grade})". | 1h | `src/components/TutorShell.tsx` |

### 13E: Privacy & Polish (Phase E — 2h)

Account deletion with safeguards, per-account empty states, account limit enforcement.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 13E.1 | Account deletion — two-step confirmation: (1) "Delete {name}'s account?" (2) "All chat history, learning progress, and photos will be permanently removed." → PIN gate → clear all namespaced keys for that accountId + remove from accounts list. Ryan account cannot be deleted (only reset to profile defaults). | 1h | `src/components/AccountHome.tsx`, `src/components/PinGate.tsx` |
| 🟡 13E.2 | Per-account empty state messaging — grade-band-appropriate first-launch text (design doc §5.4). `ChatThread.tsx` reads active account gradeBand and shows matching welcome message. | 0.5h | `src/components/ChatThread.tsx`, `src/components/TutorShell.tsx` |
| 🟡 13E.3 | Account limit enforcement — max 6 accounts. Show friendly message: "You have 6 accounts — that's the limit for this device. Remove one to add another." | 0.5h | `src/components/AccountHome.tsx` |

### 13F: End-to-End Validation (Phase F — 2h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 13F.1 | E2E test script: (a) create G8 account "Emma" → (b) send a message → (c) verify Emma's chat appears in her namespaced keys → (d) verify Ryan's namespaced keys are unchanged → (e) switch to Ryan → (f) verify Ryan's chat is still his own | 1h | `scripts/verify-multi-tenant.mjs` 🆕 |
| 🔴 13F.2 | Unit test: `TenantStorage` isolation — write key for acct_X → write same key for acct_Y → read back acct_X → data unchanged. Shared keys writable without prefix. | 0.5h | `src/lib/__tests__/tenant-storage.test.ts` |
| 🔴 13F.3 | Full regression: Ryan's experience unchanged — all 437 tests pass, chat loads normally, learning memory intact, engagement state preserved | 0.5h | Run `npm test` |

---

## 🔴 Phase 14: Image Lightbox — Top Layer + Zoom (6h)

> **Design:** [subsystems/image-lightbox-zoom.md](subsystems/image-lightbox-zoom.md)  
> **Bug:** Opening a large homework photo in chat is occluded by the left History sidebar (stacking-context trap: lightbox `z-[80]` lives under main column `z-10`, while desktop sidebar is `z-20`).  
> **Goal:** Portal lightbox to `document.body` at `z-[200]`; add zoom in / zoom out (buttons + keyboard); pan when zoomed; tests required.

### 14A: Stacking Fix + Zoom UI (4h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 14A.1 | Extract pure zoom helpers: `ZOOM_MIN/MAX/STEP`, `clampZoom`, `zoomIn`, `zoomOut`, `formatZoomPercent` | 0.5h | `src/lib/lightbox-zoom.ts` 🆕 |
| 🔴 14A.2 | Portal `ImageLightbox` via `createPortal(..., document.body)`; mount-safe for SSR; set overlay to `z-[200]` with overlay-ladder comment | 1h | `src/components/ImageLightbox.tsx` |
| 🔴 14A.3 | Toolbar: Zoom out (−), Zoom in (+), percent label, Close; 44px touch targets; English `aria-label`s | 1h | `src/components/ImageLightbox.tsx` |
| 🔴 14A.4 | Apply CSS `transform: scale(zoom)`; pan (`offset`) when `zoom > 1`; backdrop-tap closes only if pointer movement &lt; ~5px | 1h | `src/components/ImageLightbox.tsx` |
| 🔴 14A.5 | Keyboard: `+`/`=` zoom in, `-` zoom out, `0` reset fit, `Esc` close (keep existing Esc) | 0.5h | `src/components/ImageLightbox.tsx` |

### 14B: Tests (1.5h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🔴 14B.1 | Unit tests for zoom helpers — clamp, step, percent formatting, min/max edges | 0.5h | `src/lib/lightbox-zoom.test.ts` 🆕 |
| 🔴 14B.2 | Component tests (`@testing-library/react`): portal attaches under `document.body`; overlay has top-layer z-index class; Zoom in/out update percent; Esc/Close call `onClose`; backdrop click at zoom 1 closes | 1h | `src/components/ImageLightbox.test.tsx` 🆕 |

### 14C: Manual QA + Polish (0.5h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 🟡 14C.1 | Manual QA: desktop sidebar open + large schedule photo (no occlusion); phone 390×844 toolbar usable; Code Agent open still covered by lightbox | 0.25h | Manual |
| 🟢 14C.2 | Optional: pinch-to-zoom on touch (nice-to-have; buttons ship in 14A) | 0.25h+ | `ImageLightbox.tsx` |

**Acceptance (gate before merge):**
1. Desktop sidebar does not cover any part of the opened photo.
2. Zoom in / out buttons work; percent label updates; Esc closes.
3. `npm test` green including new `lightbox-zoom` + `ImageLightbox` tests.

---

## 📊 Summary

| Phase | Priority | Sub-tasks | Est. |
|-------|----------|-----------|------|
| **Phase 0** Full UI | 🔴 Critical | 13 (0.8–0.14) | **6d** |
| **Phase 6** Testing gaps | 🔴 Critical | 5 (6.1.1–6.1.5) | **10d** |
| **Phase 7** Code Agent Reliability | 🔴 Critical | 7 (7.1–7.7) | **10h** |
| **Phase 8** Mini Window UI | 🔴 Critical | 9 (8.1–8.9) | **10h** |
| **Phase 9** STT Reliability | 🔴 Critical | 6 (9.1–9.6) | **4h** |
| **Phase 10** Reliability Tests | 🔴 Critical | 11 (10.1–10.3) | **14h** |
| **Phase 11** Code Agent v3 | 🔴 Critical | 24 (11A.1–11D.7) | **22h** |
| **Phase 12** Grade-Agnostic | 🔴 Critical | 36 (12A.1–12G.5) | **29h** |
| **Phase 13** Multi-Tenant | 🔴 Critical | 21 (13A.1–13F.3) | **18h** |
| **Phase 14** Image Lightbox + Zoom | 🔴 Critical | 8 (14A.1–14C.2) | **6h** |
| **Phase 2** Agent | 🟡 Important | 2 (2.2, 2.4) | **6d** |
| **Phase 3** Geometry | 🟡 Important | 3 | **13d** |
| **Phase 4** Voice | 🟡 Important | 3 | **9d** |
| **Phase 5** Platform | 🟢 Nice | 4 | **9d** |
| **Phase 6** Test add-ons | 🟢 Nice | 3 (6.2.5, 6.2.7, 6.3–6.4) | **7.5d** |
| **Nice-to-Have** | 🟢 Nice | 10 | **11d** |

**Total new critical work (Phases 7–14):** ~96 hours (~12 days)

**Updated critical path:** Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → **Phase 14 (Lightbox stacking + zoom, 6h)** → Phase 0 UI → Phase 6 tests

**Next immediate steps (Phase 14 — UX bug, can run ahead of Phase 13 if prioritized):**
1. **14A.1** — Create `lightbox-zoom.ts` helpers (0.5h)
2. **14A.2** — Portal + `z-[200]` stacking fix (1h) — fixes sidebar occlusion
3. **14A.3–14A.5** — Zoom toolbar, pan, keyboard (2.5h)
4. **14B.1–14B.2** — Unit + component tests (1.5h) — merge gate
5. **14C.1** — Manual QA on desktop sidebar + phone

**Next immediate steps (Phase 13 — if continuing multi-tenant):**
1. **Phase 13A.1** — Create `TenantStorage` wrapper with `nsKey()` pattern (1h, foundation for all isolation)
2. **Phase 13A.2** — Update `learning-memory.ts` to accept `accountId` param (1h, per-account BKT)
3. **Phase 13A.3** — Update `storage.ts` to accept `accountId` param (1h, per-account chat history)
4. **Phase 13A.6** — Full regression: all 437 tests pass with new signatures (gate)
