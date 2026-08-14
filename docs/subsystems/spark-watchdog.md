# Spark System Watchdog（系统守护进程）— 自愈 + LLM 升级修复

> Version 1.0 · 2026-08-14
> Related: [chat-quote-and-deploy-reliability.md](chat-quote-and-deploy-reliability.md)（4GB 内存宿主机 build/deploy 可靠性）、[code-agent-deploy.md](code-agent-deploy.md)
> 组件：`scripts/watchdog.mjs` + `/etc/systemd/system/spark-watchdog.service`

---

## 1. Background — 2026-08-13 事故复盘

### 1.1 现象

- 系统重启（`last reboot` 显示多日多次重启），重启后 `spark-tutor` 进入**无限 crash-loop**（PM2 restart 计数 3000+）。
- crash-loop 根因：`.next/BUILD_ID` 缺失。`next start` 找不到生产构建 → 秒级退出 → PM2 `autorestart` 无限重试。
- `.next` 目录只剩 `cache/`，无 `.next.prev` 备份（smart-build 的 stash 已丢弃）。
- `spark-tutor-error.log` 累计 **5546 条** `Could not find a production build` 错误。

### 1.2 根因链

```
Code Agent 请求（agent-chat /api/chat）
  └─ 创建本地 Cursor Agent + autoGitPipeline 跑 npm test/build
      └─ 4GB VM 上内存峰值超限（free ~127MB，swap 耗尽）
          └─ OOM / 系统 kill（journal 非持久化，重启后证据丢失）
              └─ .next 在构建中途被清空 / 未恢复
                  └─ 重启后 spark-tutor crash-loop（无守护自愈）
```

关键事实：

| 项 | 值 |
|----|----|
| 宿主机 | 4 vCPU / 4 GB RAM QEMU VM |
| `spark-tutor` | `next start`（PM2，无 systemd 单元） |
| `spark-acc` | `next dev`（systemd，`Restart=always`） |
| `spark-stt` | Whisper/SenseVoice（systemd，`Restart=on-failure`） |
| `journald` | **非持久化**（`/var/log/journal` 不存在），跨重启丢失 OOM 记录 |
| PM2 | `pm2-root.service` 自启 + `dump.pm2` 拉起 spark-tutor，但**无自愈** |
| 既有脚本 | `health-check.mjs`（只报告）+ `restart-services.sh`（手动全量重启）|

结论：既有机制能"拉起"但不会"自愈"——服务挂了没人探测、没人修、`.next` 丢了没人重建。这就是守护进程要解决的。

## 2. 守护进程设计

### 2.1 架构

```
systemd ──multi-user.target──▶ spark-watchdog.service
                                   │ Restart=always
                                   ▼
                          scripts/watchdog.mjs（每 30s 一轮）
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
  健康探测                   确定性修复                    LLM 升级修复
  (3000/3001/8765            (pm2 restart /                (Cursor SDK
   + BUILD_ID/磁盘/内存)      systemctl restart            Agent.prompt)
                              / rebuild .next)
```

### 2.2 systemd 单元（开机自启）

`/etc/systemd/system/spark-watchdog.service`：

```ini
[Unit]
Description=Spark System Watchdog — health checks + deterministic self-heal + LLM escalation via Cursor SDK
After=network.target pm2-root.service spark-stt.service spark-acc.service
Wants=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/root/codes/ryan_learning
Environment=NODE_ENV=production
EnvironmentFile=/root/codes/ryan_learning/agent-chat/.env.local   # CURSOR_API_KEY
ExecStart=/usr/bin/node /root/codes/ryan_learning/scripts/watchdog.mjs
Restart=always
RestartSec=10
StartLimitIntervalSec=0
TimeoutStopSec=20
KillMode=control-group

[Install]
WantedBy=multi-user.target
```

启动顺序（`After=`）：`pm2-root.service`（拉起 spark-tutor）→ `spark-stt` → `spark-acc` → watchdog 最后启动，负责"兜底"。

### 2.3 健康探测

每 `WATCHDOG_INTERVAL_MS`（默认 30s）探测：

