# 方言 STT/TTS 差距专项弥合 — 设计方案与可行性分析（v2）

> 面向 `ryan_learning` (Spark AI Tutor) · 对应 `/root/dialect-stt-tts-gap-closure-plan.md`（2026-08-08 更新版）
> 目标环境：搬瓦工 80G KVM PROMO（无 GPU，CPU/内存有限，磁盘 80GB）
> 版本：v2.0 · 2026-08-08

---

## 0. 结论先行（对照更新版调研文档）

更新版计划文档找到了比"预制方言音色"更可靠的路径，结论随之更新：

| 建议 | 调研结论 | 本设计是否落地 |
| --- | --- | --- |
| **STT**：讯飞方言识别大模型（202 种方言全覆盖，明确含潮汕话/客家话） | ✅ 最可信选项 — 纯网络 WebSocket API，本机零算力 | ✅ 落地 `iflytek-asr.ts` + `/api/transcribe` 方言模式优先走讯飞，**无 Key / 失败自动 fallback 本地 Whisper** |
| **TTS**：阿里云百炼「声音复刻」+ CosyVoice/Qwen-Audio-TTS（声音克隆） | ✅ 强烈推荐 — ≥3s 音频即可克隆家人音色，跨语言/跨方言，**对潮汕话/客家话通用**，新加坡地域端点对海外服务器友好 | ✅ 落地 `tts-provider.ts` 声音复刻 provider，**无 Key / 未配置复刻音色自动降级回粤语 edge-tts** |
| TTS 备选：CosyVoice 系统方言音色（18 种） | 🟡 需在百炼控制台核对当前列表（更新快） | 作为配置可切换的备选音色 |
| 百度潮汕话 TTS | ⚠️ 更偏向企业定制音库产品，非开箱即用 REST | 降级为 backlog，不优先接入 |
| 闽南语替代潮汕话 | ⚠️ 云端 API 无明显优势 | 不采纳，作为"实在无潮汕话录音时的权宜" |
| STT 兜底：通用识别 + LLM 纠错 | ✅ 讯飞自认客家话口语识别还不够好，兜底仍需要 | ✅ 保留 `dialect-stt-correct.ts` + 用户可编辑确认 |

**关键架构原则（贯穿全设计）：**
1. **任何云端/外部依赖都不能变成单点故障** — 讯飞 ASR 失败/超时/无 Key → 回退本地 Whisper；声音复刻 TTS 失败/超时/无 Key → 回退粤语 `zh-HK-WanLungNeural`。
2. **磁盘缓存硬上限 + LRU 清理** — 80GB 磁盘经不起无限增长的 mp3/音频缓存。
3. **方言转写结果必须用户可编辑确认后发送** — 不静默替换（计划 §2.2 + 更新版步骤 5 明确要求）。
4. **本机零常驻算力新增** — 讯飞与百炼均为网络调用；不用本地方言模型。

---

## 1. 现状核对（已完成代码走查）

### 1.1 TTS 调用链（现状）

```
前端 speech-player.ts fetchTts()
  → POST /api/tts { text, voice }            (src/app/api/tts/route.ts)
    → ALLOWED_VOICES 白名单校验
    → POST http://127.0.0.1:8765/tts          (scripts/stt_server.py)
      → edge-tts 合成，voice=zh-HK-WanLungNeural for teo/hak
```

- `voices.ts` 中 `edgeVoiceForLang()` 把 `teo`/`hak` 都映射到 `zh-HK-WanLungNeural`。
- `speech-player.ts` `fetchTts()` 对 `teo`/`hak` 已先做 `normalizeForTTS()`（汝→你、涯→我 等字符替换）。

### 1.2 STT 调用链（现状）

```
前端 VoiceControls.transcribeBlob() → 16kHz WAV blob
  → POST /api/transcribe { audio, language }  (src/app/api/transcribe/route.ts)
    → normalizeTranscribeLang() 白名单 { auto en zh yue es fr teo hak }
    → POST http://127.0.0.1:8765/transcribe    (scripts/stt_server.py)
      → teo/hak 走 Whisper(zh) + initial_prompt 方言词偏置
```

- 前端 `stt-lang.ts` `sttLangFromVoice("teochew")→"teo"` 已生效。
- **现状缺口**：转写结果直接进输入框并**自动发送**（`Composer.onTranscript → submit()`），无方言纠错，也无"确认可编辑"步骤。

