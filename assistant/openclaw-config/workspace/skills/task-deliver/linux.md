# Linux (VPS / headless — including iPad → Termius SSH install)

This node is typically a always-on Linux host installed from an iPad SSH session. Prefer CLI; there is usually **no desktop GUI**.

- Paths: `$HOME/.openclaw`, `$HOME/tasks`, `$HOME/openclaw-workbench`
- Python: prefer `$HOME/.openclaw/venv/bin/python` when present, else `python3`
- Network: `curl -fsSL` (add `-k` only if the host has broken CA store)
- Bridge daemon: `systemctl --user status spark-bridge` · logs: `journalctl --user -u spark-bridge -f`
- Watchdog: `systemctl --user status spark-bridge-watchdog.timer`
- After Termius disconnects, Bridge keeps running via **systemd --user + linger** — do not run Bridge in the foreground SSH shell.

## 本技能

任务目录 `$HOME/tasks/YYYY-MM-DD-<name>/`。从 iPad `/control` 遥控时，清单里写清服务器路径，用户可在主机或 SFTP 取回。