| 服务 | 探测点 | 通过条件 |
|------|--------|---------|
| spark | `http://127.0.0.1:3000/api/setup` | `configured === true` 等 |
| acc | `http://127.0.0.1:3001/api/setup` | `ok === true` |
| stt | `http://127.0.0.1:8765/health` | `ok === true` |
| 构建 | `.next/BUILD_ID` | 存在且非空 |
| 磁盘 | `df` 剩余 | ≥ `WATCHDOG_DISK_MIN_MB`（默认 2048） |
| 内存 | `free -m` available | 低于 300MB 报警（影响修复优先级） |

### 2.4 确定性修复（不依赖 LLM）

| 故障 | 修复 |
|------|------|
| spark DOWN | `pm2 restart spark-tutor`（若 crash-loop 则升级 LLM） |
| acc DOWN | `systemctl restart spark-acc.service` |
| stt DOWN | `systemctl restart spark-stt.service` |
| BUILD_ID 缺失 | `npm run build`（smart-build，安全 stash/restore，完成后 3s 确认） |
| 磁盘不足 | `pm2 flush` 截断日志 |

**crash-loop 判定**：基于 PM2 restart 计数**增量**（本轮 − 上一轮 ≥ 10 视为崩溃循环），而非绝对值——历史遗留的高计数（如 3401）不应阻止单次拉起。

### 2.5 LLM 升级修复（Cursor SDK）

确定性修复失败（如 crash-loop、build 失败、未知故障）时，把诊断上下文打包发给大模型：

- **Prompt 要求模型返回 JSON**：`{"summary","actions":[{"action","target","reason"}],"note"}`
- **动作白名单**（`ACTION_WHITELIST`，未命中拒绝执行）：
  - `restart_service`（systemd 单元）
  - `restart_pm2`（PM2 应用）
  - `rebuild_next`（重建 .next）
  - `trim_pm2_logs` / `purge_tmp`
  - `notify_admin`（仅记录，标记需人工介入）
- **安全边界**：
  - LLM 只读诊断；修复动作必须在白名单内。
  - 每个动作带冷却（`WATCHDOG_RECOVERY_COOLDOWN_MS`，默认 60s）。
  - LLM 咨询冷却 `WATCHDOG_LLM_COOLDOWN_MS`（默认 15min），单日上限 30 次，防故障风暴烧 API。
  - 无 `CURSOR_API_KEY` 时跳过咨询（不影响确定性修复）。

调用示例（与 `llmConsult` 同构）：

```
Agent.prompt(prompt, {
  apiKey: CURSOR_API_KEY,
  model: { id: "composer-2.5" },
  local: { cwd: "/root/codes/ryan_learning", settingSources: [] },
})
```

### 2.6 状态与日志

| 项 | 位置 |
|----|------|
| 运行日志 | `logs/watchdog.log`（脚本自写，滚动保留 5000 行） |
| systemd stdout | journald |
| 状态（冷却/计数） | `logs/watchdog-state.json` |

## 3. 验证记录（2026-08-14）

| 场景 | 结果 |
|------|------|
| 全服务健康 | `all healthy` 每轮输出 |
| `pm2 stop spark-tutor` 模拟故障 | watchdog 检测 DOWN → `pm2 restart` → 下轮 `all healthy` ✅ |
| BUILD_ID 缺失 | watchdog 自动触发 rebuild，`.next` 恢复，spark-tutor 上线 ✅ |
| STT 服务异常 | watchdog `systemctl restart spark-stt.service` ✅ |
| LLM 咨询 | 模拟诊断 → 模型正确诊断（crash-loop + 内存不足）并给出白名单动作（trim/rebuild）✅ |
| 开机自启 | `systemctl is-enabled` = enabled，`multi-user.target.wants` symlink 存在 ✅ |

## 4. 运维速查

```bash
systemctl status spark-watchdog.service   # 守护进程状态
journalctl -u spark-watchdog.service -f   # 实时日志（systemd）
tail -f logs/watchdog.log                 # 运行日志
node scripts/watchdog.mjs --once          # 手动单次检查（诊断用）
```