### 1.3 环境事实

- Node **v22.23.2** — 原生全局 `WebSocket` 可用（讯飞方言识别是 wss 协议，无需额外依赖）。
- 项目当前**没有**讯飞 / 阿里云 API Key（POC 阶段），因此所有云端 provider 必须在无 Key 时自动降级。
- 已有方言基础设施：`teochew-dict.ts` (503) / `hakka-dict.ts` (514)、`replyLanguageInstructions()` 收紧过的 prompt、`/api/dict/translate` 非流式 Agent 调用范例。

---

## 2. STT：讯飞方言识别大模型（更新版计划 §1，最高优先级）

### 2.1 接口事实（已查证讯飞官方文档）

- **协议**：WebSocket — `wss://iat.cn-huabei-1.xf-yun.com/v1`（方言识别地址）。
- **鉴权**：HMAC-SHA256，四步签名（拼接 `signature_origin` → `hmac-sha256(signature_origin, apiSecret)` → base64 → 组 `authorization_origin` → base64）。需要 `APIKey` + `APISecret`。
- **请求参数**：`domain: "slm"`（方言大模型）、`language: "zh_cn"`、`accent: "mulacc"`（202 种方言自动判别）、`result: { encoding: "utf8", compress: "raw", format: "json" }`。
- **音频**：16k/8k、16bit、单声道；`audio.encoding` 支持 `raw`（pcm）/ `lame`（mp3）；最长 60s。
- **响应**：流式 JSON（`{"header":{...},"payload":{...}}`），最终 `status:2` 结束帧拼出完整文本。

### 2.2 架构改动

**新增 `src/lib/iflytek-asr.ts`**（纯客户端，可单测）：

```ts
export type IflytekConfig = { apiKey: string; apiSecret: string };

// 纯函数：生成 WebSocket 连接 URL（含鉴权 query）
export function buildIflytekWsUrl(config: IflytekConfig, date?: Date): string
// 纯函数：WAV(16k/16bit/mono) → 16k PCM（剥 44 字节头）
export function wavToRawPcm(buffer: Uint8Array): Uint8Array
// 纯函数：解析讯飞流式 JSON 帧 → 文本
export function appendIflytekFrame(acc: string, frameJson: string): string

// 真实调用：wss 连接 + 分帧发送 + 收尾帧（Node ≥22 原生 WebSocket）
export async function transcribeWithIflytek(
  config: IflytekConfig,
  wavBuffer: Uint8Array,
  opts?: { timeoutMs?: number },
): Promise<{ text: string }>
```

- 鉴权 URL 生成是**纯函数**（注入 date 可测确定性）。
- 无 `WebSocket` 全局（理论不适用于 Node 22+）或无 Key → 抛 `IflytekNotConfiguredError`，由上层 fallback。
- 30s 超时；错误一律抛出，由 `/api/transcribe` 统一 fallback 本地 Whisper。

### 2.3 `/api/transcribe/route.ts` 改造

```
POST /api/transcribe { audio, language }
1. 方言模式（teo/hak）：
   a. 若 IFYTEK_API_KEY / IFYTEK_API_SECRET 已配置：
      → wavToRawPcm → transcribeWithIflytek()
      → 成功且有文本 → 返回 { text, language, engine: "iflytek" }
      → 失败/超时/无文本 → console.warn + 落入 b
   b. fallback：现有本地 Whisper 路径（现状不变）
2. 非方言模式：现状路径（本地 Whisper / SenseVoice）
```

- 前端无需感知：`/api/transcribe` 返回结构不变（`{ text, language }`），额外透传 `engine` 便于排查。
- **POC 门槛（更新版计划 §1 明确）**：讯飞官方"全覆盖"≠"质量达到教学可用"。正式切换前必须用免费额度录 20~30 句儿童典型句式实测，准确率不达标时维持 Whisper + LLM 纠错兜底。`engine` 字段 + 日志就是为这个评估准备的。

---

## 3. TTS：阿里云百炼「声音复刻」+ CosyVoice（更新版计划 §2，首选）

### 3.1 接口事实（已查证阿里云官方文档）

