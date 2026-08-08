# 方言云端 STT/TTS POC 记录

> 对应 Phase 15 · `dialect-cloud-tts-stt-correct.md` · 计划源 `/root/dialect-stt-tts-gap-closure-plan.md`

## 目标

| 能力 | 厂商 | 验收标准 |
|------|------|----------|
| 方言 STT | 讯飞方言识别大模型 | `POST /api/transcribe` 方言模式返回 `engine: "iflytek"`，失败回退 Whisper |
| 方言 TTS | 阿里云百炼 CosyVoice 声音复刻 | 配置 `TEO_/HAK_CLONE_VOICE_ID` 后走 `SpeechSynthesizer`；未配置/失败 → 本地 edge（**不做粤语云 TTS**） |

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

## 家人真人口音（待办 · 15.2.6）

当前可用的测试 `voice_id` 来自**官方普通话样例**，仅用于打通链路，**不是**潮汕话/客家话真人音色。

上线家庭音色步骤：

1. 录家人说方言清晰音频（建议 ≥10s，mp3/wav，公网可访问 URL 或 OSS）  
2. `create_voice`：`target_model=cosyvoice-v3-plus`，`prefix` ≤10 字母数字  
3. 将返回的 `voice_id` 写入 `TEO_CLONE_VOICE_ID` / `HAK_CLONE_VOICE_ID`  
4. `pm2 restart spark-tutor --update-env`  
5. 主页选对应方言音色，点 Speak 试听  

## 回滚

- 删掉 `TEO_CLONE_VOICE_ID` / `HAK_CLONE_VOICE_ID` 或 `ALIYUN_DASHSCOPE_API_KEY` → TTS 自动 edge  
- 删掉讯飞三元组 → STT 自动 Whisper  
