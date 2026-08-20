# Cursor Code

当用户要求在项目里用 Cursor 写代码、实现功能、修改代码、跑测试或审查代码时，使用本技能驱动本机 Cursor Agent。

## 前置条件

- 脚本: `~/.openclaw/cursor/cursor-run.mjs`
- 依赖: `@cursor/sdk` 已安装在 `~/.openclaw/cursor/node_modules`
- 密钥: 环境变量 `CURSOR_API_KEY`（已在 `~/.openclaw/.env` 配置）

首次使用前验证:

```bash
node -e "require('/Users/chingching/.openclaw/cursor/node_modules/@cursor/sdk'); console.log('OK')"
```

## 用法

1. 解析用户的编码请求，确定目标项目目录（若用户没给目录，默认 `~/Projects` 下按项目名推断，或用最近打开的项目）。
2. 将完整任务写入临时文件（避免引号转义问题）:

```bash
TASK=$(mktemp -t cursor-task.XXXXXX)
cat >"$TASK" <<'EOF'
<完整任务描述，包含需求、验收标准、要修改的文件路径>
EOF
```

3. 运行 Cursor Agent:

```bash
cd <目标项目目录>
set -a; . ~/.openclaw/.env; set +a
node ~/.openclaw/cursor/cursor-run.mjs --cwd <目标项目目录> --prompt-file "$TASK"
rm -f "$TASK"
```

输出中 `[CURSOR_RESULT_STATUS] finished` 表示成功，`[CURSOR_RESULT]` 后是结果摘要。

## 规则

- 长任务（预计 >5 分钟）提示用户会比较慢，可在后台执行并稍后汇报。
- 涉及删除、git push、改全局配置等高风险操作，先向用户确认。
- 若 `CURSOR_API_KEY` 缺失或脚本报错，检查 `~/.openclaw/cursor` 目录与 `.env`。
- 完成时向用户汇报：改了哪些文件、结果摘要、是否通过。

## 兜底

若 Cursor Agent 不可用（SDK 报错），可改用:
- `cursor -g <file:line>` 打开对应文件供用户接手。
- 直接用 OpenClaw 的 bash/文件工具手工实现简单改动。
