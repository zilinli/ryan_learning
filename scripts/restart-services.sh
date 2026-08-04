#!/usr/bin/env bash
# restart-services.sh — ordered stop → start → health-check gate for Spark services.
# Each service is verified (with timeout + retry) before the next is declared healthy.
set -uo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
LOG="logs/restart-services.log"
mkdir -p logs
exec >>"$LOG" 2>&1

log() { echo "[$(date -Iseconds)] $*"; }

HEALTH_TIMEOUT_MS="${HEALTH_TIMEOUT_MS:-120000}"
HEALTH_RETRIES="${HEALTH_RETRIES:-6}"
HEALTH_RETRY_DELAY="${HEALTH_RETRY_DELAY:-10}"
MAX_BUILD_WAIT="${MAX_BUILD_WAIT:-900}"

services_order() {
  for s in stt spark acc; do
    systemctl is-active "spark-${s}.service" >/dev/null 2>&1 && echo "spark-${s}.service"
  done
}

start_service() {
  local unit="$1"
  systemctl is-active "$unit" >/dev/null 2>&1 && { log "start ${unit} — already active"; return 0; }
  log "start ${unit}"
  systemctl start "$unit" || { log "FAIL start ${unit}"; return 1; }
  return 0
}

stop_service() {
  local unit="$1"
  systemctl is-active "$unit" >/dev/null 2>&1 || { log "stop ${unit} — not running"; return 0; }
  log "stop ${unit}"
  systemctl stop "$unit" || { log "FAIL stop ${unit}"; return 1; }
  return 0
}

# wait_healthy <service> <timeout_ms> <retries> <delay> — poll a single service.
wait_healthy() {
  local service="$1" timeout_ms="$2" retries="$3" delay="$4"
  local deadline=$((SECONDS + timeout_ms / 1000))
  local attempt=0
  while (( SECONDS < deadline )); do
    attempt=$((attempt + 1))
    if "${ROOT}/scripts/health-check.mjs" --service="${service}" --json >/dev/null 2>&1; then
      log "healthy ${service} (attempt ${attempt})"
      return 0
    fi
    if (( attempt >= retries )); then
      log "retries exhausted for ${service} (${attempt})"
      return 1
    fi
    sleep "$delay"
  done
  log "TIMEOUT waiting for ${service} (${timeout_ms}ms)"
  return 1
}

run() {
  local mode="${1:-full}"

  log "==== restart-services ${mode} $(date -Iseconds) ===="

  if [[ "$mode" == "full" ]]; then
    # Ordered stop: reverse dependency order
    for unit in spark-acc spark-tutor spark-stt; do
      stop_service "$unit" || true
    done
  fi

  # ---- STT (8765) — start first, health via /health ----
  start_service spark-stt.service || { log "❌ STT failed to start"; return 1; }
  wait_healthy "stt" "$HEALTH_TIMEOUT_MS" "$HEALTH_RETRIES" "$HEALTH_RETRY_DELAY" || { log "❌ STT unhealthy"; return 1; }
  log "✅ STT healthy (http://127.0.0.1:8765/health)"

  # ---- Spark Tutor (3000) — may need build ----
  start_service spark-tutor.service || { log "❌ Spark failed to start"; return 1; }
  wait_healthy "spark" "$HEALTH_TIMEOUT_MS" "$HEALTH_RETRIES" "$HEALTH_RETRY_DELAY" || { log "❌ Spark unhealthy"; return 1; }
  log "✅ Spark healthy (http://127.0.0.1:3000/api/setup)"

  # ---- Agent Chat Console (3001) ----
  start_service spark-acc.service || { log "❌ ACC failed to start"; return 1; }
  wait_healthy "acc" "$HEALTH_TIMEOUT_MS" "$HEALTH_RETRIES" "$HEALTH_RETRY_DELAY" || { log "❌ ACC unhealthy"; return 1; }
  log "✅ ACC healthy (http://127.0.0.1:3001/api/setup)"

  log "==== all services healthy ===="
  "${ROOT}/scripts/health-check.mjs"
  return 0
}

run "${1:-full}"
