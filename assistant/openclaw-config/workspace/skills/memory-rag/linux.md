# Linux (VPS / headless — including iPad → Termius SSH install)

This node is typically a always-on Linux host installed from an iPad SSH session. Prefer CLI; there is usually **no desktop GUI**.

- Paths: `$HOME/.openclaw`, `$HOME/tasks`, `$HOME/openclaw-workbench`
- Python: prefer `$HOME/.openclaw/venv/bin/python` when present, else `python3`
- Network: `curl -fsSL` (add `-k` only if the host has broken CA store)
- Bridge daemon: `systemctl --user status spark-bridge` · logs: `journalctl --user -u spark-bridge -f`
- Watchdog: `systemctl --user status spark-bridge-watchdog.timer`
- After Termius disconnects, Bridge keeps running via **systemd --user + linger** — do not run Bridge in the foreground SSH shell.

## 本技能

记忆目录 `$HOME/.openclaw/workspace/memory/`。用 `rg` 或 `grep -R` 兜底。注意 VPS 磁盘配额，勿把大附件塞进 memory。
