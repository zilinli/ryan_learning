#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p logs
LOG="logs/last-start.txt"
{
  echo "==== start $(date -Iseconds) ===="
  echo "cwd=$(pwd)"
  node -v
  npm -v
} >"$LOG"

if [[ ! -d node_modules/next ]]; then
  echo "[Spark] Installing dependencies..."
  npm install --registry https://registry.npmmirror.com >>"$LOG" 2>&1
fi

echo "[Spark] Preparing env..."
node scripts/ensure-env.mjs >>"$LOG" 2>&1

# ---- Agent Chat Console (port 3001) ----
ACC_DIR="agent-chat"
ACC_PORT="${ACC_PORT:-3001}"
if [[ -d "$ACC_DIR" ]]; then
  echo "[Spark] Launching Agent Chat Console on port ${ACC_PORT}..."
  cd "$ACC_DIR"
  # Symlink parent node_modules if needed
  [[ -d ../node_modules ]] && [[ ! -e node_modules ]] && ln -sf ../node_modules node_modules
  mkdir -p logs data/conversations
  nohup npx next dev -H 0.0.0.0 -p "${ACC_PORT}" >../logs/agent-chat.log 2>&1 &
  ACC_PID=$!
  cd ..
  echo "[Spark] Agent Chat Console PID: ${ACC_PID}  → http://0.0.0.0:${ACC_PORT}"
  # Cleanup ACC on exit
  trap "kill ${ACC_PID} 2>/dev/null; echo '[Spark] Stopped Agent Chat Console'" EXIT
fi
# --------------------------------

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"

# Prefer production for stable remote access
if [[ "${SPARK_MODE:-prod}" == "dev" ]]; then
  echo "[Spark] Dev mode → http://0.0.0.0:${PORT}"
  exec npm run dev
fi

echo "[Spark] Building..."
npm run build >>"$LOG" 2>&1
echo "[Spark] Starting → http://0.0.0.0:${PORT}"
exec npm run start