- **声音复刻（创建音色）**：`POST https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/audio/tts/customization`（新加坡地域；北京为 `{WorkspaceId}.cn-beijing.maas.aliyuncs.com`），鉴权 `Authorization: Bearer $DASHSCOPE_API_KEY`。
  - Body：`{ "model": "voice-enrollment", "input": { "action": "create_voice", "target_model": "cosyvoice-v3-plus", "prefix": "teochew_grandma", "url": "https://.../sample.wav", "language_hints": ["zh"] } }`
  - 返回：`{ "output": { "voice_id": "cosyvoice-v3-plus-teochew_grandma-xxxx" } }`
- **语音合成（非实时 HTTP）**：`POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation`（或百炼专属域名），Body 中 `input.voice = voice_id`、`input.text = 方言文本`、`model = "cosyvoice-v3-plus"`（须与创建音色时 `target_model` 一致），返回音频（mp3）。
- **备注**：新加坡地域 `cosyvoice-v3-flash` 不支持复刻音色，需用 `cosyvoice-v3-plus` 或 `qwen-audio-3.0-tts-flash`。
- **合规**：声音复刻涉及真实人物声纹，必须获得录音者知情同意（计划 §2.1 ⚠️）。

### 3.2 架构改动

**新增 `src/lib/tts-provider.ts`**：

```ts
export type TtsProvider =
  | { kind: "edge"; voice: string }
  | { kind: "aliyun-clone"; voiceId: string; model: string }; // 声音复刻音色

export function ttsProviderForLang(lang: SpeechLang): TtsProvider {
  switch (lang) {
    case "teo":
    case "hak": {
      const voiceId = lang === "teo"
        ? process.env.TEO_CLONE_VOICE_ID     // 潮汕话复刻音色
        : process.env.HAK_CLONE_VOICE_ID;    // 客家话复刻音色
      if (process.env.ALIYUN_DASHSCOPE_API_KEY && voiceId) {
        return { kind: "aliyun-clone", voiceId, model: "cosyvoice-v3-plus" };
      }
      return { kind: "edge", voice: "zh-HK-WanLungNeural" }; // 无 Key 降级
    }
    default:
      return { kind: "edge", voice: edgeVoiceForLang(lang) };
  }
}
```

**阿里云调用实现**（`callAliyunCloneTts(text, voiceId, model)`）：
- `POST` 百炼合成端点，`Authorization: Bearer <ALIYUN_DASHSCOPE_API_KEY>`，6s 超时，返回 mp3 Buffer。
- 失败/超时抛错，由 `/api/tts` 上层统一 fallback。

### 3.3 `/api/tts/route.ts` 改造

```
POST /api/tts { text, voice, lang? }   // lang 可选，方言时传 "teo"|"hak"
1. lang 存在且为 teo/hak → ttsProviderForLang(lang)
2. provider = aliyun-clone：
   a. 查 data/tts-cache/<sha256(text+voiceId)> → 命中直接返回
   b. 未命中 → withTimeout(callAliyunCloneTts, 6s) → 成功写缓存返回
   c. 失败 → console.warn + fallback edge（zh-HK-WanLungNeural，现有 stt_server.py 路径）
3. provider = edge → 现状路径（白名单 + stt_server.py）
4. 任何异常 → 503（沿用现状文案）
```

### 3.4 磁盘缓存 `src/lib/tts-cache.ts`

- 目录：`data/tts-cache/`（`SPARK_DATA_DIR` 可注入）。
- Key：`sha256(text + "\0" + voice)`，后缀 `.mp3`。
- API：
  - `getCachedTts(text, voice): Promise<Buffer | null>`
  - `setCachedTts(text, voice, audio: Buffer): Promise<void>`（原子 tmp+rename）
  - `pruneTtsCache({ maxBytes, maxAgeMs }): Promise<{ freed: number; files: number }>` — 按 mtime 从旧到新删到上限以下；超 TTL 直接删。
- 默认：`TTS_CACHE_MAX_BYTES=3GB`、`TTS_CACHE_TTL_MS=48h`。
- `scripts/health-check.mjs` 新增 `tts-cache` 巡检（目录大小超上限 → 告警 + 触发 prune）。

---

## 4. STT 兜底：LLM 方言纠错（保留，更新版计划 §1 末段）

讯飞自认客家话口语识别质量还有限，因此**保留 LLM 纠错作为兜底**，与讯飞互补。

### 4.1 `src/lib/dialect-stt-correct.ts`

