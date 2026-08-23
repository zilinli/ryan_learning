#!/usr/bin/env bash
# Spark Bridge watchdog — macOS LaunchAgent or Linux systemd --user.
# Restarts Bridge if the process is missing or health.json is stale.
# Safe to run from LaunchAgent StartInterval or systemd timer.
set -u

BRIDGE_DIR="${HOME}/.openclaw/bridge"
HEALTH="${BRIDGE_DIR}/health.json"
LOG="${BRIDGE_DIR}/watchdog.log"
STALE_SEC="${SPARK_BRIDGE_HEALTH_STALE_SEC:-120}"
mkdir -p "$BRIDGE_DIR"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >>"$LOG"
}

health_stale() {
  if [[ ! -f "$HEALTH" ]]; then
    return 1
  fi
  local now ts age
  now="$(date +%s)"
  ts="$(
    python3 -c "import json; print(int(json.load(open('${HEALTH}'))['ts']/1000))" 2>/dev/null \
      || echo 0
  )"
  age=$((now - ts))
  if [[ "$age" -gt "$STALE_SEC" ]]; then
    log "health stale age=${age}s (limit ${STALE_SEC}s)"
    return 0
  fi
  return 1
}

process_missing() {
  if pgrep -f "${BRIDGE_DIR}/index.mjs" >/dev/null 2>&1; then
    return 1
  fi
  log "bridge process missing"
  return 0
}

restart_darwin() {
  local uid label plist
  uid="$(id -u)"
  label="org.spark.bridge"
  plist="${HOME}/Library/LaunchAgents/${label}.plist"
  if ! launchctl print "gui/${uid}/${label}" >/dev/null 2>&1; then
    if [[ -f "$plist" ]]; then
      launchctl bootstrap "gui/${uid}" "$plist" 2>/dev/null \
        || launchctl load "$plist" 2>/dev/null \
        || true
      log "bootstrapped ${label}"
    fi
  fi
  log "kickstart ${label}"
  launchctl kickstart -k "gui/${uid}/${label}" 2>/dev/null \
    || launchctl start "${label}" 2>/dev/null \
    || true
}

restart_linux() {
  log "systemctl --user restart spark-bridge.service"
  systemctl --user restart spark-bridge.service 2>/dev/null \
    || systemctl --user start spark-bridge.service 2>/dev/null \
    || true
}

need_restart=0
if process_missing; then
  need_restart=1
elif health_stale; then
  need_restart=1
fi

if [[ "$need_restart" != 1 ]]; then
  exit 0
fi

case "$(uname -s)" in
  Darwin) restart_darwin ;;
  Linux) restart_linux ;;
  *) log "unsupported OS $(uname -s)"; exit 0 ;;
esac
