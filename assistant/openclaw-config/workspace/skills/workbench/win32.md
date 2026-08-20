# Bolt Console（网页控制台 · Windows）

## 地址

- Bolt Console：http://127.0.0.1:18790
- OpenClaw Control UI：http://127.0.0.1:18789/（`openclaw dashboard`）

## 启动 / 停止

```powershell
cd $env:USERPROFILE\openclaw-workbench
.\start.ps1                 # 启动并打开浏览器
.\start.ps1 -Port 18791     # 自定义端口
.\stop.ps1                  # 停止
```

- 日志：`%USERPROFILE%\openclaw-workbench\workbench.log`
- 仅绑定 127.0.0.1，勿对外暴露。

## 与微信

- Console 的 agent 调用不带 `--deliver`，回复只在网页。
- 产物统一在 `%USERPROFILE%\tasks`，两端共享。

## 规则

- 用户说「开个工作台 / 打开 Console」时执行 `.\start.ps1` 并回报地址。
- 异常时查日志，必要时 `.\stop.ps1` 后重开。
