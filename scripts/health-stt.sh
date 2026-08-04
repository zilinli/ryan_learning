#!/usr/bin/env bash
# scripts/health-stt.sh — health check for STT/TTS server
set -euo pipefail

HEALTH_URL="http://127.0.0.1:8765/health"
TIMEOUT="${1:-30}"
ELAPSED=0

while [[ $ELAPSED -lt $TIMEOUT ]]; do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "STT: healthy ($(curl -s "$HEALTH_URL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'whisper={d[\"whisper_loaded\"]} sv={d[\"sensevoice_loaded\"]} mem={d.get(\"memory\",{}).get(\"rss_mb\",\"?\")}MB')" 2>/dev/null || echo "ok"))"
    exit 0
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

echo "STT: unhealthy after ${TIMEOUT}s"
exit 1