```ts
export type DialectSttCorrectResult = { corrected: string; changed: boolean; raw: string };

export function buildDialectCorrectionPrompt(raw: string, dialect: "teo" | "hak"): string
export function parseCorrectionResult(rawLlm: string, fallback: string): DialectSttCorrectResult
```

- Prompt：附词典高频词（`community-verified` 前 40 条），只纠同音/用词，禁止扩写、禁止改语义，输出严格 JSON `{"corrected","changed"}`。
- 解析失败回退 raw（不阻塞）。

### 4.2 `/api/dialect-correct/route.ts`

- 复用 `/api/dict/translate` 的 Agent 非流式模式；`{ text, dialect }`；失败返回 `{ corrected: raw, changed: false }`。
- `text.length ≤ 200` 防滥用。

### 4.3 前端方言确认流程（重要 UX 改动）

**现状**：`VoiceControls.onTranscript(text)` → `Composer` 直接 `setText + submit()`（自动发送）。

**目标**（计划要求 + 更新版步骤 5）：方言模式下**不自动发送**，纠错后填入输入框，**用户确认/编辑后再发送**。

改动点：
1. `Composer.tsx` 增加 `voiceId` 状态（从 `onVoiceIdChange` 同步），判断是否 `teochew`/`hakka`。
2. `VoiceControls.transcribeBlob()` 方言成功路径：调 `/api/dialect-correct` → `onTranscript(corrected)`；Composer 收到方言文本时**只 setText 不 submit**，并展示一行提示（"已识别，请确认后发送"）。
3. 纠错 API 失败 → 填入 raw 文本，同样不自动发送（保证"用户始终能编辑"）。
4. 非方言路径保持不变（现状自动发送）。

> 这是**行为变更**：方言模式下语音输入不再"即说即发"。与更新版计划 §4 步骤 5 的"用户可编辑确认"一致。

---

## 5. 未采纳 / 降级项（更新版计划明确）

| 项 | 结论 | 依据 |
| --- | --- | --- |
| 百度潮汕话 TTS | 降级 backlog | 更像企业定制音库/离线 SDK 产品，非按量计费 REST API |
| 闽南语替代潮汕话 | 不采纳 | 云端 API 无优势；仅作"实在无潮汕话录音"的权宜 |
| 客家话本地量化模型（旧版 §2.1） | 降级 backlog | 讯飞方言 ASR 更优；4GB 机器不额外常驻模型 |
| CosyVoice 系统方言音色（粤/川等 18 种） | 可配置备选 | 需在百炼控制台核对当前音色列表（更新快） |

---

## 6. 文件改动清单

| 文件 | 改动 | 优先级 |
| --- | --- | --- |
| `src/lib/iflytek-asr.ts` | **新增** — 讯飞方言 ASR：签名 URL 纯函数 + WAV→PCM + 帧解析 + wss 调用 | P1 |
| `src/app/api/transcribe/route.ts` | 方言模式优先讯飞，失败 fallback 本地 Whisper；返回 `engine` | P1 |
| `src/lib/tts-provider.ts` | **新增** — `TtsProvider` + `ttsProviderForLang()` + 阿里声音复刻调用 | P1 |
| `src/lib/tts-cache.ts` | **新增** — sha256 缓存 + 原子写 + LRU prune + 上限/TTL | P1 |
| `src/app/api/tts/route.ts` | 接入 provider + 缓存 + 6s 云端超时 fallback | P1 |
| `src/lib/dialect-stt-correct.ts` | **新增** — prompt 构建 + 结果解析（纯函数） | P1 |
| `src/app/api/dialect-correct/route.ts` | **新增** — Agent 纠错接口，失败回退 raw | P1 |
| `src/components/VoiceControls.tsx` | 方言转写后调 `/api/dialect-correct` | P1 |
| `src/components/Composer.tsx` | 方言模式 `onTranscript` 不自动发送，提示确认 | P1 |
| `.env.local.example` | 新增 `IFYTEK_API_KEY` / `IFYTEK_API_SECRET` / `ALIYUN_DASHSCOPE_API_KEY` / `ALIYUN_WORKSPACE_ID` / `TEO_CLONE_VOICE_ID` / `HAK_CLONE_VOICE_ID` / `TTS_CACHE_MAX_BYTES` | P1 |
| `scripts/health-check.mjs` | 新增 `tts-cache` 巡检项（超限告警 + prune） | P1 |
| `docs/subsystems/dialect-cloud-tts-poc.md` | **新增** — 讯飞 ASR + 声音复刻 POC 记录模板 | P1 |

