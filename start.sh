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
