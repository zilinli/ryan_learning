# Bolt Console（网页控制台）

给用户提供类似 Claude Artifacts / ChatGPT Canvas 的本机控制台：左侧对话，右侧常驻预览舞台，可打开 Markdown、Office、音视频与图像。

旧称「工作台」仍然有效：用户说「开个工作台」时同样启动本服务。

## 地址

- Bolt Console：http://127.0.0.1:18790
- OpenClaw 官方 Control UI：http://127.0.0.1:18789/（会话管理、更完整的配置，`openclaw dashboard` 打开）

## 启动 / 停止

```bash
bash ~/openclaw-workbench/start.sh        # 启动并自动打开浏览器
bash ~/openclaw-workbench/start.sh 18791 # 自定义端口
bash ~/openclaw-workbench/stop.sh         # 停止
```

- 启动失败看日志：`~/openclaw-workbench/workbench.log`。
- 仅绑定 127.0.0.1，只有本机能访问；不要用 SSH 隧道等方式对外暴露（个人工具，无鉴权）。

## 能力

| 区域 | 能力 |
|---|---|
| 左侧 Thread | 发指令、选 agent（main/coder/office）、Markdown 回复 |
| 右侧 Stage | 预览 MD / Office（docx/pptx/xlsx/pdf），播放 mp3/wav、图像、视频 |
| Files | 浏览 `~/tasks`，按类型图标点击即打开舞台 |
| Skills / Memory / Log | 技能清单、记忆文件、最近指令 |

生成歌曲或图片完成后，舞台会自动载入最新产物。

## 与微信的关系

- 微信遥控与 Console **并存**：两边发指令都会由同一个 OpenClaw agent 执行。
- Console 的 `openclaw agent` 调用不带 `--deliver`，回复只出现在网页，不会反向推送到微信。
- 产物统一落在 `~/tasks`，两端都能看到（网页直接播放/预览；微信里回传路径）。

## 规则

- 用户说「开个工作台 / 打开 Console / 网页版打开 / 控制台」时执行 `bash ~/openclaw-workbench/start.sh` 并回报地址。
- 服务异常（打不开 18790）时：检查 `workbench.log`、确认 18790 未被占用，必要时 `stop.sh` 后重新 `start.sh`。
