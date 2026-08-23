# Linux (VPS / headless — including iPad → Termius SSH install)

This node is typically a always-on Linux host installed from an iPad SSH session. Prefer CLI; there is usually **no desktop GUI**.

- Paths: `$HOME/.openclaw`, `$HOME/tasks`, `$HOME/openclaw-workbench`
- Python: prefer `$HOME/.openclaw/venv/bin/python` when present, else `python3`
- Network: `curl -fsSL` (add `-k` only if the host has broken CA store)
- Bridge daemon: `systemctl --user status spark-bridge` · logs: `journalctl --user -u spark-bridge -f`
- Watchdog: `systemctl --user status spark-bridge-watchdog.timer`
- After Termius disconnects, Bridge keeps running via **systemd --user + linger** — do not run Bridge in the foreground SSH shell.

## 本技能

```bash
PY="$HOME/.openclaw/venv/bin/python"
$PY "$HOME/.openclaw/workspace/skills/music-gen/generate_music.py" --help
```

音频落到 `$HOME/tasks/`。无 GUI 播放器时回传路径；可用 `ffplay`/`mpg123`（若已装）试听。
