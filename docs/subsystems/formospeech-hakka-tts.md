# FormoSpeech 客家话 TTS（VoxHakka / yourtts-htia）设计

> 对应 Phase 15.2.7 · 2026-08-09  
> 模型：`formospeech/yourtts-htia-240704`（CC BY-NC 4.0，家庭/教育可用）  
> Space 参考：`united-link/taiwanese-hakka-tts` · 项目页：https://voxhakka.github.io/

## 可行性结论

| 项 | 结论 |
|----|------|
| 发音质量 | ✅ 客语语料微调 + `formog2p.hakka` 音素前端，优于大厂硬读汉字 |
| 本机常驻实时推理 | ❌ 模型约 970MB，4GB KVM 上与 Spark 并存易 OOM |
| 离线预合成 → TTS 缓存 | ✅ **推荐主路径**：批量合成高频句，日常只读磁盘缓存 |
| 可选 sidecar | ✅ `FORMOSPEECH_TTS_URL` 指向临时推理服务时，未命中缓存可实时合成 |
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
        ① 磁盘缓存命中
        ② FORMOSPEECH_TTS_URL sidecar
  失败 → 503（不回退粤语）
```

缓存 key 与现网一致：`sha256(text + "\0" + voice).mp3`，voice 固定 `formospeech-sixian`。

## 离线预合成

```bash
# 建议：停 Spark 或另机执行，避免与生产抢内存
python3 scripts/formospeech_presynth.py \
  --phrases scripts/formospeech_phrases_hak.json \
  --out-data-dir data
```

依赖：`vendor/taiwanese-hakka-tts`（HF Space）+ Python 3.11 venv（`formog2p` 要求 ≥3.10；见 `scripts/formospeech_presynth.py` 头注释）。

本机实测（2026-08-09，停 Spark 后离线跑）：15 条高频句全部合成成功，CPU RTF ≈0.2；产物写入 `data/tts-cache/`（gitignored）。日常 `/api/tts` `lang=hak` 命中缓存时 `X-TTS-Engine: formospeech-cache`。

## 腔调说明

当前默认四縣腔（`hak_sx` / `sixian`）。与大陆梅县/惠州腔有差异，但仍是「真客语发音规则」方案；家人录音复刻可后续覆盖。
