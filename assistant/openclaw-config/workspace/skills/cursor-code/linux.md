# Linux (VPS / headless — including iPad → Termius SSH install)

This node is typically a always-on Linux host installed from an iPad SSH session. Prefer CLI; there is usually **no desktop GUI**.

- Paths: `$HOME/.openclaw`, `$HOME/tasks`, `$HOME/openclaw-workbench`
- Python: prefer `$HOME/.openclaw/venv/bin/python` when present, else `python3`
- Network: `curl -fsSL` (add `-k` only if the host has broken CA store)
- Bridge daemon: `systemctl --user status spark-bridge` · logs: `journalctl --user -u spark-bridge -f`
- Watchdog: `systemctl --user status spark-bridge-watchdog.timer`
- After Termius disconnects, Bridge keeps running via **systemd --user + linger** — do not run Bridge in the foreground SSH shell.

## 本技能

- 脚本：`$HOME/.openclaw/cursor/cursor-run.mjs`（若 install 已同步）
- 需 `CURSOR_API_KEY`；无图形 Cursor IDE 时仍可用 headless Agent SDK
- 默认项目目录：`$HOME/projects` 或 `$HOME/codes`（取存在者）
- 无 GUI 时不要 `cursor -g` 打开编辑器
