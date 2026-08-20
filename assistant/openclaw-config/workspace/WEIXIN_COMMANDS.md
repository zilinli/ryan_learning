# 常用微信指令速查

用户会通过微信给 agent 发指令。以下是常见请求与建议的处理方式：

## 先查记忆（Memory RAG）
- 涉及"之前 / 上次 / 以前 / 我让你做过"的请求，先用 `openclaw memory search "<主题>" --agent main` 检索记忆与 `~/tasks` 历史产物（见 `memory-rag` skill）。

## 系统状态
- "查电量 / 查 CPU / 查内存" → 运行 `pmset -g batt`、`top -l 1 -n 5 | head -20`、`vm_stat` 等，用中文简要汇报。
- "查磁盘空间" → `df -h /`
- "这台 Mac 什么配置" → `system_profiler SPHardwareDataType`

## 写代码（Cursor）
- "用 Cursor 写/改 XX" → 使用 `cursor-code` skill，在用户指定的项目目录（未指定时默认 `~/Projects` 下按项目名推断）执行。
- 完成后汇报：改了哪些文件、运行结果、是否通过。

## 命令纠错
- "fuck / 卧槽 / 刚才错了 / 帮我纠正 / 修好那条命令" → 使用 `command-correct` skill。
- 优先用本机 `thefuck`（见 skill 内安装与 `suggest.py`）；无匹配再用 LLM 兜底。
- 微信里先甩出修正建议 + 一句短吐槽，等用户回「跑 / yeah」再执行。
- 高风险（sudo、删文件、force push 等）即使 yeah 也要再确认；删文件优先 `trash`。

## 娱乐
- "讲个笑话 / 来点冷知识" → `fun-mode`：短中文一段，不刷屏。
- "猜谜 / 成语接龙 / 数字炸弹" → `fun-mode` 轻量回合制；状态记在 `memory/YYYY-MM-DD.md`。
- "今天运气 / 抽签" → 趣味签文，图个乐，不装神棍。
- "sl" → thefuck 彩蛋（蒸汽火车梗），再问要不要帮你 `ls`。

## 网页搜索 / 资讯
- "搜索 XX / 查一下 XX" → 使用 `web_search`（DuckDuckGo）搜索并中文简要回答。
- "看某网页" → 使用 `browser` 工具或 `web_fetch` 提取内容。

## 定时任务
- "XX 点提醒我 YY" → 用 `openclaw cron add --at "+N"` 或 cron 表达式创建定时任务，投递到微信。
- "每天 X 点推送 YY" → 用 cron 表达式创建周期性任务。
- 定时推送**必须指定投递目标**，否则报 "Delivering to openclaw-weixin requires target"。正确的创建方式：
  ```
  openclaw cron add --at "+10m" --message "内容" \
    --channel openclaw-weixin \
    --to "o9cq80-dPN3ePLU98NM874itQOkE@im.wechat" \
    --announce
  ```
  `--to` 是用户的微信 ID（在 `~/.openclaw/credentials/openclaw-weixin-*-allowFrom.json` 里）。周期性任务去掉 `--at` 改用 cron 表达式，如 `--cron "0 9 * * *"`。

## 文件整理
- "整理桌面 / 整理下载" → 使用 `file-organizer` skill（已安装），按类型/日期归类文件。
- 整理前先列出计划让用户确认，移动文件后汇报结果。

## 任务产物（Task Deliver）
- 所有需要产出文件的长期任务，统一在 `~/tasks/<日期>-<任务名>/` 建目录落盘（见 `task-deliver` skill）。
- 完成后按"✅ 完成 / 📁 产物目录 / 📄 交付物清单"格式回传。

## 文档生成（Office Docs）
- "生成 Word / PPT / 周报 / 会议纪要" → 用 `office-docs` skill（venv 里 pypandoc/python-pptx 已就绪），Markdown 写内容后转 docx/pptx。

## 深度研究（Deep Research）
- "深度研究 XX / 写研究报告 / 对比分析 XX" → 用 `deep-research` skill：多轮检索 + 交叉验证 + 结构化报告。

