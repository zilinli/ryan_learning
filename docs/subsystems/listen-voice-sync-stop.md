# Listen voice sync + Stop reliability

> **Subsystem** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **in progress** · 2026-08-10  
> Related: [voice-tts-stt.md](voice-tts-stt.md) · [bailian-stt-tts.md](bailian-stt-tts.md) · [multi-tenant-isolation.md](multi-tenant-isolation.md)

---

## Problem

1. **Listen 语言不同步** — 账号 `acct_ching` 选了闽南话，点 Listen 却播粤语。
2. **Stop 无效** — 播放中点 Stop，音频不停或按钮状态错乱。

## Root causes

| ID | Cause |
|----|--------|
| RC1 | `VoiceControls` 调用 `loadVoiceId()` / `saveVoiceId()` **无 accountId**，默认写入 `acct_ryan`。挂载时用 Ryan 偏好覆盖当前账号（常为 Auto → 中文走粤语）。 |
| RC2 | 闽南话 `/api/tts` 在无密钥或百炼失败时 **静默 edge 粤语兜底**（`zh-HK-WanLungNeural`），与「禁止粤语顶替」设计冲突。 |
| RC3 | `NeuralSpeechEngine.stop()` 只 `pause` + `revokeObjectURL`，不清 `audio.src`；进行中的 `/api/tts` fetch 无 AbortController。 |

## Approach

1. **按账号读写语音偏好** — `TutorShell` → `Composer` → `VoiceControls` 传入 `accountId`；load/save 一律带该 id；切换账号时重载。
2. **闽南话禁粤语兜底** — `ttsProviderForLang("teo")` 无密钥时抛 `DialectTtsUnavailableError`；`synthesizeDialect` 百炼失败时上抛 503，不调用 edge 粤语。
3. **可靠 Stop** — `stop()`：`pause` → 清空 `src` → `load()` → revoke；用 generation 绑定的 `AbortController` 取消 in-flight TTS。

## Key files

| File | Change |
|------|--------|
| `src/components/VoiceControls.tsx` | `accountId` prop；scoped load/save |
| `src/components/Composer.tsx` | 透传 `accountId` |
| `src/components/TutorShell.tsx` | 传 `accountId` |
| `src/lib/tts-provider.ts` | teo 无 key → throw，不 edge |
| `src/app/api/tts/route.ts` | 去掉 teo 粤语 silent fallback |
| `src/lib/speech-player.ts` | abort + clear src on stop |
| `src/lib/tts-provider.test.ts` | 更新 teo 无 key 期望 |
| `src/lib/speech-player` / voices tests | Stop + account-scope regressions |

## Risks

- 无百炼密钥时闽南话 Listen 会失败并提示，而非「错成粤语」——可接受（诚实失败）。
- 旧会话若只把音色写在 Ryan flat key，非 Ryan 账号需重新选一次语音。
- 百炼默认超时曾为 **15s**：长文 Listen（~200+ 字）会超时 503 → 无声。已改为 `ALIYUN_CLONE_TTS_TIMEOUT_MS=90s`，方言分片 ≤120 字。

## Test design

| ID | Layer | Case |
|----|-------|------|
| LVS-1 | unit | `ttsProviderForLang("teo")` 无 key → throw / 非 edge |
| LVS-2 | unit | teo 有 key → aliyun-clone / minnan-system（不变） |
| LVS-3 | unit | `saveVoiceId(id, acct_a)` 不影响 `loadVoiceId(acct_b)` |
| LVS-4 | unit | `NeuralSpeechEngine.stop()` 递增 generation 且清空 queue（可测逻辑） |
| LVS-5 | unit | `ALIYUN_CLONE_TTS_TIMEOUT_MS` ≥ 60s；长文分片 ≤120 |
| LVS-6 | manual | `acct_ching` 选闽南话 → Listen 有声（或明确 503 提示），绝非粤语；Stop 立刻静音 |
