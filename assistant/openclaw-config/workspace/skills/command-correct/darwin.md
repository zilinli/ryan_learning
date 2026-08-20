# Command Correct（thefuck 风格纠错）

用 [thefuck](https://github.com/nvbn/thefuck) 纠正上一条失败命令；规则未命中时再用 LLM 给出候选。微信侧**先展示建议再执行**（异步确认，代替交互式 ↑↓）。

## 前置条件

检测：

```bash
which thefuck || which fuck
```

若未安装，先提示用户：

```text
还没装 thefuck。优先：brew install thefuck
备选：pip3 install thefuck --user
（pip 用户目录常在 ~/Library/Python/*/bin，需在 PATH 里）
装好前我先用 LLM 兜底猜修正。
```

调用前确保 PATH 含 thefuck：

```bash
export PATH="$HOME/Library/Python/3.9/bin:/opt/homebrew/bin:$PATH"
which thefuck
```

然后继续走下方「LLM 兜底」。可选（用户交互 shell，需先征得同意再改 rc）：

```bash
# ~/.zshrc 或 ~/.bashrc
eval $(thefuck --alias)
```

助理纠错**不依赖**该 alias。

辅助脚本（推荐）：`~/.openclaw/workspace/skills/command-correct/suggest.py`  
（本仓库路径：`openclaw-config/workspace/skills/command-correct/suggest.py`，备份后应同步到 `~/.openclaw/workspace/...`）

## 触发

- 中文：刚才错了、帮我纠正、修好那条命令、卧槽（配合失败命令/报错）
- 英文/梗：fuck、fix that command、yeah（确认直接跑）
- 用户粘贴了失败命令或完整报错输出

## 流程

### 1. 收集失败命令与输出

优先级：

1. 用户消息里粘贴的命令 + stderr/stdout
2. 本会话中 agent 上一轮 shell 工具的失败输出
3. 近期历史（只读，勿改）：`~/.zsh_history` / `~/.bash_history` 末尾若干行，并请用户确认是否就是那条

缺输出时仍可纠 typo 类问题；权限/git 类规则通常需要报错文本。

### 2. 调用 thefuck（只取建议，不自动执行）

优先用辅助脚本（可传入已知 output，避免再跑一遍失败命令）：

```bash
python3 ~/.openclaw/workspace/skills/command-correct/suggest.py \
  --script '失败的命令' \
  --output '报错全文'
```

仅有命令时：

```bash
THEFUCK_REQUIRE_CONFIRMATION=false \
  thefuck --force-command '失败的命令'
```

stdout 即修正后的命令字符串（thefuck 本身打印脚本，由 shell alias 负责 `eval`；**agent 不要直接 eval，先给用户看**）。

### 3. 微信回复格式

简洁中文，例如：

```text
啧，又翻车了。
建议：git push --set-upstream origin main
回「跑」或「yeah」我再执行；回「换一个」看下一条。
```

- 毒舌**最多一句**，然后给可执行建议
- 多候选时列 1–3 条，默认推荐第一条
- 不要 markdown 表格

### 4. LLM 兜底

当 `thefuck` 未安装、退出非 0、或无建议时：

1. 根据「命令 + 报错」推理 1–3 条修正
2. 简短说明为什么（一行）
3. 同样先确认再执行

### 5. 执行策略（对齐 AGENTS.md）

| 用户说法 | 行为 |
|----------|------|
| 跑 / 执行 / 好 / 可以 | 执行当前推荐命令 |
| yeah / 别问了 / 直接跑 / --yeah / --hard | 等同 thefuck `--yeah`：对**非破坏性**命令可立即执行 |
| 换一个 / 下一条 | 展示下一条候选 |
| 递归修 / 一直修到好 | 执行后若仍失败，再纠一轮，最多 3 轮，每轮汇报 |

**必须先确认（即使 yeah）**：含 `rm -rf`、写系统目录、`sudo` 改配置、`git push --force`、丢弃数据、改 shell rc / crontab 等。

删除文件优先 `trash`，不要直接 `rm`。

### 6. 成功后

一句话确认结果（可收起毒舌）。把有价值的纠错记到 `memory/YYYY-MM-DD.md`（可选）。

## 安全红线

- 不把用户密钥、完整 history 往外发
- 不静默修改 `~/.zshrc` / `~/.bashrc`
- 不确定就问，不装聪明硬跑
