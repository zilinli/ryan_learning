# Music Gen（deAPI 文生曲）

用户要的是**可播放的 mp3**，不是歌词 Markdown。先写歌词/风格，再调用本脚本生成音频，按 `task-deliver` 落盘交付。

## 前置

```bash
set -a; . ~/.openclaw/.env; set +a
# .env 里 DEAPI_API_KEY 必须用单引号包住（key 含 | 字符）
echo "${DEAPI_API_KEY:0:6}"   # 应打印 17191|
```

脚本：`~/.openclaw/workspace/skills/music-gen/generate_music.py`

## 用法

```bash
TASK_DIR="$HOME/tasks/$(date +%F)-<任务短名>"
mkdir -p "$TASK_DIR"

python3 ~/.openclaw/workspace/skills/music-gen/generate_music.py \
  --caption "flamenco Spanish World Cup anthem, passionate male vocal, guitar, stadium chant" \
  --lyrics $'¡Viva la Roja, viva el fútbol!\nCantamos juntos, un solo corazón.' \
  --vocal-language es \
  --duration 30 \
  --bpm 128 \
  --timesignature 4 \
  --out "$TASK_DIR/song.mp3"
```

参数要点（AceStep_1_5_Turbo 默认）：

| 参数 | 规则 |
|---|---|
| `--caption` | 英文风格描述更稳，3–300 字符 |
| `--lyrics` | **必填**；纯器乐用 `[Instrumental]` |
| `--duration` | Turbo 10–300 秒；默认 30（先短后长，省余额） |
| `--steps` | Turbo 只能 8；Base 模型才是 5–100 |
| `--guidance` | Turbo 只能 1 |
| `--format` | 只用 `mp3` |
| `--timesignature` | 整数 2/3/4/6，不要传 `4/4` |
| `--model` | 默认 `AceStep_1_5_Turbo`；质量优先可改 `AceStep_1_5_Base`（最短 30 秒） |

## 工作流

1. 确认用户要「能听的歌」还是只要歌词。要听 → 本技能；只要词 → 写 md 即可。
2. `task-deliver` 建目录。
3. 写好 caption + lyrics（西班牙语/英语歌词直接进 `--lyrics`，中文翻译放 md 不进模型）。
4. 先生成 20–40 秒试听；用户满意再加长。
5. 交付：`song.mp3` 路径 + 歌词 md（建议文件名 `歌词.md`）。微信里说清路径。Bolt Console 播放 mp3 时会自动滚动同目录歌词；若有 `.lrc` 则按时间轴精确对词。

## 规则

- 本机 curl 必须 `-k`（脚本已处理）。
- 余额查询：`curl -sk -H "Authorization: Bearer $DEAPI_API_KEY" -H "Accept: application/json" https://api.deapi.ai/api/v2/account/balance`
- 失败时把脚本 stderr 原文告诉用户，不要假装已生成。
- 密钥只存在 `.env`，回复里不要打印完整 key。
