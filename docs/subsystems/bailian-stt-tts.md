# 百炼统一语音（STT + TTS）

> 2026-08-09 · 控费：讯飞方言 ASR 降为可选备份  
> 客家话 **朗读** 本周仍用 FormoSpeech（不动）

## 决策表

### STT（`/api/transcribe`）

| 优先级 | 引擎 | 条件 |
|--------|------|------|
| ① | **百炼 Fun-ASR-Flash**（`fun-asr-flash-2026-06-15`） | `ALIYUN_DASHSCOPE_API_KEY`；失败降级 `qwen3-asr-flash` |
| ② | 讯飞方言识别 | **仅** `STT_BACKUP_IFYTEK=1` 且 teo/hak |
| ③ | 本地 Whisper / SenseVoice | `:8765` |

返回 JSON 含 `engine`: `bailian` \| `iflytek` \| `local`。

Fun-ASR 覆盖客家/闽南/粤等方言；短录音走 multimodal-generation + Base64 Data URI（无需公网 URL）。

### TTS（`/api/tts`）

| Lang | Provider |
|------|----------|
| **teo** | 百炼复刻 → `longanmin_v3`（闽南）→ 503（禁粤语） |
| **sha** | 百炼复刻 → 千问 TTS **`Jada`（上海-阿珍）** → 503（禁粤语） |
| **hak** | FormoSpeech（缓存 / sidecar）；有 `HAK_CLONE_VOICE_ID` 时复刻 |
| **zh / yue / en / es / fr / ms** | **edge-tts** |

`X-TTS-Engine`: 方言为 `aliyun-*` / `qwen-shanghai` / `formospeech*`；其余为 `edge`。

## 环境变量

```bash
ALIYUN_DASHSCOPE_API_KEY=sk-xxx
# ALIYUN_ASR_MODEL=fun-asr-flash-2026-06-15
# ALIYUN_ASR_FALLBACK_MODEL=qwen3-asr-flash
# TEO_CLONE_VOICE_ID=...
# SHA_CLONE_VOICE_ID=...   # optional Shanghainese CosyVoice clone
# STT_BACKUP_IFYTEK=0
FORMOSPEECH_TTS_URL=http://127.0.0.1:9876
```

## 实现入口

- `src/lib/bailian-asr.ts` — ASR 客户端
- `src/app/api/transcribe/route.ts` — STT 路由
- `src/lib/tts-provider.ts` — 方言路由（teo 百炼 / hak FormoSpeech）
- `src/app/api/tts/route.ts` — zh/yue/en 等仍走 edge
- Dictionary / Translation：`MicTranscribeButton` + `sttLangFromDictLang`（识别同主页）；朗读经 `voiceIdFromDictLang` → 同主页 TTS

## 观测「不用讯飞」影响

看日志 / 用户反馈：

1. `engine=bailian` 占比与方言识别确认率（`/api/dialect-correct` 前后差异）
2. 空识别 / 422 率是否上升
3. 需要时再 `STT_BACKUP_IFYTEK=1` 对比一周