配置项（`/etc/systemd/system/spark-watchdog.service` Environment）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `WATCHDOG_INTERVAL_MS` | 30000 | 检查周期 |
| `WATCHDOG_CHECK_TIMEOUT_MS` | 8000 | 单服务探测超时 |
| `WATCHDOG_RECOVERY_COOLDOWN_MS` | 60000 | 动作冷却 |
| `WATCHDOG_LLM_COOLDOWN_MS` | 900000 | LLM 咨询冷却（15min） |
| `WATCHDOG_DISK_MIN_MB` | 2048 | 磁盘告警阈值 |
| `WATCHDOG_MAX_CRASH_RESTARTS` | 10 | crash-loop 增量阈值 |
| `WATCHDOG_CURSOR_MODEL` | composer-2.5 | 咨询模型 |

## 5. 遗留建议

1. **journald 持久化**：`mkdir -p /var/log/journal && systemctl restart systemd-journald`，否则 OOM 证据随重启丢失。
2. **内存上限保护**（可选）：给 `spark-acc`/`spark-stt` 加 `MemoryMax=` cgroup 限流，防止 `next dev` 峰值 800MB 挤爆 4GB 宿主机。
3. **swap 健康**：当前 swap 1024MB 接近耗尽风险；build 前 watchdog 可先行 `pm2 flush` 释放日志内存。

## 6. 2026-08-14 Code Agent「不灵了」故障记录

### 6.1 现象

- 用户反馈 Code Agent 面板发送请求无响应（"前几次的请求都不行"）。
- 排查发现 `data/console/sessions/cs_1785810484857_a3anwf.json`：只有 1 条 user 消息（00:39:11 UTC），**0 条 assistant 回复**——请求收到了，但 agent 从未返回任何内容。

### 6.2 根因

```
00:39:11 用户发送 Code Agent 请求
  └─ 此刻 spark-tutor 正处于 crash-loop 恢复窗口（.next 损坏/缺失）
      └─ 请求被丢弃（无 run 创建、无回复）
          └─ 00:39:51 watchdog/smart-build 完成重建，服务恢复
              └─ 用户之后的请求正常，但丢失的那几条无任何痕迹
```

- spark-tutor `created_at=1786667991035` = 00:39:51 UTC，恰在用户消息之后 40 秒。
- 丢失原因：`console-run-store` 是**纯内存** Map，服务重启后进行中的 run 全部丢失；用户消息虽已持久化到 session 文件，但没有 assistant 回复，前端 `resumeActive` 无 activeRun 可恢复，静默悬挂。

### 6.3 修复

| 修复 | 文件 | 说明 |
|------|------|------|
| `serverActions.bodySizeLimit` 移到 `experimental` 下 | `next.config.ts` | Next.js 16 schema 中该键在 `experimental`；原顶层配置无效（`Invalid next.config` 警告 + 512MB 上传限制实际不生效）。修复后 build 日志显示 `Experiments: serverActions, proxyClientMaxBodySize: 512mb` ✅ |
| 崩溃窗口悬挂检测 | `src/components/CodeAgentPanel.tsx` | `resumeActive` 在无 activeRun 且最后一条是未回复 user 消息时，显示"上次请求可能因服务重启未完成 — 重新发送即可"，避免静默悬挂 |

### 6.4 验证

- 重建 `.next`（smart-build 48s 成功），spark-tutor / spark-acc / spark-stt / formospeech-tts 全部恢复。
- 主应用 `/api/console/chat`（3000）与 ACC `/api/chat`（3001）端到端测试均返回 `done` ✅。
- 重启后日志已无 `Invalid next.config` 警告 ✅。

### 6.5 遗留建议（追加）

4. **run 持久化**（可选增强）：`console-run-store` 内存态可在 `createConsoleRun`/`finishConsoleRun` 时同步写 `data/console/runs/`，服务重启后可恢复未完成任务，彻底解决崩溃窗口丢请求。

