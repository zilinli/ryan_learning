# FormoSpeech 客家话 TTS（VoxHakka / yourtts-htia）设计

> 对应 Phase 15.2.7 · 2026-08-09 · **运维修复 2026-08-15**  
> 模型：`formospeech/yourtts-htia-240704`（CC BY-NC 4.0，家庭/教育可用）  
> Space 参考：`united-link/taiwanese-hakka-tts` · 项目页：https://voxhakka.github.io/

## 可行性结论

| 项 | 结论 |
|----|------|
| 发音质量 | ✅ 客语语料微调 + `formog2p.hakka` 音素前端，优于大厂硬读汉字 |
| 本机常驻实时推理 | ⚠️ 模型约 970MB；4GB 机建议 PM2 常驻 `formospeech-tts`，并预留 swap |
| 离线预合成 → TTS 缓存 | ✅ **高频句主路径**：命中即毫秒返回 |
| Sidecar | ✅ 默认 `FORMOSPEECH_TTS_URL=http://127.0.0.1:9876`（`scripts/formospeech_server.py`） |
| 文本规范化 | ✅ 简体→繁体（OpenCC）+ 常用普通话→客语书面（`normalizeHakkaForTts` v2）+ 句读收成「，」停顿；未知字剥离重试 |
| 粤语 edge 顶替 | ❌ **禁止**：潮汕话/客家话路径不再使用 `zh-HK-*` |

## 2026-08-15 故障根因（客家话听不到 / 503）

| 现象 | 原因 |
|------|------|
| `POST /tts` → **422** `No module named 'TTS'` | PM2 `formospeech-tts` 的 **interpreter 误为系统 `python3`**，未装 Coqui TTS |
| `/health` 仍 `ok:true` 且 `model:loading` | warm 线程吞掉 import 错误，健康探针未标失败 |
| `pm2 restart` 后仍坏 | **restart 不重读** `ecosystem.config.js` 的 interpreter |

**正确解释器：** `/root/codes/ryan_learning/.venv-formospeech/bin/python`（Python 3.11 + `TTS==0.22`）。  
**修复：** `ecosystem.config.js` 固定该绝对路径；`smart-build.mjs` 用 `pm2 startOrReload ecosystem.config.js --only formospeech-tts`（勿仅 `pm2 restart`）；health 在 warm 失败时 `ok:false` + `error`。

## 路由（`ttsProviderForLang` / `/api/tts`）

```
teo:
  家人 TEO_CLONE_VOICE_ID → 百炼复刻
  否则 → 百炼闽南话 longanmin_v3
  失败 → 503（不回退粤语）

hak:
  家人 HAK_CLONE_VOICE_ID → 百炼复刻
  否则 → FormoSpeech（voice=`formospeech-sixian-v3`）
        ① normalizeHakkaForTts v2（简→繁 + 客语用字 + 数字口语 + 句读→逗号）
        ② 磁盘缓存命中 → X-TTS-Engine: formospeech-cache
        ③ FORMOSPEECH_TTS_URL sidecar：分句合成 + 句间静音（默认 100ms）
  失败 → 503（不回退粤语）

sha:
  家人 SHA_CLONE_VOICE_ID → 百炼复刻
  否则 → 百炼千问 TTS Jada（上海-阿珍）
  失败 → 503（不回退粤语）
```

缓存 key（Node）：`sha256(text + "\0" + voice)`，voice=`formospeech-sixian-v3`。  
Sidecar 另有 `hakka-tts-v3` salt 的本地 mp3 缓存。  
默认语者：`江芮敏`（女 / 苗栗四縣）；`length_scale` 默认 1.05；码率高质量 mp3。

## Sidecar（PM2）

```bash
# 依赖：.venv-formospeech（Python 3.11 + formog2p + Coqui TTS + CPU torch）
pm2 delete formospeech-tts 2>/dev/null || true
pm2 start ecosystem.config.js --only formospeech-tts
# 或构建后：smart-build 会 startOrReload
# .env.local
FORMOSPEECH_TTS_URL=http://127.0.0.1:9876
```

验收：`curl -s localhost:9876/health` → `ok:true` 且 `model:ready`；再 `POST /tts` 返回 `audio/mpeg`。

## 方言 STT / 其他方言 TTS 对照（同次排查）

| 方言 | TTS | STT |
|------|-----|-----|
| 粤语 yue | edge `zh-HK-*` | 本地 SenseVoice + 百炼 |
| 潮汕/闽南 teo | 百炼 CosyVoice `longanmin_v3`（或复刻） | 百炼 → 讯飞备份 → 本地 |
| 客家 hak | **FormoSpeech sidecar**（本页） | 同上 |
| 上海 sha | 百炼千问 `Jada`（或复刻） | 百炼 → 讯飞备份 → 本地（本地 stt_langs 暂无 sha，靠云端） |

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

## Test design

| 层 | 项 |
|----|----|
| 单元 | `tts-provider.test.ts`：hak → formospeech；无粤语 edge |
| 集成 / 运维 | `curl /health` ready；`POST /tts` 短句 mp3 &gt; 1KB；`/api/tts` `lang=hak` 200 + `X-TTS-Engine` |
| 手动 | 选客家话音色 Listen；闽南/上海各播一句；Mic 方言录入不自动发送 |
