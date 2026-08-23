# Linux (VPS / headless — including iPad → Termius SSH install)

This node is typically a always-on Linux host installed from an iPad SSH session. Prefer CLI; there is usually **no desktop GUI**.

- Paths: `$HOME/.openclaw`, `$HOME/tasks`, `$HOME/openclaw-workbench`
- Python: prefer `$HOME/.openclaw/venv/bin/python` when present, else `python3`
- Network: `curl -fsSL` (add `-k` only if the host has broken CA store)
- Bridge daemon: `systemctl --user status spark-bridge` · logs: `journalctl --user -u spark-bridge -f`
- Watchdog: `systemctl --user status spark-bridge-watchdog.timer`
- After Termius disconnects, Bridge keeps running via **systemd --user + linger** — do not run Bridge in the foreground SSH shell.

## 本技能（重要）

**默认无桌面 GUI。** 不要调用 cliclick / osascript / pyautogui。

改用：
- CLI：`bash`、`python3`、`curl`、包管理器
- 浏览器自动化仅在已安装 headless Chrome/Playwright 且用户明确要求时
- 若用户坚持 GUI，说明此 Linux 节点是 headless，建议改连 Mac/Windows 节点
