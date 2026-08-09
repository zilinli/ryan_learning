# FormoSpeech 客家话 TTS（VoxHakka / yourtts-htia）设计

> 对应 Phase 15.2.7 · 2026-08-09  
> 模型：`formospeech/yourtts-htia-240704`（CC BY-NC 4.0，家庭/教育可用）  
> Space 参考：`united-link/taiwanese-hakka-tts` · 项目页：https://voxhakka.github.io/

## 可行性结论

| 项 | 结论 |
|----|------|
| 发音质量 | ✅ 客语语料微调 + `formog2p.hakka` 音素前端，优于大厂硬读汉字 |
| 本机常驻实时推理 | ⚠️ 模型约 970MB；4GB 机建议 PM2 常驻 `formospeech-tts`，并预留 swap |
| 离线预合成 → TTS 缓存 | ✅ **高频句主路径**：命中即毫秒返回 |
| Sidecar | ✅ 默认 `FORMOSPEECH_TTS_URL=http://127.0.0.1:9876`（`scripts/formospeech_server.py`） |
| 文本规范化 | ✅ 简体→繁体（OpenCC）+ `我→涯`；未知字拒绝合成（避免丢字怪声） |
| 粤语 edge 顶替 | ❌ **禁止**：潮汕话/客家话路径不再使用 `zh-HK-*` |

## 路由（`ttsProviderForLang` / `/api/tts`）

```
teo:
  家人 TEO_CLONE_VOICE_ID → 百炼复刻
  否则 → 百炼闽南话 longanmin_v3
  失败 → 503（不回退粤语）

hak:
  家人 HAK_CLONE_VOICE_ID → 百炼复刻
  否则 → FormoSpeech（voice=`formospeech-sixian`）
        ① normalizeHakkaForTts（简→繁 + 我→涯）
        ② 磁盘缓存命中 → X-TTS-Engine: formospeech-cache
        ③ FORMOSPEECH_TTS_URL sidecar（默认 127.0.0.1:9876）
  失败 → 503（不回退粤语）
```

缓存 key：`sha256(normalizedText + "\0" + voice).mp3`，voice 固定 `formospeech-sixian`。  
默认语者：`江芮敏`（女 / 苗栗四縣）；码率 128k mp3。

## Sidecar（PM2）

```bash
# 依赖：.venv-formospeech（Python 3.11 + formog2p + CPU torch）
pm2 start scripts/formospeech_server.py --name formospeech-tts \
  --interpreter /root/codes/ryan_learning/.venv-formospeech/bin/python
# .env.local
FORMOSPEECH_TTS_URL=http://127.0.0.1:9876
```

## 离线预合成

```bash
# 建议：停 Spark 后执行，避免与生产抢内存；--force 覆盖旧（低质量）缓存
.venv-formospeech/bin/python scripts/formospeech_presynth.py \
  --phrases scripts/formospeech_phrases_hak.json \
  --out-data-dir data --force
```

依赖：`vendor/taiwanese-hakka-tts`（HF Space）+ Python 3.11 venv（`formog2p` 要求 ≥3.10）。

## 腔调说明

当前默认四縣腔（`hak_sx` / `sixian`）。与大陆梅县/惠州腔有差异，但仍是「真客语发音规则」方案；家人录音复刻可后续覆盖。
