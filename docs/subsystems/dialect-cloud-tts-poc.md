# 方言云端 STT/TTS POC 记录

> 对应 Phase 15 · `dialect-cloud-tts-stt-correct.md` · 计划源 `/root/dialect-stt-tts-gap-closure-plan.md`

## 目标

| 能力 | 厂商 | 验收标准 |
|------|------|----------|
| 方言 STT | 讯飞方言识别大模型 | `POST /api/transcribe` 方言模式返回 `engine: "iflytek"`，失败回退 Whisper |
| 方言 TTS | **百炼 CosyVoice**（对比后选用；讯飞 TTS 无潮汕/客家/闽南） | 潮汕：家人复刻优先，否则系统音色 `longanmin_v3`（闽南话）；客家：需复刻；**禁止普通话音色**；失败 → 本地 edge |

## TTS 选型对比（2026-08-08）

| 厂商 | 潮汕话 | 客家话 | 闽南话 | 结论 |
|------|--------|--------|--------|------|
| 讯飞在线 TTS | ❌ | ❌ | ❌（仅粤/川/湘等 11 种） | **不采用** |
| 百炼 CosyVoice | ❌ 预制；✅ 复刻 | ❌ 预制；✅ 复刻 | ✅ `longanmin_v3`（v3-flash） | **采用**；潮汕临时用闽南话系统音色，**不用普通话** |

实测：`cosyvoice-v3-flash` + `longanmin_v3` 对潮汕书面句可合成；`cosyvoice-v3-plus` + 同音色返回 418。

## 官方文档（接入依据）

- 非实时 TTS：https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide  
  - `POST …/api/v1/services/audio/tts/SpeechSynthesizer`  
  - `Authorization: Bearer <DASHSCOPE_API_KEY>`  
  - Body：`model` + `input.text` / `voice` / `format` / `sample_rate`；非流式返回 JSON，`output.audio.url` 下载音频  
- 声音复刻 HTTP：https://help.aliyun.com/zh/model-studio/voice-clone-design-http-api  
  - `model: voice-enrollment`，`action: create_voice`  
  - `target_model` 必须与后续合成模型一致（本项目：`cosyvoice-v3-plus`）  
  - 返回 `voice_id`，状态含 `DEPLOYING` → 可用  

北京 Key 使用经典端点 `https://dashscope.aliyuncs.com`（新加坡 Key/端点不互通）。

## 环境变量（勿提交真实值）

```bash
IFYTEK_APP_ID=
IFYTEK_API_KEY=
IFYTEK_API_SECRET=
ALIYUN_DASHSCOPE_API_KEY=
ALIYUN_DASHSCOPE_REGION=cn-beijing
TEO_CLONE_VOICE_ID=   # create_voice 返回的 voice_id
HAK_CLONE_VOICE_ID=
```

## 已完成验证（2026-08-08）

### A. 百炼直连

1. 系统音色 `cosyvoice-v3-plus` / `longanyang` → HTTP 200，约 70KB mp3  
2. 官方样例音频 `create_voice`（prefix=`sparkteo`）→ 得到 `voice_id`，状态可用  
3. 用该 `voice_id` 合成 → HTTP 200，约 63KB，24 kHz mono mp3  

### B. Spark 集成路径

1. 临时写入 `TEO_CLONE_VOICE_ID` 后 `pm2 restart spark-tutor --update-env`  
2. `POST /api/tts` `{"text":"…","lang":"teo"}` → HTTP 200，~63KB（百炼路径）  
3. 同文案二次请求 → 磁盘缓存命中（~10–20ms）  
4. 未配置 `HAK_CLONE_VOICE_ID` 时 `lang=hak` → edge 兜底正常  

### C. 主页可验收项

| 操作 | 期望 |
|------|------|
| 选潮汕话 / 客家话音色 | 一次性提示：讯飞 STT + 百炼复刻 TTS（未配置则本地兜底）；识别不自动发送 |
| 按住说话（方言） | 转写填入输入框，可编辑后发送；服务端优先讯飞 |
| Speak 朗读（已配置 `TEO_CLONE_VOICE_ID`） | 走百炼复刻音色；失败则 edge |
| Speak 朗读（未配置复刻 ID） | 本地 edge，不阻塞 |

## 客家话公开资源落地（2026-08-08）

网上可找到的客家话 TTS 相关资源（大厂预制仍无）：

| 资源 | 说明 | 本项目用法 |
|------|------|------------|
| HF `hungshinlee/hakkaradio_sixian` | 台湾四县腔广播公开 wav | ✅ 已用于百炼 `create_voice` → `HAK_CLONE_VOICE_ID` |
| [VoxHakka](https://voxhakka.github.io/) / `formospeech/yourtts-htia-240704` | 台湾客家多腔调 YourTTS | 备选本机模型（需 G2P；偏台湾腔） |
| `facebook/mms-tts-hak` | Meta MMS 客家 VITS（~36M，CC-BY-NC） | 备选本机；需拉丁/客语文本前端 |
| 乡音阁 | 页面宣传客家话 API，博文仍写「即将上线」 | 暂不接入 |

**试错结论：** 公开四县腔广播样音 → 百炼复刻后听感更差（音色像广播腔、字音仍不稳），**已撤下** `HAK_CLONE_VOICE_ID`。客家话在无家人录音前保持本地 edge 兜底；不要再用随机网络样音当复刻源。

## 家人真人口音（待办 · 15.2.6）

潮汕话仍建议录家人音频替换；客家话可用公开样音过渡，有家人录音后替换 `HAK_CLONE_VOICE_ID`。

上线/替换家庭音色步骤：

1. 录家人说方言清晰音频（建议 ≥10s，mp3/wav，公网可访问 URL 或 OSS）  
2. `create_voice`：`target_model=cosyvoice-v3-plus`，`prefix` ≤10 字母数字  
3. 将返回的 `voice_id` 写入 `TEO_CLONE_VOICE_ID` / `HAK_CLONE_VOICE_ID`  
4. `pm2 restart spark-tutor --update-env`  
5. 主页选对应方言音色，点 Speak 试听  

## 回滚

- 删掉 `TEO_CLONE_VOICE_ID` / `HAK_CLONE_VOICE_ID` 或 `ALIYUN_DASHSCOPE_API_KEY` → TTS 自动 edge  
- 删掉讯飞三元组 → STT 自动 Whisper  