## 数据分析（Data Analysis）
- "分析这个数据 / 看看这份表 / 出个图表" → 用 `data-analysis` skill（pandas/matplotlib），产出图表 PNG + 结论。

## 天气与节假日（Connectors）
- "今天天气 / 明天天气" → `curl -sk "https://wttr.in/?format=..."`（见 `connectors-basic` skill）。
- "接下来有什么假期 / 这周上几天班" → 抓取 `holiday-cn` 数据（`connectors-basic`）。

## 生成图片 / 语音（Media Gen）
- "画一张图 / 生成图片" → 用 `media-gen` skill（万相文生图，异步任务+轮询）。

## 生成歌曲 / BGM（Music Gen · deAPI）
- "生成一首歌 / 做个 BGM / 写首歌并唱出来 / 做战歌" → **必须**用 `music-gen` skill 调 deAPI 生成 mp3，不要只交歌词。
- 脚本：`python3 ~/.openclaw/workspace/skills/music-gen/generate_music.py --caption "..." --lyrics "..." --out ~/tasks/<任务>/song.mp3`
- 密钥：`DEAPI_API_KEY`（`~/.openclaw/.env`，含 `|` 必须用单引号）。

## 操控屏幕（Computer Use）
- "帮我点 / 打开并操作应用 / 自动填表" → 用 `computer-use` skill（cliclick + osascript），先截图定位再操作。

## 费用记账（Cost Tracker）
- "这个月 API 花了多少 / 帮我记账" → 用 `cost-tracker` skill，读 `~/openclaw-costs/` CSV 汇总。

## 多 Agent 分工
- 编码类任务可指定 coder agent，办公文档类可指定 office agent：
  ```
  openclaw agent --agent coder --local -m "任务描述"
  openclaw agent --agent office --local -m "任务描述"
  ```
- 微信里默认仍是 main（Bolt）处理，需要分工时说"让编码助手去做"。

## Bolt Console（网页控制台，旧称工作台）
- "开个工作台 / 打开 Console / 控制台 / 网页版打开 / 浏览器打开" → 运行 `bash ~/openclaw-workbench/start.sh`，回报地址 http://127.0.0.1:18790。
- "关掉工作台 / 关掉 Console" → `bash ~/openclaw-workbench/stop.sh`。
- Console 左侧发指令（可选手动指定 main/coder/office）；右侧舞台预览/播放 `~/tasks` 产物（Markdown、Office、音频、图像、视频），并查看技能与记忆。
- Console 调用不带 --deliver，回复只显示在网页，不会推送到微信；产物都在 ~/tasks，两端共享。

## 群聊限制
- 当前微信 iLink bot **仅支持私聊**，不支持群聊。
- 若确需群聊：可评估 ① 转 Telegram bot（`openclaw channels add telegram` 需自行注册 bot token，国内需代理）② 个人号桥接（有封号风险，不建议）。
- 在能支持群聊的渠道里，遵守 `AGENTS.md` 群聊礼仪。

## 技能市场（ClawHub）
- 查找新技能：`openclaw skills search <关键词>`
- 安装：`openclaw skills install <name>`（安装前可用 `openclaw skills verify` 做安全校验）
- 查看已有：`openclaw skills list`
- 优先用现成技能，别重复造轮子。

## 系统操作
- 打开应用：`open -a "应用名"` 或 `osascript` 激活。
- 截图：`screencapture -x /tmp/shot.png`。
- 高风险操作（删除、git push、改系统配置）必须先向用户确认。

## 模型
- "切换到 DeepSeek / 切换到百炼" → 用 `openclaw models set` 切换主模型。
- 默认主模型 DeepSeek V4 Flash，备用百炼 Qwen3.5 Plus。

## 一般规则
- 微信里回复要简洁（微信限制消息长度，长内容分段发）。
- 不要用 markdown 表格（微信不渲染），用列表。
- 涉及敏感操作先确认。
