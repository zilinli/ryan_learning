#!/bin/bash
# 一键备份 AI 助理配置到 GitHub（ryan_learning/assistant）
# 用法: bash assistant/platforms/darwin/backup.sh
set -e

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
CONFIG_SRC="$HOME/.openclaw"
WS="$CONFIG_SRC/workspace"

cd "$REPO_DIR"

# 1. 同步最新的 openclaw 配置
echo "[1/3] 同步配置..."
cp "$CONFIG_SRC/openclaw.json" openclaw-config/ 2>/dev/null || true
cp "$CONFIG_SRC/openclaw.json.bak" openclaw-config/ 2>/dev/null || true
cp "$CONFIG_SRC/openclaw.json.last-good" openclaw-config/ 2>/dev/null || true
cp "$CONFIG_SRC/cursor/cursor-run.mjs" openclaw-config/cursor/ 2>/dev/null || true
cp "$CONFIG_SRC/cursor/package.json" openclaw-config/cursor/ 2>/dev/null || true

# 工作区核心文档
for f in AGENTS.md WEIXIN_COMMANDS.md HEARTBEAT.md IDENTITY.md SOUL.md TOOLS.md USER.md; do
  cp "$WS/$f" openclaw-config/workspace/ 2>/dev/null || true
done

# 工作区 skills（含子目录，递归复制）
rm -rf openclaw-config/workspace/skills
mkdir -p openclaw-config/workspace/skills
cp -R "$WS/skills/." openclaw-config/workspace/skills/ 2>/dev/null || true

# 记忆目录
mkdir -p openclaw-config/workspace/memory
cp -R "$WS/memory/." openclaw-config/workspace/memory/ 2>/dev/null || true

# Bolt Console（排除运行时文件 history.json/workbench.log/sessions.json）
rm -rf openclaw-config/workbench
mkdir -p openclaw-config/workbench
cp -R "$HOME/openclaw-workbench/." openclaw-config/workbench/ 2>/dev/null || true
rm -f openclaw-config/workbench/history.json openclaw-config/workbench/workbench.log openclaw-config/workbench/sessions.json

# 2. 提交
echo "[2/3] 提交变更..."
MSG="backup $(date +%F_%H%M)"
git add -A
if git diff --cached --quiet; then
  echo "无变更，跳过提交"
else
  git -c core.editor=true commit --file=/dev/stdin <<EOF
$MSG
EOF
fi

# 3. 推送
echo "[3/3] 推送到 GitHub..."
git push

echo "✅ 备份完成: $(git rev-parse --short HEAD)"
