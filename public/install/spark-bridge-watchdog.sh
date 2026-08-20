#!/bin/bash
# Spark Bridge watchdog — restart LaunchAgent if process missing or health.json stale.
set -u
BRIDGE_DIR="${HOME}/.openclaw/bridge"
HEALTH="${BRIDGE_DIR}/health.json"
LOG="${BRIDGE_DIR}/watchdog.log"
LABEL="org.spark.bridge"
UID_NUM="$(id -u)"
STALE_SEC="${SPARK_BRIDGE_HEALTH_STALE_SEC:-120}"
mkdir -p "$BRIDGE_DIR"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >>"$LOG"
}

ensure_loaded() {
  if launchctl print "gui/${UID_NUM}/${LABEL}" >/dev/null 2>&1; then
    return 0
  fi
  PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
  if [ -f "$PLIST" ]; then
    launchctl bootstrap "gui/${UID_NUM}" "$PLIST" 2>/dev/null \
      || launchctl load "$PLIST" 2>/dev/null \
      || true
    log "bootstrapped ${LABEL}"
  fi
}

need_restart=0
ensure_loaded

if ! pgrep -f "${BRIDGE_DIR}/index.mjs" >/dev/null 2>&1; then
  need_restart=1
  log "bridge process missing"
elif [ -f "$HEALTH" ]; then
  now="$(date +%s)"
  ts="$(
    /usr/bin/python3 -c "import json; print(int(json.load(open('${HEALTH}'))['ts']/1000))" 2>/dev/null \
      || echo 0
  )"
  age=$((now - ts))
  if [ "$age" -gt "$STALE_SEC" ]; then
    need_restart=1
    log "health stale age=${age}s (limit ${STALE_SEC}s)"
  fi
fi

if [ "$need_restart" = 1 ]; then
  log "kickstart ${LABEL}"
  launchctl kickstart -k "gui/${UID_NUM}/${LABEL}" 2>/dev/null \
    || launchctl start "${LABEL}" 2>/dev/null \
    || true
fi