> ✅ **已实现（2026-08-14）**：`console-run-store` 现在把 run 持久化到 `data/console/runs/<runId>.json`。
> - 写入策略：create/finish 立即原子写（tmp + rename）；delta 事件防抖 500ms 批量写，避免磁盘 IO 压力。
> - 重启恢复：模块启动时 `loadPersistedRuns()` 扫描磁盘；**running 状态的 run 自动转为 error**，附提示"任务因服务重启中断，未完成 — 请重新发送。"，部分输出（fullText）保留。
> - 已完成的 run 重启后完整恢复（status/fullText/lastEventId），前端 `resumeActive` 可拿到结果，不再静默悬挂。
> - 过期清理：TTL 30 分钟，`prune` 同时删除对应磁盘文件。
> - 验证：单元测试 6 项全过；实测重启 spark-tutor 后已完成 run 恢复为 `done`、模拟中断 run 恢复为 `error` ✅

## 7. 2026-08-14 会话视频消息丢失记录（`de717193-7104-4107-bec1-831a500f367f`）

### 7.1 现象

- 用户反馈 `acct_ching` 会话 `de717193-...` 中**第一条带视频的 user 消息在对话框里消失**。
- 服务器 `data/history/acct_ching/de717193-....json` 只有 5 条消息，第一条是 assistant（00:44:31 UTC），其回复引用"your video（audio of you talking on the way to dinner about the dogs）"，但**没有任何 user 视频消息落盘**。

### 7.2 根因

```
00:28 用户发送视频消息（handleSend）
  ├─ userMsg（含视频 dataUrl）加入客户端内存 store
  ├─ saveConversations → localStorage 写入视频 dataUrl
  │     └─ 旧 slimMessages 对视频 dataUrl 一律保留 → 多会话累积超过
  │        localStorage 配额（5MB）→ setItem 抛 QuotaExceeded
  │        → aggressive 回退仍保留视频 dataUrl → 再次失败 → localStorage
  │          保持旧值（不含该 user 消息）
  ├─ pushStoreToServer（依赖客户端主动 PUT /api/history）
  │     └─ 此刻 spark-tutor 正处于 crash-loop 恢复窗口（.next 缺失）
  │        → fetch 失败被 catch 静默吞掉，服务器从未收到 user 消息
  └─ 页面刷新后内存 store 丢失，localStorage 又是旧值
        └─ user 视频消息从客户端彻底丢失；服务器也无副本
```

关键事实：**服务器侧 `/api/chat` 原本从不主动持久化 user 消息**——历史保存完全依赖客户端 `pushStoreToServer`。只要客户端在崩溃窗口 push 失败且本地 localStorage 写入也失败，该消息就永久丢失。

### 7.3 修复（防"以后类似的问题"）

| 修复 | 文件 | 说明 |
|------|------|------|
| **服务端立即落盘 user 消息** | `src/app/api/chat/route.ts` | `/api/chat` 收到请求后、AI 回复流式返回**之前**，用 `body.userMessage`（含附件 dataUrl）调用 `upsertServerConversation` 立即写盘。客户端 push 失败/崩溃也丢不了用户输入。`updatedAt` 取 `max(服务端现值, userMsg.createdAt, now)` 保证单调递增，不被跨设备乐观并发丢弃。 |
| **请求体携带完整 user 消息** | `src/lib/types.ts` | `ChatRequestBody` 新增 `accountId` + `userMessage?: ChatMessage`。 |
| **客户端发送完整 user 消息** | `src/components/tutor/useTutorSession.ts` | `consumeChatStream` payload 增加 `accountId` 与完整 `userMsg`（含视频 dataUrl）。 |
| **视频不占 localStorage 配额** | `src/lib/storage.ts` | `slimMessages` 对 video 附件**总是**剥离 `dataUrl`（无论 active 与否），避免多 MB 视频撑爆 localStorage 导致整个 store 写入失败、消息丢失。视频本体由 IndexedDB vault 持有，刷新后 `restoreStorePhotosFromVault` 恢复 dataUrl 再推送。 |
| 回归测试 | `src/lib/storage.test.ts` | 新增"active 会话视频 dataUrl 也被剥离、id/mime 保留"用例。 |

### 7.4 关于"消失的视频能否恢复"

