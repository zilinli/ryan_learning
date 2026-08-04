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

# ---- If systemd units are installed, delegate to restart-services.sh ----
if [[ "${SPARK_USE_SYSTEMD:-1}" == "1" ]] && [[ -f /etc/systemd/system/spark-tutor.service ]] && systemctl list-unit-files spark-tutor.service >/dev/null 2>&1; then
  echo "[Spark] Delegating to restart-services.sh (systemd)..." | tee -a "$LOG"
  bash scripts/restart-services.sh full
  echo "[Spark] Services restarted and verified." | tee -a "$LOG"
  exit 0
fi

if [[ ! -d node_modules/next ]]; then
  echo "[Spark] Installing dependencies..."
  npm install --registry https://registry.npmmirror.com >>"$LOG" 2>&1
fi

echo "[Spark] Preparing env..."
node scripts/ensure-env.mjs >>"$LOG" 2>&1

# ---- Pre-flight: kill any existing processes on our ports ----
preflight_kill_port() {
  local port=$1 label=$2
  local pid
  pid=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    echo "[Spark] Killing existing ${label} on port ${port} (PID ${pid})..."
    kill -TERM "$pid" 2>/dev/null || true
    sleep 2
    kill -KILL "$pid" 2>/dev/null || true
  fi
}
preflight_kill_port 3000 "Spark Tutor"
preflight_kill_port 3001 "Agent Chat Console"
preflight_kill_port 8765 "STT Server"

# ---- Agent Chat Console (port 3001) ----
ACC_DIR="agent-chat"
ACC_PORT="${ACC_PORT:-3001}"
if [[ -d "$ACC_DIR" ]]; then
  echo "[Spark] Launching Agent Chat Console on port ${ACC_PORT}..."
  cd "$ACC_DIR"
  # Validate / fix node_modules symlink
  if [[ ! -e node_modules/next ]]; then
    rm -f node_modules
    [[ -d ../node_modules ]] && ln -sf ../node_modules node_modules
  fi
  if [[ ! -e node_modules/next ]]; then
    echo "[Spark] ❌ Agent Chat Console dependencies missing — skipping ACC" >&2
    cd ..
  else
    mkdir -p logs data/conversations
    nohup npx next dev -H 0.0.0.0 -p "${ACC_PORT}" >../logs/agent-chat.log 2>&1 &
    ACC_PID=$!
    echo "[Spark] Agent Chat Console PID: ${ACC_PID} → http://0.0.0.0:${ACC_PORT}"
    trap "kill ${ACC_PID} 2>/dev/null; echo '[Spark] Stopped Agent Chat Console'" EXIT
    cd ..
  fi
else
  true  # ACC_DIR not present
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