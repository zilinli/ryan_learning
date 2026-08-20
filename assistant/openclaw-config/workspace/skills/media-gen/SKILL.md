---
name: media-gen
description: "多模态生成：百炼万相文生图；deAPI 文生曲请改用 music-gen skill。当用户要'画一张图/生成图片/配图/做海报图'时使用本技能；要'生成歌曲/BGM/战歌'时用 music-gen。"
---

# Media Gen（多模态生成）

用自备百炼 Key 生成图片（万相文生图），零额外订阅成本；语音为可选增强。

## 图片生成（通义万相，已验证可用）

API 为异步任务：提交 → 轮询 task → 拿图。

```bash
# 1) 提交任务
TASK=$(curl -sk -m 30 -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "wanx2.1-t2i-turbo",
    "input": {"prompt": "<详细画面描述，中文> + 风格（插画/写实/国风…）"},
    "parameters": {"size": "1024*1024", "n": 1}
  }' | python3 -c "import json,sys; print(json.load(sys.stdin).get('output',{}).get('task_id',''))")

# 2) 轮询结果（间隔 ~10s，最多 60s）
for i in $(seq 1 6); do
  sleep 10
  STATUS=$(curl -sk -m 30 -X GET "https://dashscope.aliyuncs.com/api/v1/tasks/$TASK" \
    -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('output',{}).get('task_status',''))")
  echo "status=$STATUS"
  [ "$STATUS" = "SUCCEEDED" ] && break
  [ "$STATUS" = "FAILED" ] && break
done

# 3) 取图并下载到任务目录
IMG_URL=$(curl -sk -m 30 -X GET "https://dashscope.aliyuncs.com/api/v1/tasks/$TASK" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); rs=d.get('output',{}).get('results',[]); print(rs[0].get('url','') if rs else '')")
curl -sk -m 60 -o "$TASK_DIR/图片.png" "$IMG_URL"
```

- 环境变量：`DASHSCOPE_API_KEY`（在 `~/.openclaw/.env`）。
- 提示词要具体：主体 + 场景 + 风格 + 光线/构图；负面描述尽量少用。
- 尺寸可选 `1024*1024` / `720*1280` / `1280*720`。
- 图生成后放入 `task-deliver` 任务目录，把 PNG 路径列入交付物清单。

## 语音（TTS，可选）

- **ElevenLabs `sag`**：若已安装（`which sag`），按 `AGENTS.md` 的语音讲故事的用法使用。
- **百炼 CosyVoice**：REST 端点为 `https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/speech-synthesis`（model `cosyvoice-v2`），**注意**：该端点在本机实测返回 url error，需按百炼官方文档核对最新路径（可能改用 `multimodal-generation/generation`）。未验证前不要承诺语音交付。
- TTS 生成的音频文件放任务目录，`.mp3`，列进交付物。

## 规则

- 所有 curl 加 `-k`（本机证书问题）与 `-m` 超时。
- 图生失败（FAILED 或被拒）如实告知，不编造"已生成"。
- 生成内容遵守平台合规：不生成名人/涉政/侵权画面。
- 完成后按 `task-deliver` 清单回传 PNG/音频路径。

## 兜底

- 若万相任务一直 PENDING 超过 2 分钟，中止并告知用户稍后再试。
- 用户要的图片量大时（>3 张），逐个生成并分别交付，避免一次性卡住。