- **服务器端不可恢复**：服务器从未收到该视频（无 mediaId、无 media 文件、无 user 消息），日志证实 de717193 从未出现 push/upsert/media 写入。
- **内容已保留**：00:49:38 的 assistant 回复完整转述了视频里 Ryan 说的每一句话（狗肉事件的完整上下文），文字层面信息没有丢失。
- **本机可找回的唯一途径**：浏览器 IndexedDB vault（`spark.photoVault`）若仍留有该附件（消息在 store 中消失后 `pruneVaultToStore` 可能已清理），刷新页面后 `restoreStorePhotosFromVault` 会自动恢复并重新推送。

### 7.5 验证

- 单测：storage 16 项、history-sync / history-store / chat-route / history-merge / media-store 45 项全过。
- 调试插桩（`7381/ingest` DBG）已全部清理，恢复生产代码。

## 8. 2026-08-14 Jieru 账号视频上传页面重启（499）根因与修复

### 8.1 现象

- 用户反馈 **Jieru 账号**（`acct_ab2adc78-f5e1-4205-8e59-6a9d89750b8d`）：**上传视频后发送消息，网页直接重启**。
- nginx 日志：该账号两次 `POST /api/chat` 均为 **499**（客户端主动断开），传输字节 0，服务器历史/媒体零落盘 → **请求体从未完整到达服务器**，客户端在传输中崩溃。

### 8.2 根因

```
客户端内存被同一视频的 base64 多份拷贝耗尽 → iPhone 杀页面 → fetch abort（499）

upload 上限 MAX_FILE_BYTES = 256MB（对视频也生效）
  ├─ readAsDataURL(file)          → dataUrl 一份   （≈341MB）
  ├─ stripDataUrlPrefix(dataUrl)  → data 第二份    （≈341MB）
  ├─ handleSend 构建 userMsg      → dataUrl 第三份（内存 store）
  ├─ putPhotoInVault              → IndexedDB 大写入期间再一份
  └─ JSON.stringify(body)         → 完整 base64 再拷一份
        瞬间峰值 >1GB → iPhone Chrome 内存超限 → 页面重启 → 499
```

关键事实：这是**客户端内存崩溃**，不是网络/nginx/服务端问题。服务器端持久化（§7 修复）也救不了——请求体根本传不完。

### 8.3 修复（2026-08-14，已上线）

| 修复 | 文件 | 说明 |
|------|------|------|
| **视频专属上限 80MB** | `src/lib/attachments.ts` | 新增 `MAX_VIDEO_BYTES = 80MB`（`MAX_VIDEO_MB=80`）。视频不再跟随 256MB 文件上限，超限在 picker 即报错「Keep videos under 80MB」。 |
| **视频只保留一份 base64（无 dataUrl）** | `src/lib/file-payload.ts` | 视频分支返回 `{ data }` **不再生成 `dataUrl`**，内存拷贝从 3-4 份降为 1 份（+stringify 1 份峰值 ~214MB，手机安全）。Composer 预览自动落到 "VID" 标签。 |
| **服务端落盘回填 dataUrl** | `src/app/api/chat/route.ts` + `src/lib/attachments.ts` `hydrateUserMessageMedia` | 视频无 dataUrl 时服务端根据 wire `data` 重建 dataUrl，`persistConversationMedia` 正常写盘并生成 mediaId；历史只存 mediaId，刷新后客户端经 `/api/media` 拉取。 |
| 提示语对齐 | `src/lib/extract-files.ts` | 视频转录失败提示改为「under 80MB」。 |

### 8.4 验证

- 单测：新增 `file-payload.test.ts`（80MB 上限、无 dataUrl、有 data、大非视频文件不受影响）+ `attachments-hydrate.test.ts`（服务端 dataUrl 回填）；相关 12 套件 99 项全过。
- 端到端（生产构建）：模拟新客户端视频消息（仅 base64 `data`、无 dataUrl）POST `/api/chat` → 历史落盘 `mediaId`、无 dataUrl 泄漏、媒体 `.bin` 字节与发送一致。
- 调试插桩（`753d74` / debug-relay / CrashWatch / agent-log）已全部清理，最终生产构建上线，watchdog 已恢复运行。