---

## 7. 云端 API POC 记录（待真实账号后填写）

> 当前服务器没有讯飞 / 阿里云账号与 Key，以下为**接入前必须完成的验证项**（对应更新版计划 §3 落地优先级 1~3）。仓库不包含任何真实密钥。

| 项 | 讯飞方言识别 | 阿里云百炼声音复刻 |
| --- | --- | --- |
| 账号注册 | 讯飞开放平台 | 阿里云百炼（新加坡地域 Key 或北京 Key） |
| 免费额度 | 创建应用领取 | 新用户试用额度 |
| 鉴权材料 | APIKey + APISecret | DASHSCOPE_API_KEY + WorkspaceId |
| 验证集 | 20~30 句儿童潮汕话/客家话典型句式（复用 `docs/subsystems/dialect-eval-set.md`） | 家人 2~3 段 5~15s 方言录音（每段） |
| 关键指标 | 字错率（CER）是否达教学可用；单句延迟 | 复刻音色像不像；合成延迟；从搬瓦工访问新加坡地域连通性 |
| 达标才切换 | 是（否则维持 Whisper+纠错兜底） | 是（否则维持粤语 fallback） |

---

## 8. 测试计划

| 测试文件 | 覆盖点 |
| --- | --- |
| `iflytek-asr.test.ts` | `buildIflytekWsUrl` 签名 URL 含 authorization/date/host（固定 date 断言）；`wavToRawPcm` 剥头正确；`appendIflytekFrame` 累积文本/忽略中间帧/结束帧 |
| `tts-provider.test.ts` | `ttsProviderForLang()`：teo/hak 无 Key→edge，有 Key+voiceId→aliyun-clone；默认语言→edge；edge voice 正确 |
| `tts-cache.test.ts` | key 稳定；写/读往返；prune 超上限删最旧；TTL 过期删除；tmp 无残留（SPARK_DATA_DIR 隔离） |
| `dialect-stt-correct.test.ts` | prompt 含词典高频词；parse 合法 JSON；非法输出回退 raw；changed 标志正确 |
| `transcribe-route.test.ts` | 方言模式：有 Key+mock 成功→engine iflytek；mock 失败→fallback whisper；无 Key→whisper |
| `voices.test.ts`（更新） | `replyLanguageInstructions` 仍含禁止造字规则（回归） |
| 前端行为 | 方言 voice → 转写后不自动发送；非方言 → 自动发送；纠错失败 → 填入 raw |
| 全量回归 | 639+ tests 全绿；`next build` 通过 |

---

## 9. 验收标准（对齐更新版计划 §4 步骤 + 旧版 §3）

| 指标 | 目标 | 本设计如何满足 |
| --- | --- | --- |
| 方言 STT 走讯飞方言识别 | 有 Key 后优先；无 Key 维持 Whisper | `/api/transcribe` 方言分支 + engine 透传 + POC 门槛 |
| 方言 STT 100% 过纠错兜底 | 是 | `VoiceControls` 方言路径调 `/api/dialect-correct` |
| 方言 TTS 用家人真实声音 | 配置复刻音色后 | `ttsProviderForLang` + 声音复刻 provider；无 Key 自动粤语 |
| 云端失败自动降级 | 100% | try/catch + 超时 → 本地；纠错失败回退 raw |
| 用户可编辑确认后发送 | 是 | Composer 方言模式不自动发送 |
| 磁盘缓存硬上限 + 清理 | 是 | `pruneTtsCache` 默认 3GB/48h + health-check 巡检 |

---

## 10. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 无真实 Key，云端质量未验证 | 无 Key 自动降级；POC 记录表待填；`engine` 字段 + 日志支撑评估 |
| 讯飞客家话识别质量不足 | POC 门槛 + 保留 Whisper/LLM 纠错兜底 |
| 阿里声音复刻接口形态与假设不符 | provider 集中实现，改调用细节不影响上层 |
| 方言 LLM 纠错误改 | 只纠同音/禁扩写；结果可编辑；失败回退 raw |
| 方言转写不再自动发送（UX 变化） | 与计划要求一致；提示语引导；非方言路径不变 |
| 声音复刻合规（声纹同意） | 必须在录音前获得录音者知情同意 |
| 缓存撑爆磁盘 | 3GB 硬上限 + LRU + health-check 告警 |
