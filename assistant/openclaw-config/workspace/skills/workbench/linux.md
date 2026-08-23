# Linux (VPS / headless — including iPad → Termius SSH install)

This node is typically a always-on Linux host installed from an iPad SSH session. Prefer CLI; there is usually **no desktop GUI**.

- Paths: `$HOME/.openclaw`, `$HOME/tasks`, `$HOME/openclaw-workbench`
- Python: prefer `$HOME/.openclaw/venv/bin/python` when present, else `python3`
- Network: `curl -fsSL` (add `-k` only if the host has broken CA store)
- Bridge daemon: `systemctl --user status spark-bridge` · logs: `journalctl --user -u spark-bridge -f`
- Watchdog: `systemctl --user status spark-bridge-watchdog.timer`
- After Termius disconnects, Bridge keeps running via **systemd --user + linger** — do not run Bridge in the foreground SSH shell.

## 本技能（Bolt Console）

```bash
bash "$HOME/openclaw-workbench/start.sh"   # 监听 127.0.0.1:18790
bash "$HOME/openclaw-workbench/stop.sh"
```

- 无桌面时：告诉用户用 SSH 隧道 `ssh -L 18790:127.0.0.1:18790 user@host` 后在自己浏览器打开
- 从 iPad 遥控：优先继续用 Spark `/control`，不必强行开 workbench UI
